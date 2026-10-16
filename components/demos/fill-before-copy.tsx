"use client"

import { FillBeforeCopy } from "@/registry/default/fill-before-copy/fill-before-copy"

const code = `curl https://api.bollard.dev/v1/projects/{{project_id}}/deploys \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d branch=main`

export function Demo() {
  return (
    <div className="grid w-full max-w-md min-w-0 gap-4">
      <FillBeforeCopy code={code} defaultValue={{ project_id: "prj_8f3k2" }} />
      <FillBeforeCopy
        title=".env"
        unfilled="warn"
        code={`DATABASE_URL=postgres://app:<db-password>@db.internal:5432/app\nREGION={{region}}`}
        defaultValue={{ region: "ap-south-1" }}
      />
    </div>
  )
}
