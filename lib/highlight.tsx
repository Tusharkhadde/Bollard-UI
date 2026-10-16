// A tiny build-time TSX highlighter: comments, strings, keywords, numbers, JSX tags and types.
// Good enough to read source on the docs site without shipping a highlighting library.
import type { ReactNode } from "react"

const KEYWORDS = new Set(
  "import export from default function return const let var if else for while do switch case break continue new typeof instanceof in of as type interface extends implements class async await try catch finally throw null undefined true false this void keyof readonly satisfies enum declare".split(
    " ",
  ),
)

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g

const tone = {
  comment: "text-zinc-500 italic dark:text-zinc-400",
  string: "text-emerald-700 dark:text-emerald-400",
  tag: "text-sky-700 dark:text-sky-400",
  number: "text-amber-700 dark:text-amber-400",
  keyword: "text-violet-700 dark:text-violet-400",
  type: "text-cyan-700 dark:text-cyan-300",
}

export function highlight(source: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of source.matchAll(TOKEN)) {
    const [text, comment, string, tag, number, word] = match
    const start = match.index ?? 0
    if (start > last) out.push(source.slice(last, start))
    last = start + text.length
    let cls: string | undefined
    if (comment) cls = tone.comment
    else if (string) cls = tone.string
    else if (tag) {
      const bracket = tag.startsWith("</") ? "</" : "<"
      out.push(bracket, <span key={key++} className={tone.tag}>{tag.slice(bracket.length)}</span>)
      continue
    } else if (number) cls = tone.number
    else if (word && KEYWORDS.has(word)) cls = tone.keyword
    else if (word && /^[A-Z]/.test(word)) cls = tone.type
    out.push(cls ? <span key={key++} className={cls}>{text}</span> : text)
  }
  if (last < source.length) out.push(source.slice(last))
  return out
}
