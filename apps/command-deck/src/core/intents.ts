import type { PlaybookKind } from "../types/models";

export type Intent =
  | { kind: "team-gap" }
  | { kind: "create-companion" }
  | { kind: "connect"; integration: "gmail" }
  | { kind: "email"; name: string; topic: string }
  | { kind: "dispatch" }
  | { kind: "chain" }
  | { kind: "delegate"; to: string; instruction: string; playbook: PlaybookKind }
  | { kind: "remember"; text: string }
  | { kind: "status" }
  | { kind: "help" };

const COMPANION_NAMES = "builder|marketer|community|counsel|scout";

export function choosePlaybook(to: string, instruction: string): PlaybookKind {
  const t = instruction.toLowerCase();
  if (to === "community" && /feedback|customer voice/.test(t)) return "feedback-strategy";
  if (to === "builder" && /roadmap|build plan|review/.test(t)) return "roadmap-review";
  if (to === "scout" && /competitor/.test(t)) return "competitor-research";
  return "generic";
}

/** Keyword intent parser for Preview Mode. A model-backed router can replace it later. */
export function parseIntent(raw: string): Intent {
  const text = raw.trim().replace(/\s+/g, " ");
  const t = text.toLowerCase();

  if (/\b(missing|gap|gaps|lacking)\b.*\bteam\b|\bteam\b.*\b(missing|gap|gaps|need)\b/.test(t)) return { kind: "team-gap" };
  if (/^(please )?(create|activate|hire|add) (that|the|this|a|our)? ?(new )?(companion|community)\b/.test(t)) return { kind: "create-companion" };
  if (/\bconnect\b.*\bgmail\b|\bgmail\b.*\bconnect/.test(t)) return { kind: "connect", integration: "gmail" };

  const email = text.match(/^(?:please )?(?:send an? )?(?:email|e-mail|write to) ([a-z]+)(?: (?:about|re|regarding) (.+))?$/i);
  if (email) return { kind: "email", name: email[1], topic: email[2] ?? "the launch" };

  if (/\bdispatch\b.*\b(every|all)\b|\b(every|all) (of the )?companions?\b/.test(t)) return { kind: "dispatch" };
  if (/marketer\b.*\b(ask|have|get|bring in)\b.*\bscout\b/.test(t)) return { kind: "chain" };

  const delegate = text.match(
    new RegExp(`^(?:please )?(?:send a delegation to|delegate to|ask|have|tell|get) (${COMPANION_NAMES})(?: to)?,? (.+)$`, "i"),
  );
  if (delegate) {
    const to = delegate[1].toLowerCase();
    const instruction = delegate[2].replace(/^to /i, "").trim();
    return { kind: "delegate", to, instruction, playbook: choosePlaybook(to, instruction) };
  }

  const remember = text.match(/^remember(?: that)? (.+)$/i);
  if (remember) return { kind: "remember", text: remember[1] };
  if (/\b(status|who('?s| is) (busy|working)|what('?s| is) running)\b/.test(t)) return { kind: "status" };
  return { kind: "help" };
}

export const DEMO_COMMANDS = [
  "What is missing from my team for a product launch?",
  "Create that companion.",
  "Send a delegation to Community to create a launch-day customer feedback strategy.",
  "Connect my Gmail.",
  "Email Michael about the launch momentum and Community being onboarded.",
  "Send a dispatch to every companion.",
  "Have Marketer ask Scout to research competitors and turn the findings into campaign ideas.",
  "Ask Builder to review the Community strategy before preparing a roadmap.",
];
