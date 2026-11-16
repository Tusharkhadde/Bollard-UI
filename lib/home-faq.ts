export const HOME_FAQS = [
  {
    question: "What is Bollard UI?",
    answer: "Bollard UI is a library of copy-paste React components that help prevent mistakes in forms and critical actions, plus a headless validation hook for your existing controls.",
  },
  {
    question: "How do the guardrails prevent mistakes?",
    answer: "They make risky inputs and actions easier to review with clear readbacks, validation, pending states, confirmations and recovery paths. Your app still owns server-side validation and authorization.",
  },
  {
    question: "Is it free?",
    answer: "Yes. Every component is MIT licensed, free for personal and commercial projects. Keep the license notice and do what you like with the code.",
  },
  {
    question: "Does it need shadcn/ui?",
    answer: "It needs a shadcn setup, not shadcn's components. The CLI uses your Tailwind v4 theme and copies the code into your app.",
  },
  {
    question: "How do I add a component?",
    answer: "Run its shadcn CLI command. The source is copied into your project, and any extra dependencies are listed for you.",
  },
  {
    question: "Does it work with Next.js, Vite and Remix?",
    answer: "Yes. It targets React 19 and Tailwind v4 with TypeScript-friendly source, and components are safe to render on the server.",
  },
  {
    question: "Can I customise it?",
    answer: "Yes. The copied source belongs to your app: edit its styles, behavior and copy to fit your product.",
  },
] as const
