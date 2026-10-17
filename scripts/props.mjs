// Extracts each component's main props with the TypeScript compiler API (syntax only,
// no type checker, so it is fast and never fails the build). For
// registry/default/<name>/<name>.tsx it finds the exported component (the PascalCase
// form of <name>, else the first exported PascalCase function), reads its props type,
// and returns the props declared in that file:
//   { component, extends?, props: [{ name, type, required, default?, description? }] }
// Inherited native props (React.ComponentProps<"input">, …) are summarised in
// `extends` rather than listed. Returns null when nothing sensible is found.
import fs from "node:fs"
import ts from "typescript"

const pascal = (name) => name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
const clean = (text) => text.replace(/\s+/g, " ").trim()

/** First line (sentence) of a node's JSDoc comment, without tags. */
function docOf(node, sf) {
  const docs = node.jsDoc
  if (!docs?.length) return undefined
  const comment = docs[docs.length - 1].comment
  const text = typeof comment === "string" ? comment : Array.isArray(comment) ? comment.map((c) => c.text ?? c.getText?.(sf) ?? "").join("") : ""
  const first = clean(text.split(/\n\s*\n/)[0] ?? "")
  return first || undefined
}

function membersOf(typeNode, decls, sf, seen = new Set()) {
  const out = { props: [], extends: [] }
  if (!typeNode) return out
  if (ts.isTypeLiteralNode(typeNode)) {
    out.props.push(...typeNode.members.filter(ts.isPropertySignature).map((m) => propOf(m, sf)).filter(Boolean))
    return out
  }
  if (ts.isIntersectionTypeNode(typeNode)) {
    for (const t of typeNode.types) {
      const sub = membersOf(t, decls, sf, seen)
      out.props.push(...sub.props)
      out.extends.push(...sub.extends)
    }
    return out
  }
  if (ts.isParenthesizedTypeNode(typeNode)) return membersOf(typeNode.type, decls, sf, seen)
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText(sf)
    if (!decls.has(name) || seen.has(name)) {
      out.extends.push(clean(typeNode.getText(sf)))
      return out
    }
    return membersOfDecl(name, decls, sf, seen)
  }
  out.extends.push(clean(typeNode.getText(sf)))
  return out
}

/** Members of a local interface or type alias, following local `extends` clauses. */
function membersOfDecl(name, decls, sf, seen) {
  const out = { props: [], extends: [] }
  const decl = decls.get(name)
  seen.add(name)
  if (ts.isInterfaceDeclaration(decl)) {
    for (const clause of decl.heritageClauses ?? []) {
      for (const t of clause.types) {
        const base = t.expression.getText(sf)
        if (decls.has(base) && !seen.has(base)) {
          const sub = membersOfDecl(base, decls, sf, seen)
          out.props.push(...sub.props)
          out.extends.push(...sub.extends)
        } else out.extends.push(clean(t.getText(sf)))
      }
    }
    out.props.push(...decl.members.filter(ts.isPropertySignature).map((m) => propOf(m, sf)).filter(Boolean))
    return out
  }
  if (ts.isTypeAliasDeclaration(decl)) return membersOf(decl.type, decls, sf, seen)
  return out
}

function propOf(member, sf) {
  if (!member.name) return null
  const name = member.name.getText(sf).replace(/^["']|["']$/g, "")
  let type = member.type ? clean(member.type.getText(sf)) : "unknown"
  if (type.length > 140) type = type.slice(0, 137) + "…"
  const prop = { name, type, required: !member.questionToken }
  let description = docOf(member, sf)
  if (description && description.length > 220) description = description.slice(0, 217).replace(/\s+\S*$/, "") + "…"
  if (description) prop.description = description
  return prop
}

/** Defaults from the component's destructured first parameter: `{ label = "Amount", … }`. */
function defaultsOf(param, sf) {
  const defaults = new Map()
  if (param && ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (!el.initializer || el.dotDotDotToken) continue
      const key = (el.propertyName ?? el.name).getText(sf)
      let text = clean(el.initializer.getText(sf))
      if (text.length > 60) text = text.slice(0, 57) + "…"
      defaults.set(key, text)
    }
  }
  return defaults
}

export function extractProps(file, name) {
  if (!fs.existsSync(file)) return null
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const decls = new Map()
  const components = []
  const exported = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const node of sf.statements) {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) decls.set(node.name.text, node)
    if (ts.isFunctionDeclaration(node) && node.name && exported(node) && /^[A-Z]/.test(node.name.text)) components.push({ name: node.name.text, fn: node })
    if (ts.isVariableStatement(node) && exported(node)) {
      for (const d of node.declarationList.declarations) {
        const init = d.initializer
        if (ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          components.push({ name: d.name.text, fn: init })
        }
      }
    }
  }
  const main = components.find((c) => c.name === pascal(name)) ?? components[0]
  if (!main) return null
  const param = main.fn.parameters[0]
  if (!param) return { component: main.name, props: [] }
  const { props, extends: ext } = membersOf(param.type, decls, sf)
  const defaults = defaultsOf(param, sf)
  const seen = new Set()
  const list = props
    .filter((p) => (seen.has(p.name) ? false : seen.add(p.name)))
    .map((p) => (defaults.has(p.name) ? { ...p, default: defaults.get(p.name) } : p))
  const result = { component: main.name, props: list }
  if (ext.length) result.extends = [...new Set(ext)]
  return result
}
