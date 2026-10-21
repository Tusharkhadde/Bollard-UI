import fs from "node:fs"
import path from "node:path"

export const REGISTRY_URL = "https://bollard-ui.vercel.app/r/{name}.json"

export function readConfig(cwd) {
  const file = path.join(cwd, "components.json")
  if (!fs.existsSync(file)) return { file, config: null }
  try {
    const config = JSON.parse(fs.readFileSync(file, "utf8"))
    if (!config || Array.isArray(config) || typeof config !== "object") throw new Error("expected a JSON object")
    return { file, config }
  } catch (error) {
    throw new Error(`Could not read ${file}: ${error.message}`)
  }
}

export function withBollardRegistry(config) {
  const current = config.registries?.["@bollard"]
  if (current && current !== REGISTRY_URL) {
    throw new Error(`@bollard is already configured with a different URL. Review components.json and set it to ${REGISTRY_URL} if you want the Bollard registry.`)
  }
  return { ...config, registries: { ...config.registries, "@bollard": REGISTRY_URL } }
}

export function writeConfig(file, config) {
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" })
  try {
    fs.renameSync(temp, file)
  } catch (error) {
    fs.rmSync(temp, { force: true })
    throw error
  }
}
