import { type CatalogEntry, readProps } from "./catalog"

export type ComponentFaq = {
  question: string
  answer: string
}

function cleanPhrase(text?: string): string {
  if (!text) return "accidental form input errors"
  const cleaned = text
    .replace(/^helps prevent\s+/i, "")
    .replace(/^stops\s+/i, "")
    .replace(/^prevents\s+/i, "")
    .trim()
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
}

/**
 * Generates 4-6 unique, fact-based Q&A items for each component.
 * Uses category-aware phrasing, mistakes prevented, props, and dependencies
 * to ensure rich diversity across 341 components and avoid boilerplate repetition.
 */
export function getComponentFaqs(item: CatalogEntry): ComponentFaq[] {
  const stopPhrase = cleanPhrase(item.stops || item.summary || item.description)
  const propsDoc = readProps(item.name)
  const props = propsDoc?.props ?? []
  const propNames = props.slice(0, 5).map((p) => `\`${p.name}\``)
  const category = (item.category || "").toLowerCase()
  const name = item.name
  const mistakes = item.mistakes ?? []
  const catches = item.catches ?? []
  const limits = item.limits ?? []
  const a11y = item.a11y ?? []
  const server = item.server ?? ""
  const flows = item.flows ?? []
  const aliases = item.aliases ?? []
  const summary = item.summary ?? ""
  const deps = item.dependencies ?? []
  const files = item.files ?? []

  const faqs: ComponentFaq[] = []

  // Q1: Specialized problem solved
  if (category.includes("agent") || name.includes("agent") || name.includes("tool")) {
    faqs.push({
      question: `How does ${item.title} protect AI agent operations?`,
      answer: `${item.title} stops ${stopPhrase}. ${summary} It validates autonomous actions against ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: verify ${name} policies at server boundary.`,
    })
  } else if (flows.includes("india") || name.includes("ifsc") || name.includes("upi") || name.includes("gst") || name.includes("aadhaar")) {
    faqs.push({
      question: `How does ${item.title} validate Indian financial identifiers?`,
      answer: `${item.title} stops ${stopPhrase}. Complies with national standards for ${catches.join(", ") || mistakes.join(", ") || aliases.join(", ")}. Limitation: verify ${name} with issuer gateway.`,
    })
  } else if (category.includes("destructive") || name.includes("delete") || name.includes("confirm")) {
    faqs.push({
      question: `How does ${item.title} protect destructive mutations?`,
      answer: `${item.title} prevents ${stopPhrase}. Enforces deliberate friction against ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: authorize ${name} mutations on the server.`,
    })
  } else if (flows.includes("checkout") || category.includes("payment") || name.includes("amount") || name.includes("price")) {
    faqs.push({
      question: `How does ${item.title} prevent financial transaction errors?`,
      answer: `${item.title} prevents ${stopPhrase}. Blocks ${catches.join(", ") || mistakes.join(", ") || "billing errors"} before processing. Limitation: apply idempotency keys for ${name}.`,
    })
  } else if (flows.includes("scheduling") || name.includes("date") || name.includes("time")) {
    faqs.push({
      question: `How does ${item.title} handle date and time accuracy?`,
      answer: `${item.title} catches ${stopPhrase}. Validates calendar constraints: ${catches.join(", ") || mistakes.join(", ") || name}. Limitation: match ${name} with server timezone.`,
    })
  } else {
    faqs.push({
      question: `What form validation mistake does ${item.title} catch?`,
      answer: `${item.title} prevents ${stopPhrase}. ${summary} Catches: ${catches.join(", ") || mistakes.join(", ") || item.description}. Limitation: validate ${name} schemas on backend.`,
    })
  }

  // Q2: Installation
  faqs.push({
    question: `How do I install ${item.name} with shadcn?`,
    answer: `Run \`npx shadcn@4.21.0 add @bollard/${item.name}\`. Sources added: ${files.join(", ") || item.name}. Package requirements: ${deps.join(", ") || `zero dependencies for ${name}`}.`,
  })

  // Q3: Props or Hook usage
  if (item.integration === "headless" || name.startsWith("use-")) {
    faqs.push({
      question: `How do I consume the ${item.name} hook?`,
      answer: `Import { ${item.title.replace(/\s+/g, "")} } from "@/components/ui/${item.name}". Returns form bindings and error states. Supports props: ${propNames.join(", ") || "default options"}. Limitation: headless hook requires connecting your own UI components.`,
    })
  } else {
    faqs.push({
      question: `What props customize ${item.title}?`,
      answer: `${item.title} accepts ${propNames.join(", ") || "custom UI props"}. Configures ${aliases.slice(0, 3).join(", ") || item.name} behavior. Limitation: invalid prop values fallback to safe default options.`,
    })
  }

  // Q4: Operational boundaries
  faqs.push({
    question: `What are the limits of ${item.name}?`,
    answer: `${limits.join(". ") || `${item.title} operates in browser client.`} Server requirement: ${server || `backend verification for ${name}.`}`,
  })

  // Q5: Accessibility or Error recovery
  if (a11y.length > 0) {
    faqs.push({
      question: `How does ${item.title} meet accessibility guidelines?`,
      answer: `${a11y.join(". ")}. Minimizes errors: ${mistakes.slice(0, 2).join(", ") || stopPhrase}.`,
    })
  } else {
    faqs.push({
      question: `What user errors does ${item.title} flag?`,
      answer: `${item.title} flags ${mistakes.slice(0, 3).join(", ") || stopPhrase} during user interaction.`,
    })
  }

  return faqs
}
