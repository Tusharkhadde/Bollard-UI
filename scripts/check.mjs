// Visual + runtime check for one or more demos in a real browser.
// Usage: node scripts/check.mjs <port> <name> [name...]
// Needs a running server (npx next dev -p <port>). Set CHROMIUM_PATH to use a system browser. Writes screenshots to .checks/<name>-{light,dark}.png
// and prints console errors, page errors and horizontal overflow per demo.
import fs from "node:fs"
import { chromium } from "playwright"

const [port, ...names] = process.argv.slice(2)
fs.mkdirSync(".checks", { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] })
for (const name of names) {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: Number(process.env.WIDTH || 900), height: 900 } })
    const errors = []
    page.on("console", (msg) => msg.type() === "error" && !msg.text().startsWith("Failed to load resource") && errors.push(msg.text()))
    page.on("response", (res) => res.status() >= 400 && !res.url().includes("favicon") && errors.push(`${res.status()} ${res.url()}`))
    page.on("pageerror", (err) => errors.push(String(err)))
    await page.goto(`http://localhost:${port}/preview/${name}?theme=${theme}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(600)
    const box = page.locator(`[data-preview="${name}"]`)
    const overflow = await box.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    await box.screenshot({ path: `.checks/${name}-${theme}.png` })
    console.log(`${name} ${theme}: ${errors.length ? "ERRORS " + errors.join(" | ") : "no errors"}${overflow ? " · OVERFLOW" : ""}`)
    await page.close()
  }
}
await browser.close()
