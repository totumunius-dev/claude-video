import type { Companion, DelegationResult, KnowledgeEntry, KnowledgeFolder, PlaybookKind } from "../types/models";

export interface PlaybookContext {
  companion: Companion;
  instruction: string;
  knowledge: KnowledgeEntry[];
  inputs: DelegationResult[];
  subAgentResults: string[];
}

export interface EntryDraft {
  title: string;
  summary: string;
  content: string[];
  folder: KnowledgeFolder;
  tags: string[];
  /** Existing entries that should point at the new one in the graph. */
  linkFrom: string[];
  /** Existing entries the new one should point at. */
  linkTo: string[];
}

export interface Production {
  summary: string;
  bullets: string[];
  entry?: EntryDraft;
}

export interface Playbook {
  steps: string[];
  durationMs: number;
  folders?: KnowledgeFolder[];
  terms: string[];
  subAgents?: { name: string; result: string; durationMs: number }[];
  produce(ctx: PlaybookContext): Production;
}

const FEEDBACK_ENTRY_TITLE = "Product Launch Customer Voice Strategy";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const PLAYBOOKS: Record<PlaybookKind, Playbook> = {
  "feedback-strategy": {
    steps: ["Search the Brain", "Review launch goal and roadmap", "Design outreach and feedback tiers", "Write the strategy"],
    durationMs: 5200,
    terms: ["launch", "roadmap", "goal", "feedback", "metrics"],
    produce: ({ knowledge }) => ({
      summary: "Launch-day customer feedback strategy is ready and saved to Strategy.",
      bullets: [
        "Personal outreach to early users",
        "Tiered feedback collection",
        "Feature prioritization by impact and frequency",
        "Weekly feedback synthesis",
      ],
      entry: {
        title: FEEDBACK_ENTRY_TITLE,
        summary: "How we hear from users on launch day and turn their feedback into roadmap decisions.",
        content: [
          "Personal outreach to early users: a founder note to the first 100 beta users with a 15-minute call link",
          "Tiered feedback collection: in-app quick reactions, a short survey on day 3, and interviews for power users",
          "Feature prioritization by impact and frequency: score each request by users affected and severity",
          "Weekly feedback synthesis: one Brain entry every Friday shared with Builder and Marketer",
        ],
        folder: "Strategy",
        tags: ["launch", "feedback", "customer-voice", "strategy"],
        linkFrom: [],
        linkTo: knowledge.some((k) => k.id === "kb-roadmap") ? ["kb-roadmap"] : [],
      },
    }),
  },

  "roadmap-review": {
    steps: ["Search Product and Strategy entries", "Review roadmap against customer feedback", "Prepare next week's build plan"],
    durationMs: 4200,
    folders: ["Product", "Strategy"],
    terms: ["roadmap", "feedback", "customer", "strategy", "launch"],
    produce: ({ knowledge }) => {
      const strategy = knowledge.find((k) => k.title === FEEDBACK_ENTRY_TITLE);
      const bullets = strategy
        ? [
            `Add an in-app feedback widget (from "${strategy.title}": tiered feedback collection)`,
            "Reserve 20% of the sprint for the highest impact x frequency fixes",
            "Ship a Friday feedback digest into the Brain for the whole team",
            "Keep the Week 5-6 Brain graph and export work on schedule",
          ]
        : [
            "No customer feedback strategy found in Product or Strategy yet",
            "Plan follows the existing roadmap; revisit once Community reports",
            "Keep the Week 5-6 Brain graph and export work on schedule",
          ];
      return {
        summary: strategy
          ? "Build plan for next week is ready. It folds in Community's customer voice strategy."
          : "Build plan is ready, but there was no customer feedback strategy to build from.",
        bullets,
        entry: {
          title: "Next Week Build Plan",
          summary: "Engineering priorities for launch week, shaped by customer feedback.",
          content: bullets,
          folder: "Product",
          tags: ["roadmap", "build-plan", "launch"],
          linkFrom: [...(strategy ? [strategy.id] : []), ...(knowledge.some((k) => k.id === "kb-roadmap") ? ["kb-roadmap"] : [])],
          linkTo: [],
        },
      };
    },
  },

  "competitor-research": {
    steps: ["Search the Brain", "Launch research workers", "Merge and validate findings", "Write research summary"],
    durationMs: 3000,
    terms: ["competitor", "competitors", "market", "price"],
    subAgents: [
      { name: "Trend Researcher", result: "Voice-first assistants are the fastest-growing segment this quarter.", durationMs: 2600 },
      { name: "Competitor Scanner", result: "3 of 5 rivals launched agent features; none share memory across agents.", durationMs: 3600 },
      { name: "Source Validator", result: "7 of 9 sources confirmed; 2 press claims could not be verified.", durationMs: 3100 },
    ],
    produce: ({ subAgentResults, knowledge }) => {
      const bullets = [
        ...subAgentResults,
        ...(knowledge.some((k) => k.id === "kb-competitors") ? ["Updated the Q3 competitor snapshot with this week's launches"] : []),
      ];
      return {
        summary: "Competitor research complete. Shared memory across agents is our clearest gap in the market.",
        bullets,
        entry: {
          title: "Competitor Landscape Scan - Launch Week",
          summary: "Fresh scan of rival assistants: agent features, memory, and validated sources.",
          content: bullets,
          folder: "Research",
          tags: ["competitors", "research", "launch"],
          linkFrom: knowledge.some((k) => k.id === "kb-competitors") ? ["kb-competitors"] : [],
          linkTo: [],
        },
      };
    },
  },

  "campaign-ideas": {
    steps: ["Search the Brain", "Collect research", "Draft campaign ideas"],
    durationMs: 3600,
    terms: ["campaign", "launch", "competitor", "messaging"],
    produce: ({ inputs, knowledge }) => {
      const researchLine = inputs[0]?.bullets[1] ?? "Rivals do not share memory across agents.";
      const bullets = [
        `"One team, one memory": contrast with rivals (${researchLine.replace(/\.$/, "")})`,
        "Live delegation demo: five companions working in parallel, filmed in one take",
        "Founder build-in-public thread with weekly Brain graph screenshots",
      ];
      const legal = knowledge.find((k) => k.id === "kb-legal");
      return {
        summary: "Three campaign ideas drafted from Scout's competitor findings.",
        bullets: legal ? [...bullets, "Checked against Legal Review: avoids 'fully autonomous' claims"] : bullets,
        entry: {
          title: "Competitor-Informed Campaign Ideas",
          summary: "Launch campaign angles built from this week's competitor scan.",
          content: bullets,
          folder: "Marketing",
          tags: ["campaign", "launch", "competitors"],
          linkFrom: knowledge.filter((k) => k.title.startsWith("Competitor Landscape Scan")).map((k) => k.id),
          linkTo: legal ? [legal.id] : [],
        },
      };
    },
  },

  dispatch: {
    steps: ["Search the Brain", "Do the work", "Report back"],
    durationMs: 3000,
    terms: ["launch"],
    produce: ({ companion, instruction }) => ({
      summary: DISPATCH_RESULTS[companion.id] ?? `${companion.name} finished: ${instruction}.`,
      bullets: [],
    }),
  },

  "direct-question": {
    steps: ["Search the Brain", "Answer"],
    durationMs: 1600,
    terms: [],
    produce: ({ companion, knowledge, instruction }) => ({
      summary:
        `${companion.persona.greeting.split(".")[0]}. On "${instruction.replace(/[?.!]+$/, "")}": ` +
        `I checked ${knowledge.length} entries I can read in ${companion.knowledgeFolders.map((f) => f.folder).join(", ")}. ` +
        (knowledge[0] ? `The most relevant is "${knowledge[0].title}". ` : "") +
        `As ${companion.role.toLowerCase()} lead, my suggestion is to send me this as a delegation so I can save a full result to the Brain.`,
      bullets: [],
    }),
  },

  generic: {
    steps: ["Search the Brain", "Work on the task", "Write up the result"],
    durationMs: 3400,
    terms: ["launch"],
    produce: ({ companion, instruction, knowledge }) => {
      const title = titleCase(instruction.replace(/[.?!]+$/, "")).slice(0, 70);
      const bullets = [
        `Scoped the task: ${instruction.replace(/[.?!]+$/, "")}`,
        knowledge[0] ? `Built on "${knowledge[0].title}"` : "No prior Brain entries matched; started fresh",
        `Next step: review with Core and assign follow-ups`,
      ];
      return {
        summary: `${companion.name} finished "${title}".`,
        bullets,
        entry: {
          title,
          summary: `${companion.name}'s result for: ${instruction}`,
          content: bullets,
          folder: companion.knowledgeFolders[0]?.folder ?? "Operations",
          tags: [companion.id, "delegation"],
          linkFrom: knowledge[0] ? [knowledge[0].id] : [],
          linkTo: [],
        },
      };
    },
  },
};

export const DISPATCH_TASKS: Record<string, string> = {
  builder: "Confirm launch-week build status",
  marketer: "Prepare the launch-day posting schedule",
  community: "Line up 10 beta users for launch-day interviews",
  counsel: "Check launch copy against the approved claims list",
  scout: "Scan for competitor announcements this week",
};

const DISPATCH_RESULTS: Record<string, string> = {
  builder: "Build is green. 2 minor bugs left, both scheduled before launch.",
  marketer: "Posting schedule set: teaser 9am, demo 12pm, recap 5pm.",
  community: "10 beta users confirmed for 15-minute launch-day calls.",
  counsel: "Launch copy reviewed. No blocked claims.",
  scout: "One rival shipped a voice feature Tuesday. No overlap with our launch.",
};

/** Dispatch durations differ so companions finish at different times. */
export const DISPATCH_DURATIONS: Record<string, number> = {
  builder: 4200,
  marketer: 3000,
  community: 5200,
  counsel: 2400,
  scout: 3600,
};

export const FEEDBACK_STRATEGY_TITLE = FEEDBACK_ENTRY_TITLE;
