"use client"

import { TreeSelectReadback, type TreeNode } from "@/registry/default/tree-select-readback/tree-select-readback"

const tree: TreeNode[] = [
  {
    id: "marketing",
    label: "Marketing",
    children: ["Brand", "SEO", "Paid ads", "Content", "Events"].map((label) => ({ id: `mkt-${label}`, label })),
  },
  {
    id: "sales",
    label: "Sales",
    children: [
      { id: "north", label: "North", children: ["Delhi", "Jaipur", "Lucknow", "Chandigarh"].map((label) => ({ id: `n-${label}`, label })) },
      { id: "west", label: "West", children: ["Pune", "Mumbai", "Ahmedabad", "Goa"].map((label) => ({ id: `w-${label}`, label })) },
      { id: "south", label: "South", children: ["Bengaluru", "Chennai", "Kochi", "Hyderabad"].map((label) => ({ id: `s-${label}`, label })) },
    ],
  },
  { id: "support", label: "Support", growing: false, children: ["Tier 1", "Tier 2", "Escalations"].map((label) => ({ id: `sup-${label}`, label })) },
]

export function Demo() {
  return (
    <TreeSelectReadback
      label="Send the Q3 survey to"
      tree={tree}
      defaultValue={["marketing", "w-Pune", "w-Mumbai", "s-Kochi"]}
      defaultExpanded={["marketing", "sales"]}
    />
  )
}
