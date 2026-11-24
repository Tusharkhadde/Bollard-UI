# Early user interview kit

Goal: speak with ten React product engineers who recently shipped a payment, destructive account action, or AI-agent workflow. Learn which mistakes are painful enough to justify adding a guard rail.

## Recruiting note

> I am building Bollard UI, copy-paste React guard rails for costly form mistakes and agent actions. I am looking for a 20-minute conversation about a recent workflow where users made a mistake, double-submitted, deleted the wrong thing, or needed to approve an automated action. This is research, not a sales call. I will share the relevant component recipe afterwards if it is useful.

## Interview flow

1. What was the last form or action in your product that caused an avoidable support ticket, incident, or user correction?
2. Walk me through what the person saw and did. Where did they first realize the mistake?
3. What does the current UI do to prevent or recover from it?
4. What would make you hesitate to add a client-side guard rail to that flow?
5. Would you prefer a copied component, a headless hook, or a pattern you rebuild yourself? Why?
6. If an AI agent can take this action, where should a human approval step appear?
7. What exact words would you search to solve this problem?
8. Can I follow up with a runnable example after this call?

## Notes template

| Interview | Workflow | Mistake | Existing mitigation | Preferred integration | Search language | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |
| 04 |  |  |  |  |  |  |
| 05 |  |  |  |  |  |  |
| 06 |  |  |  |  |  |  |
| 07 |  |  |  |  |  |  |
| 08 |  |  |  |  |  |  |
| 09 |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |

## Decision rule after ten interviews

Promote the problem that appears in at least three conversations, has a clear existing workaround, and can be shown with a short before-and-after demo. Do not claim impact numbers or publish company names without written permission.
