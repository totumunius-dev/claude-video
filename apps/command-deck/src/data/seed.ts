import type {
  Companion,
  CompanionKnowledgeAccess,
  IntegrationState,
  KnowledgeEntry,
  KnowledgeFolder,
  MemoryItem,
} from "../types/models";

export const BRAND = "NOVA";
export const SEED_TIME = "2026-10-01T09:00:00.000Z";

export const WORKSPACE_GOAL =
  "Launch NOVA_OS v1 public beta on Nov 3 with a strong first week of user feedback.";

const read = (...folders: KnowledgeFolder[]): CompanionKnowledgeAccess[] =>
  folders.map((folder) => ({ folder, mode: "read-write" as const }));

const skills = (...names: string[]) =>
  names.map((name) => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name }));

const tools = (...names: string[]) =>
  names.map((name) => ({ id: name.toLowerCase().replace(/\W+/g, "-"), name }));

function companion(c: Omit<Companion, "status" | "currentTask" | "recentActivity" | "lastRun" | "createdAt" | "updatedAt">): Companion {
  return {
    ...c,
    status: "IDLE",
    currentTask: null,
    recentActivity: [],
    lastRun: null,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const SEED_COMPANIONS: Companion[] = [
  companion({
    id: "builder",
    name: "Builder",
    role: "Product and engineering",
    description: "Turns goals into build plans and technical architecture.",
    purpose: "Own what gets built, in what order, and how.",
    persona: { voice: "Direct and pragmatic", traits: ["systems thinker", "ships small"], greeting: "Builder here. What are we shipping?" },
    skills: skills("Product planning", "Technical architecture", "Implementation planning"),
    tools: tools("Repo reader", "Spec writer"),
    knowledgeFolders: read("Product", "Strategy", "System"),
    reportsTo: "core",
    canDelegateTo: ["scout"],
    approvalPolicy: "ask-before-external",
    hue: [255, 140, 40],
  }),
  companion({
    id: "marketer",
    name: "Marketer",
    role: "Marketing and content",
    description: "Plans campaigns and writes launch content.",
    purpose: "Get the launch in front of the right people.",
    persona: { voice: "Energetic and audience-first", traits: ["hook writer", "data-aware"], greeting: "Marketer here. Who are we talking to?" },
    skills: skills("Advertising", "Social content", "Campaign planning"),
    tools: tools("Post drafter", "Campaign calendar"),
    knowledgeFolders: read("Research", "Marketing", "Strategy", "Product"),
    reportsTo: "core",
    canDelegateTo: ["scout", "counsel"],
    approvalPolicy: "ask-before-external",
    hue: [255, 80, 170],
  }),
  companion({
    id: "counsel",
    name: "Counsel",
    role: "Legal and compliance review",
    description: "Reviews claims, policies, and messaging for risk.",
    purpose: "Keep the launch safe to say and safe to ship.",
    persona: { voice: "Careful and plain-spoken", traits: ["precise", "risk-aware"], greeting: "Counsel here. What needs a review?" },
    skills: skills("Risk review", "Policy analysis", "Messaging review"),
    tools: tools("Policy library", "Claim checker"),
    knowledgeFolders: read("Legal", "Marketing", "Product", "Strategy"),
    reportsTo: "core",
    canDelegateTo: [],
    approvalPolicy: "always-ask",
    hue: [180, 120, 255],
  }),
  companion({
    id: "scout",
    name: "Scout",
    role: "Research and competitive intelligence",
    description: "Finds sources, scans competitors, and validates claims.",
    purpose: "Know the market better than anyone in the room.",
    persona: { voice: "Curious and evidence-led", traits: ["thorough", "cites sources"], greeting: "Scout here. What should I dig into?" },
    skills: skills("Market research", "Competitor analysis", "Source collection"),
    tools: tools("Web search (mock)", "Source validator"),
    knowledgeFolders: read("Research", "Marketing", "Strategy"),
    reportsTo: "core",
    canDelegateTo: [],
    approvalPolicy: "auto",
    hue: [90, 230, 140],
  }),
];

/** The companion Core recommends during team gap analysis. Not on the roster until activated. */
export const COMMUNITY_TEMPLATE: Companion = {
  ...companion({
    id: "community",
    name: "Community",
    role: "Customer Voice Lead",
    description: "Runs beta programs, user interviews, and feedback synthesis.",
    purpose: "Bring the customer's voice into every launch decision.",
    persona: { voice: "Warm, curious, and concise", traits: ["listener", "pattern finder"], greeting: "Community here. What are users telling us?" },
    skills: skills("Beta programs", "Customer interviews", "Feedback synthesis"),
    tools: tools("Survey builder", "Interview notes", "Feedback inbox"),
    knowledgeFolders: read("Strategy", "Product", "Marketing", "Research"),
    reportsTo: "core",
    canDelegateTo: ["scout"],
    approvalPolicy: "ask-before-external",
    hue: [70, 200, 255],
  }),
  status: "DRAFT",
};

export const CORE_HUE: [number, number, number] = [255, 59, 59];

const entry = (e: Omit<KnowledgeEntry, "createdAt" | "updatedAt" | "status">): KnowledgeEntry => ({
  ...e,
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
  status: "active",
});

export const SEED_KNOWLEDGE: KnowledgeEntry[] = [
  entry({
    id: "kb-roadmap",
    title: "Product Roadmap - v1 Beta",
    summary: "Six-week plan to the Nov 3 public beta: onboarding, companions, Brain.",
    content: ["Week 1-2: onboarding flow and voice input", "Week 3-4: companion delegation", "Week 5-6: Brain graph and export"],
    folder: "Product",
    tags: ["roadmap", "launch"],
    createdBy: "builder",
    relatedCompanions: ["builder"],
    linkedEntries: ["kb-campaign"],
    source: "Planning session",
  }),
  entry({
    id: "kb-campaign",
    title: "Marketing Campaign - Beta Launch",
    summary: "Three-wave launch campaign: teaser, launch day, first-week recap.",
    content: ["Teaser clips one week before launch", "Launch day thread and demo video", "Week-one recap with user quotes"],
    folder: "Marketing",
    tags: ["campaign", "launch"],
    createdBy: "marketer",
    relatedCompanions: ["marketer"],
    linkedEntries: ["kb-legal"],
    source: "Campaign brief",
  }),
  entry({
    id: "kb-legal",
    title: "Legal Review - Launch Messaging",
    summary: "Approved claims list and phrases to avoid in launch copy.",
    content: ["Avoid 'fully autonomous' claims", "Label preview features clearly", "Privacy note required on voice features"],
    folder: "Legal",
    tags: ["compliance", "messaging"],
    createdBy: "counsel",
    relatedCompanions: ["counsel", "marketer"],
    linkedEntries: [],
    source: "Counsel review",
  }),
  entry({
    id: "kb-competitors",
    title: "Competitor Snapshot - Q3",
    summary: "Five assistant products compared on delegation, memory, and price.",
    content: ["Two competitors have no shared memory", "Most competitors lack multi-agent delegation", "Price band: $20-$40 per month"],
    folder: "Research",
    tags: ["competitors"],
    createdBy: "scout",
    relatedCompanions: ["scout"],
    linkedEntries: ["kb-campaign"],
    source: "Scout research",
  }),
  entry({
    id: "kb-launch-goal",
    title: "Launch Goal and Success Metrics",
    summary: "Public beta on Nov 3. Success means 500 active users and 100 feedback reports in week one.",
    content: ["500 weekly active users", "100 feedback reports", "Under 2% crash rate"],
    folder: "Strategy",
    tags: ["goal", "metrics"],
    createdBy: "core",
    relatedCompanions: ["builder", "marketer"],
    linkedEntries: ["kb-roadmap"],
    source: "Workspace goal",
  }),
  entry({
    id: "kb-runbook",
    title: "Launch Day Runbook",
    summary: "Who is on call, rollback steps, and status page process.",
    content: ["On call: Builder", "Rollback within 15 minutes", "Status page updates every 30 minutes"],
    folder: "Operations",
    tags: ["operations", "launch"],
    createdBy: "builder",
    relatedCompanions: ["builder"],
    linkedEntries: [],
    source: "Ops checklist",
  }),
  entry({
    id: "kb-system",
    title: "Companion Operating Rules",
    summary: "How companions delegate, what needs approval, and where results are saved.",
    content: ["Outbound messages always need approval", "Results are saved to the Brain", "Companions read only their permitted folders"],
    folder: "System",
    tags: ["system", "policy"],
    createdBy: "core",
    relatedCompanions: [],
    linkedEntries: [],
    source: "System",
  }),
];

export const SEED_INTEGRATIONS: IntegrationState[] = [
  { id: "gmail", name: "Gmail", status: "DISCONNECTED", account: null, scopes: [], connectedAt: null, previewOnly: true },
  { id: "slack", name: "Slack", status: "DISCONNECTED", account: null, scopes: [], connectedAt: null, previewOnly: true },
  { id: "shopify", name: "Shopify", status: "DISCONNECTED", account: null, scopes: [], connectedAt: null, previewOnly: true },
  { id: "calendar", name: "Google Calendar", status: "DISCONNECTED", account: null, scopes: [], connectedAt: null, previewOnly: true },
];

export const SEED_MEMORY: MemoryItem[] = [
  { id: "mem-goal", kind: "goal", text: WORKSPACE_GOAL, updatedAt: SEED_TIME },
  { id: "mem-pref-1", kind: "preference", text: "Prefers short, scannable briefs.", updatedAt: SEED_TIME },
  { id: "mem-pref-2", kind: "preference", text: "Every outbound email needs my approval.", updatedAt: SEED_TIME },
];

export const CONTACTS: Record<string, string> = {
  michael: "michael@preview.example",
  sarah: "sarah@preview.example",
  alex: "alex@preview.example",
};

export const MOCK_ACCOUNTS = ["you@preview.example", "team@preview.example"];
