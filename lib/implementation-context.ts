export type ImplementationContextInput = {
  name: string
  title: string
  targets: string[]
  dependencies: string[]
  registryDependencies: string[]
  usage: string
  propNames: string[]
  limitations?: string[]
  serverGuidance?: string
}

/** Build a portable, privacy-safe handoff for an AI coding assistant. */
export function buildImplementationContext(input: ImplementationContextInput) {
  const install = `npx shadcn@4.21.0 add @bollard/${input.name}`
  return [
    `Implementation context: ${input.title} (${input.name})`,
    `Install: ${install}`,
    `Intended files: ${input.targets.length ? input.targets.join(", ") : "provided by the registry item"}`,
    `Runtime dependencies: ${input.dependencies.length ? input.dependencies.join(", ") : "none"}`,
    `Bollard registry dependencies: ${input.registryDependencies.length ? input.registryDependencies.join(", ") : "none"}`,
    `Usage example:\n${input.usage.trim()}`,
    `Public props: ${input.propNames.length ? input.propNames.join(", ") : "see component source"}`,
    ...(input.limitations?.length ? [`Limitations: ${input.limitations.join(" ")}`] : []),
    ...(input.serverGuidance ? [`Server enforcement: ${input.serverGuidance}`] : []),
  ].join("\n")
}
