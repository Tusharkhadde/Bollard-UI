// A deliberately tiny Markdown renderer for the repo's own files (CHANGELOG.md):
// headings, paragraphs, "-" lists, `code`, **bold** and [links](url). Reference-style
// link definitions are dropped and "[0.1.0]" headings render as plain text, so the
// page never links to the private repository. Server only.
import fs from "node:fs"
import path from "node:path"

import { cn } from "@/lib/utils"

const codeClass = "rounded-md border bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-foreground"
const linkClass = "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"

const repoFiles = {
  "CHANGELOG.md": () => fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8"),
  "LICENSE": () => fs.readFileSync(path.join(process.cwd(), "LICENSE"), "utf8"),
  "package.json": () => fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ".nvmrc": () => fs.readFileSync(path.join(process.cwd(), ".nvmrc"), "utf8"),
  ".github/workflows/ci.yml": () => fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8"),
} as const

export function readRepoFile(file: keyof typeof repoFiles) {
  try {
    return repoFiles[file]()
  } catch {
    return null
  }
}

function inline(text: string, allowLink: (url: string) => boolean): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${m.index}`
    if (m[1] !== undefined) out.push(<code key={key} className={codeClass}>{m[1]}</code>)
    else if (m[2] !== undefined) out.push(<strong key={key} className="font-medium text-foreground">{m[2]}</strong>)
    else if (m[3] !== undefined) {
      out.push(
        allowLink(m[4]) ? (
          <a key={key} href={m[4]} className={linkClass}>
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      )
    } else out.push(m[5])
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export interface MdHeading {
  id: string
  label: string
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** Renders Markdown blocks. The first "# " heading is skipped (the page has its own title). Returns the h2s for a TOC. */
export function renderMarkdown(source: string, { allowLink = () => true }: { allowLink?: (url: string) => boolean } = {}) {
  const lines = source.replace(/\r\n/g, "\n").split("\n").filter((l) => !/^\[[^\]]+\]:\s+\S+/.test(l))
  const blocks: React.ReactNode[] = []
  const headings: MdHeading[] = []
  let para: string[] = []
  let list: string[] = []
  let skippedTitle = false
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), allowLink)}</p>)
    para = []
  }
  const flushList = () => {
    if (list.length)
      blocks.push(
        <ul key={`u${blocks.length}`}>
          {list.map((item, i) => (
            <li key={i}>{inline(item, allowLink)}</li>
          ))}
        </ul>,
      )
    list = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushPara()
      flushList()
      const level = h[1].length
      const text = h[2].replace(/\[([^\]]+)\](?!\()/g, "$1")
      if (level === 1 && !skippedTitle) {
        skippedTitle = true
        continue
      }
      const id = slug(text)
      if (level <= 2) {
        headings.push({ id, label: text })
        blocks.push(
          <h2 key={`h${blocks.length}`} id={id} className="scroll-mt-20 pt-6 text-xl font-semibold tracking-[-0.02em] text-foreground">
            {text}
          </h2>,
        )
      } else
        blocks.push(
          <h3 key={`h${blocks.length}`} className={cn("pt-2 text-[15px] font-medium text-foreground")}>
            {text}
          </h3>,
        )
      continue
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) {
      flushPara()
      list.push(li[1])
      continue
    }
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    if (list.length && /^\s{2,}\S/.test(raw)) {
      list[list.length - 1] += ` ${line.trim()}`
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return { blocks, headings }
}
