/** Map source imports to the targets used by shadcn's registry installer. */
export function toInstalledImport(specifier: string) {
  return specifier.replace(/@\/registry\/default\/([\w-]+)\/([\w.-]+)/g, (_match, component: string, file: string) => {
    const stem = file.replace(/\.(?:tsx?|jsx?)$/, "")
    return stem === component ? `@/components/ui/${stem}` : `@/components/${component}/${file}`
  })
}
