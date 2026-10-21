import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import net from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { chromium } from "playwright"

const port = await new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    server.close(() => resolve(address.port))
  })
})
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "ignore", env: { ...process.env, NODE_ENV: "production" } })
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await fetch(`${base}/playground`)).ok } catch { /* server is still starting */ }
    if (ready) break
    await delay(500)
  }
  assert.ok(ready, "production server did not become ready")
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce", colorScheme: "light" })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`${base}/playground`)
  await page.getByRole("button", { name: "Add extra 0" }).focus()
  await page.keyboard.press("Space")
  await page.getByText("1 mistakes caught").waitFor()
  await page.getByLabel("Amount (₹)").waitFor()
  assert.match(await page.getByLabel("Amount (₹)").inputValue(), /1,00,000/)
  await page.getByText(/Extra zero\?/).waitFor()
  await page.goto(`${base}/components`)
  const packCheckbox = page.getByRole("checkbox", { name: "Add Amount Input to custom pack" }).first()
  await packCheckbox.focus()
  await page.keyboard.press("Space")
  await page.getByText("1 selected").waitFor()
  await page.goto(`${base}/components/amount-input`)
  await page.getByRole("button", { name: "Preview in dark mode" }).click()
  await page.locator('[data-preview-surface="dark"]').waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 })
    await page.evaluate(() => window.scrollTo(0, 0))
    const measurements = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll("body *")].map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 80) : "",
        text: element.textContent?.trim().slice(0, 40),
        right: Math.round(element.getBoundingClientRect().right),
      })).filter((element) => element.right > window.innerWidth + 2).slice(0, 6),
    }))
    assert.ok(measurements.documentWidth <= width, `component docs overflow at ${width}px: ${JSON.stringify(measurements)}`)
  }
  assert.deepEqual(errors, [], "browser reported uncaught errors")
  console.log("Browser journeys passed: playground keyboard guard, amount readback, custom-pack keyboard selection, preview theme and 320–1440px layout checks.")
} finally {
  await browser?.close()
  server.kill()
}
