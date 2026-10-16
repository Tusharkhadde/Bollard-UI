"use client"

import { SplitAllocator } from "@/registry/default/split-allocator/split-allocator"

const founders = [
  { id: "priya", label: "Priya" },
  { id: "rahul", label: "Rahul" },
  { id: "arjun", label: "Arjun" },
]

const dinner = [
  { id: "asha", label: "Asha" },
  { id: "dev", label: "Dev" },
  { id: "meera", label: "Meera" },
]

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-8">
      <SplitAllocator label="Equity split" items={founders} defaultValue={{ priya: 50, rahul: 38 }} />
      <SplitAllocator label="Dinner bill" items={dinner} total={1000} precision={2} prefix="₹" suffix="" defaultValue={{ asha: 400, dev: 400, meera: 250 }} />
    </div>
  )
}
