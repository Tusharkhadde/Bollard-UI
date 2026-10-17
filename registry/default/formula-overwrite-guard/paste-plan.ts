// Bollard UI — formula-overwrite-guard · MIT licence · https://bollard-ui.vercel.app/components/formula-overwrite-guard

export interface GridCell {
  /** What the cell shows. */
  value: string
  /** The formula behind it, e.g. "=B2*C2". A formula cell turns into a plain value when pasted over. */
  formula?: string
  /** Locked cells are never changed by a paste. */
  locked?: boolean
}
export type Grid = GridCell[][]

/** What a paste would do to one cell. */
export type CellFate = "fill" | "overwrite" | "same" | "formula" | "header" | "locked" | "outside"
export interface PlannedCell { row: number; col: number; from: string; to: string; fate: CellFate }

export interface PastePlan {
  row: number
  col: number
  rows: number
  cols: number
  cells: PlannedCell[]
  count: Record<CellFate, number>
  /** The first pasted row repeats the table's headings: the copy included them. */
  headerEcho: boolean
}

/** Column letters: 0 → A, 26 → AA. */
export function colName(i: number) {
  let s = ""
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
export const cellName = (row: number, col: number) => `${colName(col)}${row + 1}`

/** "D2", "D2:D4" or "D2, F3" for a set of cells, compressing a single row or column run into a range. */
export function rangeName(cells: { row: number; col: number }[]) {
  if (!cells.length) return ""
  const rows = new Set(cells.map((c) => c.row)), cols = new Set(cells.map((c) => c.col))
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col)
  const first = sorted[0], last = sorted[sorted.length - 1]
  const full = (rows.size === 1 || cols.size === 1) && cells.length === (last.row - first.row + 1) * (last.col - first.col + 1)
  if (cells.length === 1) return cellName(first.row, first.col)
  return full ? `${cellName(first.row, first.col)}:${cellName(last.row, last.col)}` : sorted.map((c) => cellName(c.row, c.col)).join(", ")
}

/**
 * Parses clipboard text the way spreadsheets write it: tabs between cells, CRLF or LF between rows,
 * quoted cells that may hold tabs, newlines and doubled quotes, a BOM, and one trailing newline.
 */
export function parseClipboard(text: string, maxCells = 20_000): string[][] {
  const s = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\n$/, "")
  if (!s) return []
  const rows: string[][] = [[]]
  let cell = "", i = 0, cells = 0
  while (i < s.length && cells < maxCells) {
    const ch = s[i]
    if (ch === '"' && cell === "") {
      let j = i + 1, quoted = ""
      for (; j < s.length; j++) {
        if (s[j] === '"' && s[j + 1] === '"') { quoted += '"'; j++ }
        else if (s[j] === '"') break
        else quoted += s[j]
      }
      if (j < s.length && (j + 1 === s.length || s[j + 1] === "\t" || s[j + 1] === "\n")) { cell = quoted; i = j + 1; continue }
    }
    if (ch === "\t") { rows[rows.length - 1].push(cell); cell = ""; cells++ }
    else if (ch === "\n") { rows[rows.length - 1].push(cell); rows.push([]); cell = ""; cells++ }
    else cell += ch
    i++
  }
  rows[rows.length - 1].push(cell)
  return rows
}

const norm = (s: string) => String(s ?? "").trim().toLowerCase()

/** Works out, cell by cell, what pasting `data` with its top-left at (row, col) would change. */
export function planPaste(grid: Grid, row: number, col: number, data: string[][], { headerRows = 1 } = {}): PastePlan {
  const height = grid.length, width = Math.max(0, ...grid.map((r) => r.length))
  const rows = data.length, cols = Math.max(0, ...data.map((r) => r.length))
  const count: Record<CellFate, number> = { fill: 0, overwrite: 0, same: 0, formula: 0, header: 0, locked: 0, outside: 0 }
  const cells: PlannedCell[] = []
  data.forEach((line, i) =>
    line.forEach((to, j) => {
      const r = row + i, c = col + j
      const cell = grid[r]?.[c]
      const fate: CellFate = !cell || r >= height || c >= width ? "outside"
        : cell.locked ? "locked"
        : r < headerRows ? "header"
        : cell.formula ? "formula"
        : cell.value === to ? "same"
        : cell.value === "" ? "fill" : "overwrite"
      count[fate]++
      cells.push({ row: r, col: c, from: cell?.value ?? "", to, fate })
    }),
  )
  const headings = grid.slice(0, headerRows).at(-1) ?? []
  const firstPasted = data[0] ?? []
  const named = firstPasted.filter((v, j) => norm(v) && norm(v) === norm(headings[col + j]?.value ?? ""))
  const headerEcho = row >= headerRows && rows > 1 && named.length > 0 && named.length >= Math.ceil(firstPasted.filter((v) => norm(v)).length / 2)
  return { row, col, rows, cols, cells, count, headerEcho }
}

/** Writes a plan. "all" writes every cell it can (never locked or outside); "safe" skips formulas and headings too. */
export function applyPaste(grid: Grid, plan: PastePlan, mode: "all" | "safe"): { grid: Grid; changed: PlannedCell[] } {
  const next = grid.map((r) => r.map((c) => ({ ...c })))
  const writable: CellFate[] = mode === "all" ? ["fill", "overwrite", "formula", "header"] : ["fill", "overwrite"]
  const changed = plan.cells.filter((c) => writable.includes(c.fate))
  for (const c of changed) next[c.row][c.col] = { value: c.to }
  return { grid: next, changed }
}
