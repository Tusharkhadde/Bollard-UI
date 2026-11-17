import type { Metadata } from "next"

import { RichGuideArticle } from "@/components/site/rich-guide"

const title = "React Type to Confirm Dialogs for Safety"
const description = "Build a React type-to-confirm dialog that names the exact destructive target, supports keyboard users and keeps authorization on the server."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/react-type-to-confirm-dialog" },
  openGraph: { title: `${title} | Bollard UI`, description, url: "/guides/react-type-to-confirm-dialog", type: "article" },
  twitter: { title: `${title} | Bollard UI`, description, card: "summary_large_image" },
}

const sections = [
  {
    title: "Make the consequence concrete",
    paragraphs: [
      "A destructive-action dialog often asks only “Are you sure?” That question is easy to dismiss because it does not say which project, account, environment or set of records will change. A stronger confirmation repeats the target and consequence in plain language. For a repository deletion, name the repository and say whether issues, releases and settings are removed too. For a workspace deletion, explain what happens to members and billing records.",
      "Typing the target can help when the action is hard to reverse or the user is likely to act on the wrong row. It adds friction, so reserve it for actions where the cost of a mistaken click is meaningful. A normal confirmation button or undo window may be a better fit for a reversible archive or a low-impact preference change.",
    ],
  },
  {
    title: "Bind confirmation to the exact action",
    paragraphs: [
      "The phrase should identify the object the application will actually mutate. Use a stable, human-readable name such as a repository slug or account email. If that target changes while the dialog is open, update the phrase and require a fresh match. Avoid generic phrases like DELETE when they do not help the person distinguish one target from another.",
      "The following example passes a target into the dialog and keeps the action itself in the application. Bollard provides the review surface and input matching; it does not perform the deletion or decide who is allowed to do it.",
    ],
    code: { filename: "DeleteRepository.tsx", source: `import * as React from "react"\nimport { TypeToConfirm } from "@/components/ui/type-to-confirm"\n\nexport function DeleteRepository({ repository }) {\n  const [open, setOpen] = React.useState(false)\n\n  async function removeRepository() {\n    await fetch(\"/api/repositories/\" + repository.id, { method: \"DELETE\" })\n    setOpen(false)\n  }\n\n  return (\n    <>\n      <button type=\"button\" onClick={() => setOpen(true)}>Delete repository</button>\n      <TypeToConfirm\n        open={open}\n        onOpenChange={setOpen}\n        phrase={repository.slug}\n        description={\`Permanently deletes \${repository.slug} and its issues.\`}\n        onConfirm={removeRepository}\n      />\n    </>\n  )\n}` },
  },
  {
    title: "Keep the server as the authority",
    paragraphs: [
      "A matching phrase is a user-interface signal, not authorization. The DELETE endpoint must authenticate the caller, check that they can delete this particular repository, enforce any organization policy, and reject stale or already-deleted targets. Do not trust a client-supplied “confirmed” flag as proof that a human reviewed the action. The server should derive the target from a protected identifier and record who requested the change.",
      "For high-impact operations, bind any approval record to the exact actor, target, action and relevant version. Re-check permissions at execution time because a role or resource can change between opening the dialog and submitting it. Use an idempotent operation or request key if a retry could otherwise apply the deletion twice.",
    ],
  },
  {
    title: "Handle escape, cancellation and focus deliberately",
    paragraphs: [
      "A safe dialog still needs a straightforward way out. Keep the cancel action visible, allow the Escape key unless your product has a carefully justified reason not to, and return focus to the control that opened the dialog. The text field needs an accessible name and the instructions should explain exactly what to type. When the phrase does not match, state that clearly and keep the destructive action disabled.",
      "Do not rely on color or a warning icon to communicate danger. Include the target and consequence as text, preserve a sensible tab order, and check that errors are announced without moving focus unexpectedly. Test at narrow widths so a long target name wraps and remains readable instead of being clipped.",
    ],
  },
  {
    title: "Choose confirmation strength by reversibility",
    paragraphs: [
      "Use type-to-confirm when the target is easy to confuse and the impact is difficult to reverse. A hold action can make sense for a single high-impact button where accidental activation is the main risk. An undo pattern is often kinder for actions that can be safely reversed for a short period. These patterns address different failure modes; adding every delay and confirmation to every action teaches people to ignore them.",
      "After confirmation, report the outcome and the next step. If deletion is asynchronous, show a pending state and prevent duplicate requests. If the server rejects the action, preserve context and explain what permission or state must change. If the action succeeded, do not leave an enabled dialog that could submit it again.",
    ],
  },
  {
    title: "Review the interaction before shipping",
    paragraphs: [
      "Walk through a correct phrase, a near match, a changed target, cancellation, keyboard-only use, a slow network and a server-side permission denial. Include a long target and a target containing punctuation so matching behavior is predictable. Confirm that analytics do not capture the phrase if it could contain personal or sensitive data.",
      "Install the component with the shadcn registry command, then adapt its copy to the product’s real consequences. The component is one part of a safe workflow: the service that owns the resource still needs to validate and execute the operation securely.",
    ],
  },
]

export default function TypeToConfirmGuide() {
  return <RichGuideArticle title={title} lead="Use a type-to-confirm dialog when a destructive action is consequential and the target is easy to confuse. Make the review specific, accessible and backed by server-side checks." sections={sections} components={[{ name: "type-to-confirm", label: "Type to Confirm" }, { name: "account-deletion-readback", label: "Account Deletion Readback" }, { name: "undo-toast", label: "Undo Toast" }]} />
}
