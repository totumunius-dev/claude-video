# NOVA_OS Command Deck

Functional Phase 2 of the Command Deck: a primary assistant (Core) that delegates
to companions, shares a Brain, runs work in parallel, and chains delegations.
Everything runs in **Preview Mode** on mock data. No real Gmail, Slack, Shopify,
or Calendar connection is made.

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run typecheck
npm test
npm run build
```

## Voice and Claude

- **Talks:** replies are read aloud with the browser's built-in voice (🔊 in the chat header turns it off).
- **Thinks:** when the page runs as a claude.ai artifact, Core and the companions use the viewer's own
  Claude through the `sample` capability (`src/ai/`). Core sees the workspace (goal, memory, roster,
  Brain, open work) and acts only through tools that call the app's own flows: delegate, dispatch,
  run the research chain, open the Companion Builder, connect Gmail, draft an email for approval,
  remember a fact, read a Brain entry. Open-ended delegations and direct questions are answered by
  the model; the named demo playbooks stay deterministic. The header shows **CLAUDE** when this is on.
  Anywhere else (including `npm run dev`) it shows **QUICK COMMANDS** and uses the keyword router.
- **Hears:** the mic uses the browser's speech recognition (Chrome, Edge, Safari). Artifacts are not
  allowed a microphone, so there the mic falls back to demo voice. **HANDS-FREE** listens again after
  each spoken reply when a real microphone is available.

## Try it

Open the chat's **+** menu, or tap the mic for a mock voice turn that "hears" the
next demo command:

1. What is missing from my team for a product launch?
2. Create that companion.
3. Send a delegation to Community to create a launch-day customer feedback strategy.
4. Connect my Gmail.
5. Email Michael about the launch momentum and Community being onboarded.
6. Send a dispatch to every companion. (Counsel fails on purpose to show partial failure; use Retry.)
7. Have Marketer ask Scout to research competitors and turn the findings into campaign ideas.
8. Ask Builder to review the Community strategy before preparing a roadmap.

Then open **Knowledge View** (Brain) for folder and graph views, and **Memory** to
edit or forget context, export the Brain, or reset Preview data.

## How it fits together

```
ChatPanel ──► core/conductor.ts ──► core/intents.ts      (keyword router; swap for a model later)
                    │
                    ├─► core/engine.ts      delegations, chains, dispatch, sub-agents, retry
                    │       └─► core/playbooks.ts   what each mock task does and produces
                    ├─► core/companions.ts  Companion Builder: draft, test, activate
                    ├─► core/gmail.ts       Gmail auth flow + email approvals
                    └─► core/knowledge.ts   folder-scoped retrieval + graph building

integrations/types.ts          IntegrationProvider interface (Composio or OAuth can implement it)
integrations/mockProviders.ts  Preview Mode providers; "send" returns MOCK_SENT

state/*Store.ts   one zustand slice per concern, persisted to localStorage under nova.deck.v1.*
  uiStore (not persisted) · conversationStore · companionStore · delegationStore
  knowledgeStore · integrationStore · approvalStore · contextStore · activityStore
```

The Command Deck panels read the same slices the conductor writes:

| Panel | Reads |
|---|---|
| Active Flows | `delegationStore.flows` + delegation progress |
| Agent Roster, chat tabs | `companionStore` (status, current task) |
| Live Activity / Execution Log | `activityStore` (user-facing events only, never model reasoning) + running delegations and sub-agent tree |
| Orb | conversation voice state + busy companions |
| Brain | `knowledgeStore` |
| Integrations | `integrationStore` + `approvalStore` |

Companions only read Brain folders listed in their `knowledgeFolders`; every
delegation starts with that retrieval step, and results show **Knowledge used**
and **Saved to Brain** links.

After a refresh, simulated work that was mid-flight is marked FAILED
("Interrupted by page refresh") with a Retry button; everything else is restored.
