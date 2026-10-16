// Bollard UI — package-name-check · MIT licence · https://bollard-ui.vercel.app/components/package-name-check

/**
 * Install commands and package names checked for typosquats and lookalikes.
 * Rules: npm package names (https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name),
 * PyPI name normalization (https://packaging.python.org/en/latest/specifications/name-normalization/).
 * Real incidents behind the lookalike rules: crossenv / cross-env.js / babelcli on npm (2017),
 * colourama, jeIlyfish and python3-dateutil on PyPI.
 */

export type Ecosystem = "npm" | "pypi"

/** A curated sample of the most-installed packages, the names squatters imitate. Pass your own to extend it. */
export const POPULAR_PACKAGES: Record<Ecosystem, string[]> = {
  npm: ["react", "react-dom", "preact", "next", "vue", "svelte", "angular", "express", "lodash", "lodash-es", "axios", "chalk", "commander", "debug", "dotenv", "cross-env", "typescript", "eslint", "prettier", "webpack", "vite", "babel-cli", "@babel/core", "@babel/cli", "jest", "mocha", "chai", "vitest", "moment", "dayjs", "date-fns", "uuid", "nanoid", "jsonwebtoken", "bcrypt", "bcryptjs", "mongoose", "mongodb", "mysql", "mysql2", "pg", "redis", "ioredis", "prisma", "@prisma/client", "sequelize", "knex", "socket.io", "ws", "body-parser", "cors", "helmet", "morgan", "multer", "nodemon", "jquery", "bootstrap", "tailwindcss", "postcss", "autoprefixer", "sass", "styled-components", "classnames", "clsx", "zod", "yup", "joi", "rxjs", "redux", "@reduxjs/toolkit", "zustand", "react-router", "react-router-dom", "react-query", "@tanstack/react-query", "graphql", "apollo-server", "electron", "puppeteer", "playwright", "cheerio", "node-fetch", "got", "request", "async", "bluebird", "underscore", "ramda", "immer", "yargs", "inquirer", "ora", "glob", "rimraf", "mkdirp", "fs-extra", "semver", "minimist", "colors", "nodemailer", "stripe", "firebase", "aws-sdk", "openai", "discord.js", "d3", "three", "chart.js", "fabric", "ethers", "web3", "coffee-script", "gulp", "grunt", "grunt-cli", "ffmpeg", "sharp", "jimp", "qs", "cookie-parser", "passport", "winston", "pino", "esbuild", "rollup", "turbo", "lerna", "husky", "lint-staged", "yarn", "pnpm", "tslint", "@types/node", "@types/react", "react-native", "@angular/core", "@nestjs/core", "@vue/cli", "create-react-app", "create-next-app", "JSONStream"],
  pypi: ["requests", "urllib3", "numpy", "pandas", "scipy", "matplotlib", "seaborn", "scikit-learn", "scikit-image", "tensorflow", "torch", "torchvision", "keras", "transformers", "openai", "anthropic", "langchain", "flask", "django", "fastapi", "uvicorn", "gunicorn", "starlette", "pydantic", "sqlalchemy", "psycopg2", "psycopg2-binary", "psycopg", "pymysql", "mysqlclient", "pymongo", "redis", "celery", "boto3", "botocore", "awscli", "pillow", "opencv-python", "beautifulsoup4", "lxml", "selenium", "scrapy", "pyyaml", "python-dotenv", "python-dateutil", "pytz", "setuptools", "wheel", "pip", "virtualenv", "pytest", "tox", "black", "flake8", "mypy", "pylint", "isort", "click", "typer", "rich", "colorama", "tqdm", "jinja2", "markupsafe", "cryptography", "pycryptodome", "pyjwt", "bcrypt", "paramiko", "httpx", "aiohttp", "websockets", "six", "attrs", "jellyfish", "pyopenssl", "certifi", "idna", "charset-normalizer", "packaging", "pyparsing", "jsonschema", "toml", "tomli", "protobuf", "grpcio", "google-api-python-client", "python-telegram-bot", "discord.py", "tweepy", "pygame", "pyserial", "python-docx", "openpyxl", "xlrd", "pypdf", "pymupdf", "gitpython", "docker", "kubernetes", "ansible", "fabric", "nltk", "spacy", "gensim", "networkx", "sympy", "plotly", "dash", "streamlit", "gradio", "jupyter", "notebook", "ipython", "pyinstaller", "python-magic", "dask", "scapy", "numba", "boto", "polars", "pyarrow"],
}

/** Import names that aren't the name you install, and the PyPI package that provides them. */
export const PYPI_IMPORT_NAMES: Record<string, string> = {
  sklearn: "scikit-learn",
  skimage: "scikit-image",
  cv2: "opencv-python",
  pil: "pillow",
  yaml: "pyyaml",
  bs4: "beautifulsoup4",
  dotenv: "python-dotenv",
  dateutil: "python-dateutil",
  jwt: "pyjwt",
  crypto: "pycryptodome",
  fitz: "pymupdf",
  docx: "python-docx",
  serial: "pyserial",
  telegram: "python-telegram-bot",
  discord: "discord.py",
  mysqldb: "mysqlclient",
  openssl: "pyopenssl",
  git: "gitpython",
  magic: "python-magic",
  attr: "attrs",
}

/** Standard-library modules people try to pip install. */
export const PYTHON_STDLIB = ["json", "os", "sys", "re", "math", "random", "datetime", "time", "sqlite3", "asyncio", "typing", "logging", "uuid", "argparse", "csv", "collections", "subprocess", "hashlib", "pathlib", "urllib", "smtplib", "tkinter", "threading", "multiprocessing", "unittest", "itertools", "functools", "socket", "statistics", "base64", "pickle", "shutil", "glob", "zipfile", "secrets", "decimal", "enum", "dataclasses", "venv", "email", "http"]
/** Node.js built-in modules people try to npm install. */
export const NODE_BUILTINS = ["fs", "path", "crypto", "http", "https", "os", "events", "stream", "util", "url", "child_process", "buffer", "assert", "zlib", "net", "dns", "readline", "querystring", "process", "timers", "cluster", "worker_threads", "perf_hooks", "tls", "dgram", "vm", "punycode", "string_decoder"]

export interface PackageRef {
  /** The name as written (without version or extras). */
  name: string
  /** The whole token it came from, for replacing it. */
  token: string
  /** What followed the name: @^4, ==2.31.0, [socks]>=2. */
  spec: string
  /** 0-based line the token is on. */
  line: number
  /** Character offset of the token in the original text. */
  start: number
}
export interface ParsedInstall {
  ecosystem: Ecosystem
  /** True when the ecosystem came from the command (npm i, pip install…) rather than the default. */
  detected: boolean
  packages: PackageRef[]
}

export type PackageVerdictKind =
  | "ok"
  | "invalid"
  | "uppercase"
  | "builtin"
  | "import-name"
  | "separator"
  | "lookalike-chars"
  | "typo"
  | "affix"
  | "missing"
  | "new"
  | "unchecked"
export interface PackageVerdict {
  ref: PackageRef
  kind: PackageVerdictKind
  severity: "error" | "warning" | "info" | "ok"
  /** The package probably meant, when there's one to switch to. */
  suggestion?: string
  detail: Record<string, string>
}

const NPM_COMMAND = /^(?:npm|pnpm|yarn|bun|npx|pnpx|bunx)$/
const PIP_COMMAND = /^(?:pip3?(?:\.\d+)?|uv|poetry|pipx|conda|python3?(?:\.\d+)?)$/
const VERBS = /^(?:i|in|ins|install|add|isntall)$/
// npx foo, pnpm dlx foo, npm exec foo, yarn dlx foo: only the first name is a package; the rest are its arguments.
const RUN_ONE = /^(?:npx|pnpx|bunx)$/
const RUN_VERBS = /^(?:exec|dlx|x)$/
const FLAG_WITH_ARG = /^-(?:r|c|e|i|t|-index-url|-extra-index-url|-target|-requirement|-constraint|-prefix|-registry|-tag|-workspace|w)$/

/** PyPI's normalized form: lowercase, runs of - _ . become one -. */
export function normalizePypi(name: string): string {
  return name.replace(/[-_.]+/g, "-").toLowerCase()
}

/**
 * Splits an install command, a requirements.txt or a plain list into package
 * names, dropping flags, versions, extras, markers, comments, URLs and paths.
 * Handles CRLF, a BOM and several commands joined with && or ;.
 */
export function parseInstall(text: string, fallback: Ecosystem = "npm"): ParsedInstall {
  const source = String(text ?? "").replace(/^\uFEFF/, "")
  let ecosystem = fallback
  let detected = false
  const packages: PackageRef[] = []
  let offset = String(text ?? "").startsWith("\uFEFF") ? 1 : 0
  source.split("\n").forEach((rawLine, line) => {
    const lineText = rawLine.replace(/\r$/, "")
    const content = lineText.replace(/(?:^|\s)#.*$/, "")
    let cursor = 0
    const firstWord = content.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
    // In a requirements line (no command), everything after ; is a PEP 508 environment marker, not another command.
    const requirement = ecosystem === "pypi" && !NPM_COMMAND.test(firstWord) && !PIP_COMMAND.test(firstWord)
    for (const part of requirement ? [content.replace(/\s*;.*$/, "")] : content.split(/(&&|\|\||;)/)) {
      const at = cursor
      cursor += part.length
      if (/^(?:&&|\|\||;)$/.test(part)) continue
      const tokens = [...part.matchAll(/\S+/g)]
      const base = offset + at
      let index = 0
      const first = tokens[0]?.[0]?.toLowerCase() ?? ""
      let single = false
      if (NPM_COMMAND.test(first) || PIP_COMMAND.test(first)) {
        ecosystem = NPM_COMMAND.test(first) ? "npm" : "pypi"
        detected = true
        index = 1
        while (index < tokens.length && /^(?:-m|pip|global)$/.test(tokens[index][0])) index++
        if (RUN_ONE.test(first)) single = true
        else if (index < tokens.length && RUN_VERBS.test(tokens[index][0]) && ecosystem === "npm") {
          single = true
          index++
        } else if (index < tokens.length && VERBS.test(tokens[index][0])) index++
        else continue
      }
      for (; index < tokens.length; index++) {
        const token = tokens[index][0]
        if (token.startsWith("-")) {
          if (FLAG_WITH_ARG.test(token)) index++
          continue
        }
        if (/^(?:https?:|git\+|git:|file:|\.{0,2}\/|~\/|[a-z]:\\)/i.test(token) || /\.(?:whl|tar\.gz|tgz|zip)$/i.test(token)) continue
        const ref = splitSpec(token, ecosystem)
        if (ref.name) packages.push({ ...ref, token, line, start: base + (tokens[index].index ?? 0) })
        if (single) break
      }
    }
    offset += rawLine.length + 1
  })
  return { ecosystem, detected, packages }
}

function splitSpec(token: string, ecosystem: Ecosystem) {
  const clean = token.replace(/^["']|["',]$/g, "")
  if (ecosystem === "npm") {
    const match = /^(@[^/@\s]+\/[^@\s]+|[^@\s]+)(@.*)?$/.exec(clean)
    // An alias (lodash@npm:lodahs) installs the package after npm:, so that's the name to check.
    const alias = /^@npm:(@[^/@\s]+\/[^@\s]+|[^@\s]+)/.exec(match?.[2] ?? "")
    if (alias) return { name: alias[1], spec: (match?.[2] ?? "").slice(5 + alias[1].length) }
    // user/repo is GitHub shorthand, not a registry name.
    if (match && !match[1].startsWith("@") && match[1].includes("/")) return { name: "", spec: "" }
    return { name: match?.[1] ?? "", spec: match?.[2] ?? "" }
  }
  const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)(.*)$/.exec(clean)
  return { name: match?.[1] ?? "", spec: match?.[2] ?? "" }
}

/** Damerau-Levenshtein distance with an early exit above `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// Characters that look alike in many fonts (jeIlyfish = jellyfish with a capital I).
const CONFUSABLE: [RegExp, string][] = [[/[Il1|]/g, "l"], [/0/g, "o"], [/rn/g, "m"], [/vv/g, "w"], [/5/g, "s"]]
const skeleton = (name: string) => CONFUSABLE.reduce((text, [pattern, to]) => text.replace(pattern, to), name).toLowerCase()
const bare = (name: string) => name.toLowerCase().replace(/[-_.]/g, "")
// Patterns from real squats (babelcli, cross-env.js, nodemailer-js, python3-dateutil). Hyphenated -cli/-dev/-utils are left out:
// jest-cli and react-dev-utils are the real thing far more often than not.
const AFFIXES = /^(?:node-|py-|python-|python3-|py3-|js-)|(?:-js|\.js|(?<![-.])js|-node|-py|-python|-python3|(?<![-.])py|(?<![-.])cli)$/

/** Checks one package name against the popular list and the ecosystem's naming rules. */
export function checkPackageName(ref: PackageRef, ecosystem: Ecosystem, popular: string[] = POPULAR_PACKAGES[ecosystem]): PackageVerdict {
  const name = ref.name
  const verdict = (kind: PackageVerdictKind, severity: PackageVerdict["severity"], suggestion?: string, detail: Record<string, string> = {}): PackageVerdict => ({ ref, kind, severity, suggestion, detail: { name, suggestion: suggestion ?? "", ...detail } })
  const key = ecosystem === "pypi" ? normalizePypi(name) : name
  const known = new Map(popular.map((entry) => [ecosystem === "pypi" ? normalizePypi(entry) : entry.toLowerCase(), entry]))

  if (ecosystem === "npm") {
    if (name.length > 214 || /[\s~'!()*]/.test(name) || /^[._]/.test(name) || /[^a-zA-Z0-9@/._-]/.test(name)) return verdict("invalid", "error")
    // New npm packages can't have capitals, but a few old ones do (JSONStream), so this is a warning, not an error.
    if (/[A-Z]/.test(name) && !popular.includes(name)) {
      const lower = name.toLowerCase()
      if (known.has(lower) || !/[Il]/.test(name)) return verdict("uppercase", "warning", lower)
    }
    if (NODE_BUILTINS.includes(name.replace(/^node:/, ""))) return verdict("builtin", "warning")
  } else {
    if (!/^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i.test(name)) return verdict("invalid", "error")
    const alias = PYPI_IMPORT_NAMES[key.replace(/-/g, "")] ?? PYPI_IMPORT_NAMES[key]
    if (alias && normalizePypi(alias) !== key) return verdict("import-name", "warning", alias)
    if (PYTHON_STDLIB.includes(key)) return verdict("builtin", "warning")
  }
  if (known.has(key.toLowerCase())) return verdict("ok", "ok")

  const candidates = [...known.values()]
  const lowered = key.toLowerCase()
  for (const target of candidates) {
    const targetKey = (ecosystem === "pypi" ? normalizePypi(target) : target).toLowerCase()
    if (bare(name) === bare(target) && lowered !== targetKey) return verdict("separator", "warning", target)
  }
  for (const target of candidates) {
    if (skeleton(name) === skeleton(target) && name.toLowerCase() !== target.toLowerCase()) return verdict("lookalike-chars", "error", target)
  }
  // A scoped name is compared whole, and only with other scoped names: @types/react isn't a typo of react.
  const scoped = lowered.startsWith("@")
  const unscoped = lowered
  for (const target of candidates) {
    const t = target.toLowerCase()
    if (t.startsWith("@") !== scoped) continue
    if (t.length < 4 || unscoped.length < 4) continue
    const allowed = t.length >= 8 ? 2 : 1
    if (distance(unscoped, t, allowed) <= allowed && distance(bare(unscoped), bare(t), allowed) <= allowed) return verdict("typo", "warning", target)
  }
  const stripped = unscoped.replace(AFFIXES, "")
  if (stripped !== unscoped && stripped.length >= 3) {
    const target = candidates.find((entry) => bare(entry) === bare(stripped))
    if (target) return verdict("affix", "warning", target)
  }
  return verdict("unchecked", "info")
}

/** What a registry lookup returns. Plug in your own fetch to registry.npmjs.org or pypi.org/pypi/<name>/json. */
export interface PackageInfo {
  /** False when no package by this name exists. */
  exists: boolean
  /** Weekly (npm) or last-month (PyPI) downloads, if known. */
  downloads?: number
  /** When the first version was published. */
  created?: string | number | Date
}

/** Turns a registry answer into a verdict: missing names and brand-new, barely-downloaded ones are flagged. */
export function judgeLookup(base: PackageVerdict, info: PackageInfo | null | undefined, now: number): PackageVerdict {
  if (!info || base.severity === "error") return base
  if (!info.exists) return { ...base, kind: "missing", severity: "error", detail: { ...base.detail } }
  const created = info.created !== undefined ? new Date(info.created).getTime() : NaN
  const days = Number.isFinite(created) ? Math.floor((now - created) / 86_400_000) : NaN
  if (base.kind !== "ok" && Number.isFinite(days) && days < 90 && (info.downloads ?? 0) < 1000) {
    return { ...base, kind: "new", severity: "error", detail: { ...base.detail, days: String(Math.max(0, days)), downloads: (info.downloads ?? 0).toLocaleString("en-US") } }
  }
  // A lookalike that is itself long-established (preact next to react) isn't a squat.
  if (base.kind === "unchecked" || ((info.downloads ?? 0) >= 100_000 && ["typo", "affix", "separator", "uppercase"].includes(base.kind))) return { ...base, kind: "ok", severity: "ok" }
  return base
}

/** Replaces one package token in the text, keeping its version or extras. */
export function replacePackage(text: string, ref: PackageRef, name: string): string {
  return text.slice(0, ref.start) + ref.token.replace(ref.name, name) + text.slice(ref.start + ref.token.length)
}
