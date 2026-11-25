import fs from "node:fs"
import path from "node:path"

const root = path.join(process.cwd(), ".next", "server", "app")
if (!fs.existsSync(root)) throw new Error("Build the site before checking JSON-LD.")

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith(".html") ? [file] : []
  })
}

const files = htmlFiles(root)
const byRoute = new Map(files.map((file) => {
  const relative = path.relative(root, file).replaceAll(path.sep, "/")
  const route = relative === "index.html" ? "/" : `/${relative.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`
  return [route, fs.readFileSync(file, "utf8")]
}))

function schemas(route) {
  const html = byRoute.get(route)
  if (!html) throw new Error(`No prerendered HTML found for ${route}`)
  const values = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]))
  return { html, values: values.flatMap((value) => value["@graph"] ?? [value]) }
}

const home = schemas("/")
for (const type of ["WebSite", "SoftwareSourceCode", "FAQPage"]) {
  if (!home.values.some((value) => value["@type"] === type)) throw new Error(`Homepage is missing ${type} JSON-LD.`)
}
const faq = home.values.find((value) => value["@type"] === "FAQPage")
if (faq.mainEntity.length !== 7) throw new Error("Homepage FAQ JSON-LD does not contain the seven visible FAQ items.")
for (const question of faq.mainEntity) {
  if (!home.html.includes(question.name) || !home.html.includes(question.acceptedAnswer.text)) {
    throw new Error(`FAQ schema content is not visible on the homepage: ${question.name}`)
  }
}

const component = schemas("/components/amount-input")
if (!component.values.some((value) => value["@type"] === "BreadcrumbList")) throw new Error("Component page is missing BreadcrumbList JSON-LD.")
const source = component.values.find((value) => value["@type"] === "SoftwareSourceCode")
if (!source || !component.html.includes(source.name) || !component.html.includes(source.description)) throw new Error("Component source schema does not match visible content.")

const article = schemas("/guides/react-type-to-confirm-dialog")
const articleData = article.values.find((value) => value["@type"] === "Article" || value["@type"] === "TechArticle")
if (!articleData) throw new Error("Guide page is missing Article JSON-LD.")
for (const field of [articleData.headline, articleData.description, articleData.author.name, articleData.datePublished, articleData.dateModified]) {
  if (!article.html.includes(field)) throw new Error(`Guide Article schema field is not visible: ${field}`)
}

console.log(`Validated well-formed JSON-LD on homepage, component page and guide page (${files.length} prerendered HTML files scanned).`)
