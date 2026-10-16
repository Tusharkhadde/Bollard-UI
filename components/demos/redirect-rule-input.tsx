"use client"

import * as React from "react"

import { RedirectRuleInput } from "@/registry/default/redirect-rule-input/redirect-rule-input"

const examples = {
  Vercel: `{
  "redirects": [
    { "source": "/blog/:slug", "destination": "/articles/:slug" },
    { "source": "/articles/:slug", "destination": "/posts/:slug" },
    { "source": "/blog/launch-week", "destination": "/launch" },
    { "source": "/black-friday", "destination": "/sale" },
    { "source": "/api/subscribe", "destination": "/api/v2/subscribe", "statusCode": 301 },
    { "source": "/docs", "destination": "http://docs.example.com" }
  ]
}`,
  Netlify: `/jobs/*         /careers/:splat
/jobs/intern    /careers/internship
/blog/post/     /blog/post    301!
/summer-sale    /deals        307
/out/*          https://:splat  302`,
  nginx: `server {
    listen 443 ssl;
    server_name example.com;
    location = /pricing { return 301 /plans; }
    location = /plans   { return 301 /pricing; }
    location /shop      { return 302 http://store.example.com$uri; }
}`,
}

export function Demo() {
  const [example, setExample] = React.useState<keyof typeof examples>("Vercel")
  const [value, setValue] = React.useState(examples.Vercel)
  return (
    <div className="grid w-full max-w-xl gap-3">
      <div role="group" aria-label="Load an example" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Example:
        {(Object.keys(examples) as (keyof typeof examples)[]).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={example === name}
            onClick={() => {
              setExample(name)
              setValue(examples[name])
            }}
            className="h-6 rounded-md border px-2 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"
          >
            {name}
          </button>
        ))}
      </div>
      <RedirectRuleInput key={example} value={value} onValueChange={setValue} origin="https://example.com" />
    </div>
  )
}
