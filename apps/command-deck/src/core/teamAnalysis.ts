import { COMMUNITY_TEMPLATE } from "../data/seed";
import type { Companion } from "../types/models";

interface Responsibility {
  area: string;
  keywords: string[];
  templateId?: string;
}

/** What a product launch needs covered, in priority order. */
export const LAUNCH_RESPONSIBILITIES: Responsibility[] = [
  { area: "product", keywords: ["product", "engineering", "architecture", "implementation"] },
  { area: "marketing", keywords: ["marketing", "advertising", "campaign", "content"] },
  { area: "research", keywords: ["research", "competitor", "market"] },
  { area: "compliance", keywords: ["legal", "compliance", "risk", "policy"] },
  { area: "customer voice", keywords: ["customer", "feedback", "beta", "interview", "community"], templateId: COMMUNITY_TEMPLATE.id },
];

export interface GapAnalysis {
  covered: string[];
  missing: Responsibility | null;
  facts: string[];
}

export function analyzeTeam(roster: Companion[], goal: string): GapAnalysis {
  const active = roster.filter((c) => c.status !== "DRAFT");
  const text = (c: Companion) => `${c.role} ${c.description} ${c.skills.map((s) => s.name).join(" ")}`.toLowerCase();
  const coveredBy = (r: Responsibility) => active.find((c) => r.keywords.some((k) => text(c).includes(k)));
  const covered = LAUNCH_RESPONSIBILITIES.filter((r) => coveredBy(r)).map((r) => r.area);
  const missing = LAUNCH_RESPONSIBILITIES.find((r) => !coveredBy(r)) ?? null;
  const facts = [
    `Roster: ${active.map((c) => c.name).join(", ") || "empty"}`,
    `Goal: ${goal}`,
    ...(missing ? [`No companion lists beta programs, user interviews, or feedback synthesis as a skill`] : []),
  ];
  return { covered, missing, facts };
}
