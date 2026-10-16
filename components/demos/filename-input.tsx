"use client"

import { FilenameInput } from "@/registry/default/filename-input/filename-input"

const folder = ["Q3 report.pdf", "Budget.xlsx", "Budget final.xlsx", "notes.txt"]

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <FilenameInput label="Rename Q3 report.pdf" originalName="Q3 report.pdf" defaultValue="Q3 report.docx" existingNames={folder} />
      <FilenameInput label="Rename Budget final.xlsx" originalName="Budget final.xlsx" defaultValue="budget.xlsx" existingNames={folder} />
      <FilenameInput label="Rename notes.txt" originalName="notes.txt" defaultValue="CON.txt " existingNames={folder} />
    </form>
  )
}
