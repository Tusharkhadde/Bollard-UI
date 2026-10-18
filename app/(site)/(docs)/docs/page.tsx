import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/site/code-block"
import { DocPage, DocSection, Note, Prose, inlineCode, proseLink } from "@/components/site/doc-page"
import { PackageCommand } from "@/components/site/package-command"
import { registryBase } from "@/lib/catalog"
import { highlight } from "@/lib/highlight"

const description =
  "Set up Bollard UI: React 19+, Tailwind v4 and shadcn init, add a component with the CLI or by hand, use it, and update it later. Notes for Next.js and Vite."

export const metadata: Metadata = {
  title: "Getting started",
  description,
  alternates: { canonical: "/docs" },
  openGraph: { title: "Getting started · Bollard UI", description, url: "/docs" },
}

const sections = [
  { id: "prerequisites", label: "Prerequisites" },
  { id: "cli", label: "Add with the CLI" },
  { id: "manual", label: "Add by hand" },
  { id: "usage", label: "Import and use" },
  { id: "headless-validation", label: "Headless validation" },
  { id: "aliases", label: "Custom aliases" },
  { id: "updating", label: "Updating a component" },
  { id: "nextjs", label: "Next.js" },
  { id: "vite", label: "Vite" },
  { id: "server", label: "Guard rails, not enforcement" },
]

const code = (path: string, source: string) => ({ path, source, lines: source.split("\n").length, code: highlight(source) })

const usage = `import { AmountInput } from "@/components/ui/amount-input"

export function RentField() {
  return <AmountInput label="Monthly rent" locale="en-IN" currency="INR" typical={24000} />
}`

const headlessUsage = `import { useBollardField } from "@/hooks/use-bollard-field"
import { Input } from "@/components/ui/input"

export function EmailField() {
  const email = useBollardField({
    initialValue: "",
    validate: (value) => /.+@.+\\..+/.test(value) ? undefined : "Enter a valid email address.",
  })

  return (
    <div className="space-y-2">
      <label htmlFor="email">Email</label>
      <Input
        id="email"
        value={email.value}
        onChange={(event) => email.setValue(event.target.value)}
        onBlur={email.onBlur}
        {...email.ariaProps}
      />
      {email.error && <p id={email.errorId} role="alert">{email.error}</p>}
    </div>
  )
}`

const tree = `components/
  ui/
    amount-input.tsx   ← written by the CLI, yours to edit
lib/
  utils.ts             ← cn(), from shadcn init`

const diff = `# Fetch the current source and compare it with your copy
curl -s ${registryBase}amount-input.json | jq -r '.files[0].content' > /tmp/amount-input.tsx
git diff --no-index components/ui/amount-input.tsx /tmp/amount-input.tsx`

const viteConfig = `// vite.config.ts
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})`

const tsPaths = `// tsconfig.json and tsconfig.app.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}`

const serverMapping = [
  "if (!(await email.validate())) return",
  "const result = await saveProfile({ email: email.value })",
  "const message = result.fieldErrors?.email?.[0] ?? result.message",
  "if (message) email.setError(message)",
].join("\n")

const zodUsage = [
  "validate: (value) => {",
  "  const result = emailSchema.safeParse(value)",
  "  return result.success ? undefined : result.error.issues[0]?.message",
  "}",
].join("\n")

export default function GettingStartedPage() {
  const url = `${registryBase}amount-input.json`
  return (
    <DocPage
      title="Getting started"
      lead="Bollard UI is not a package. Each component is a source file the shadcn CLI copies into your project, so you need a shadcn setup once and then one command per component."
      sections={sections}
    >
      <DocSection id="prerequisites" title="Prerequisites">
        <Prose>
          <ul>
            <li>
              <strong className="font-medium text-foreground">React 19 or later.</strong> Components take <code className={inlineCode}>ref</code> as a plain
              prop, so React 18 is not supported.
            </li>
            <li>
              <strong className="font-medium text-foreground">Tailwind CSS v4</strong> with the shadcn theme variables. Tailwind v3 is not targeted.
            </li>
            <li>
              <strong className="font-medium text-foreground">A shadcn/ui setup</strong>: a <code className={inlineCode}>components.json</code>, the theme
              tokens and the <code className={inlineCode}>cn()</code> helper in <code className={inlineCode}>@/lib/utils</code>. You don&apos;t need any of
              shadcn&apos;s own components.
            </li>
            <li>TypeScript is recommended; every component is written in strict TypeScript.</li>
          </ul>
        </Prose>
        <p className="text-sm text-muted-foreground">If the project doesn&apos;t have a shadcn setup yet, run this once:</p>
        <PackageCommand kind="shadcn" args="init" label="Copy init command" />
      </DocSection>

      <DocSection id="cli" title="Add with the CLI">
        <PackageCommand kind="add" args={url} label="Copy install command" />
        <Prose>
          <p>The CLI reads your <code className={inlineCode}>components.json</code>, then:</p>
          <ol>
            <li>
              writes the component to your <code className={inlineCode}>ui</code> folder, for example{" "}
              <code className={inlineCode}>components/ui/amount-input.tsx</code> (a few components also bring a helper <code className={inlineCode}>.ts</code>{" "}
              file that lands next to it);
            </li>
            <li>installs the npm packages the component lists, such as lucide-react or motion;</li>
            <li>adds any other Bollard UI component it builds on.</li>
          </ol>
          <p>
            Every component page shows its exact command, its dependencies and the files it adds. The whole registry is at{" "}
            <a className={proseLink} href={`${registryBase}registry.json`}>
              /r/registry.json
            </a>
            .
          </p>
        </Prose>
        <CodeBlock lineNumbers={false} files={[code("project", tree)]} />
      </DocSection>

      <DocSection id="manual" title="Add by hand">
        <Prose>
          <ol>
            <li>Install the npm packages listed under Dependencies on the component&apos;s page.</li>
            <li>
              Open the Manual tab on the component&apos;s page, copy each file into <code className={inlineCode}>components/ui</code>, keeping the file names.
            </li>
            <li>
              Fix the imports if your aliases differ: <code className={inlineCode}>@/lib/utils</code> for <code className={inlineCode}>cn()</code>, and{" "}
              <code className={inlineCode}>@/components/ui/…</code> for any other Bollard UI component it imports.
            </li>
          </ol>
        </Prose>
      </DocSection>

      <DocSection id="usage" title="Import and use">
        <Prose>
          <p>
            Import from where the file landed. Snippets on this site always use <code className={inlineCode}>@/components/ui/&lt;name&gt;</code>, which is
            what the CLI writes with the default aliases.
          </p>
        </Prose>
        <CodeBlock lineNumbers={false} files={[code("rent-field.tsx", usage)]} />
        <Prose>
          <p>
            Value-holding components work controlled (<code className={inlineCode}>value</code> + <code className={inlineCode}>onValueChange</code>) or
            uncontrolled (<code className={inlineCode}>defaultValue</code>). Most user-facing strings are props with English defaults; the Props table on each
            page lists them.
          </p>
        </Prose>
      </DocSection>

      <DocSection id="headless-validation" title="Keep your existing controls">
        <Prose>
          <p>
            Want to keep your existing controls? Add the optional <code className={inlineCode}>useBollardField</code> hook. It owns field value,
            touched/error state and async-safe validation; you keep the markup, styles and submit flow. Its only runtime dependency is React. The registry
            installs it in your configured <code className={inlineCode}>hooks</code> folder.
          </p>
        </Prose>
        <PackageCommand kind="add" args={`${registryBase}use-bollard-field.json`} label="Copy hook install command" />
        <CodeBlock lineNumbers={false} files={[code("email-field.tsx", headlessUsage)]} />
        <Prose>
          <p>
            Connect a Select, Date Picker, Checkbox, HeroUI control or custom component through the value callback it already exposes. Text inputs use
            <code className={inlineCode}>onChange</code>; value-based controls use <code className={inlineCode}>onValueChange</code>; checkboxes use{" "}
            <code className={inlineCode}>checked</code> and <code className={inlineCode}>onCheckedChange</code>. The value type is inferred, including
            strings, booleans and custom objects.
          </p>
          <p>
            Keep the host control&apos;s appearance and behavior. Pass its invalid state and the hook&apos;s error ID through{" "}
            <code className={inlineCode}>aria-invalid</code> and <code className={inlineCode}>aria-describedby</code>, then render the message beside it with
            <code className={inlineCode}>role=&quot;alert&quot;</code> or a polite live region.
          </p>
          <p>
            Validation runs on blur and after edits. Call <code className={inlineCode}>validate()</code> before submitting. Map a field error returned by your
            server with <code className={inlineCode}>setError()</code>; editing clears that server error so the user can recover. The server must still
            validate and authorize every request.
          </p>
          <CodeBlock lineNumbers={false} files={[code("server-errors.ts", serverMapping)]} />
          <p>
            If a schema library owns your rules, delegate to it from <code className={inlineCode}>validate</code> rather than duplicating them. With Zod, call
            <code className={inlineCode}>safeParse(value)</code> and return the first issue message. When React Hook Form already owns the field value, keep it
            as the single state owner: use <code className={inlineCode}>Controller</code> and <code className={inlineCode}>fieldState.error</code> for the
            accessible state instead of adding this hook as a second owner.
          </p>
          <CodeBlock lineNumbers={false} files={[code("zod-validation.ts", zodUsage)]} />
          <p>
            The existing <Link className={proseLink} href="/components/error-summary">Error Summary</Link> and{" "}
            <code className={inlineCode}>useFormErrors</code> remain available for DOM-registered forms.
          </p>
        </Prose>
      </DocSection>

      <DocSection id="aliases" title="Custom aliases">
        <Prose>
          <p>
            If your <code className={inlineCode}>components.json</code> points <code className={inlineCode}>aliases.ui</code> or{" "}
            <code className={inlineCode}>aliases.utils</code> somewhere else (say <code className={inlineCode}>~/ui</code>), the CLI rewrites the imports in
            the copied files to match. When you copy by hand, change those imports yourself. Check that the alias also exists in{" "}
            <code className={inlineCode}>tsconfig.json</code> (and in your bundler config for Vite).
          </p>
        </Prose>
      </DocSection>

      <DocSection id="updating" title="Updating a component">
        <Prose>
          <p>
            Copied code doesn&apos;t update itself. Fixes and rule changes are listed in the{" "}
            <Link className={proseLink} href="/changelog">
              changelog
            </Link>
            . To pick one up, either re-run the add command with <code className={inlineCode}>--overwrite</code>, which replaces your file (commit first so
            you can see and keep your own edits):
          </p>
        </Prose>
        <PackageCommand kind="add" args={`${url} --overwrite`} label="Copy overwrite command" />
        <Prose>
          <p>
            or compare your copy with the published source in <code className={inlineCode}>/r/&lt;name&gt;.json</code> and merge by hand:
          </p>
        </Prose>
        <CodeBlock lineNumbers={false} files={[code("terminal", diff)]} />
      </DocSection>

      <DocSection id="nextjs" title="Next.js">
        <Prose>
          <ul>
            <li>
              App Router works as is. Components that use hooks start with <code className={inlineCode}>&quot;use client&quot;</code>, so you can render them
              from Server Components.
            </li>
            <li>
              They never touch <code className={inlineCode}>window</code>, <code className={inlineCode}>document</code> or{" "}
              <code className={inlineCode}>localStorage</code> during render, so server rendering is safe.
            </li>
            <li>
              <code className={inlineCode}>create-next-app</code> already sets the <code className={inlineCode}>@/*</code> alias; run{" "}
              <code className={inlineCode}>shadcn init</code> and add components.
            </li>
          </ul>
        </Prose>
      </DocSection>

      <DocSection id="vite" title="Vite">
        <Prose>
          <p>
            Set up Tailwind v4 with <code className={inlineCode}>@tailwindcss/vite</code> and the <code className={inlineCode}>@</code> alias before running{" "}
            <code className={inlineCode}>shadcn init</code>, as the shadcn Vite guide describes. The <code className={inlineCode}>&quot;use client&quot;</code>{" "}
            lines are harmless outside Next.js.
          </p>
        </Prose>
        <CodeBlock lineNumbers={false} files={[code("vite.config.ts", viteConfig), code("tsconfig.json", tsPaths)]} />
      </DocSection>

      <DocSection id="server" title="Guard rails, not enforcement">
        <Note tone="brand">
          Bollard UI components catch honest mistakes in the browser. They don&apos;t replace server-side validation, authorization, rate limits, idempotency
          keys or database constraints, and anyone can bypass client code. Pages for security, payment and destructive components say what the server still
          has to enforce. See also{" "}
          <Link className={proseLink} href="/security">
            Security
          </Link>
          .
        </Note>
        <p className="text-sm text-muted-foreground">
          Not sure where to begin?{" "}
          <Link className={proseLink} href="/start-here">
            Start here
          </Link>{" "}
          has the essentials, or{" "}
          <Link className={proseLink} href="/components">
            browse every component
          </Link>
          .
        </p>
      </DocSection>
    </DocPage>
  )
}
