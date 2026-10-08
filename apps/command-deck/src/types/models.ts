// Domain models for the Command Deck. Every slice of state is built from these.

export type ISODate = string;
export type Id = string;

/* ---------- companions ---------- */

export type CompanionId = string;
export type CompanionStatus = "IDLE" | "BUSY" | "DRAFT" | "ERROR" | "OFFLINE";
export type ApprovalPolicy = "auto" | "ask-before-external" | "always-ask";

export const FOLDERS = [
  "Research",
  "Marketing",
  "Strategy",
  "System",
  "Operations",
  "Product",
  "Legal",
] as const;
export type KnowledgeFolder = (typeof FOLDERS)[number];

export interface CompanionPersona {
  voice: string;
  traits: string[];
  greeting: string;
}

export interface CompanionSkill {
  id: Id;
  name: string;
  description?: string;
}

export interface CompanionTool {
  id: Id;
  name: string;
  integration?: IntegrationId;
}

export interface CompanionKnowledgeAccess {
  folder: KnowledgeFolder;
  mode: "read" | "read-write";
}

export interface CompanionActivity {
  at: ISODate;
  text: string;
}

export interface Companion {
  id: CompanionId;
  name: string;
  role: string;
  description: string;
  purpose: string;
  persona: CompanionPersona;
  status: CompanionStatus;
  skills: CompanionSkill[];
  tools: CompanionTool[];
  knowledgeFolders: CompanionKnowledgeAccess[];
  reportsTo: "core" | CompanionId;
  canDelegateTo: CompanionId[];
  approvalPolicy: ApprovalPolicy;
  hue: [number, number, number];
  currentTask: string | null;
  recentActivity: CompanionActivity[];
  lastRun: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ---------- delegation ---------- */

export type DelegationStatus =
  | "DRAFT"
  | "DELEGATED"
  | "QUEUED"
  | "EXECUTING"
  | "WAITING_FOR_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "ARCHIVED";

export const TERMINAL_STATUSES: DelegationStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "ARCHIVED"];

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface DelegationStep {
  id: Id;
  label: string;
  status: StepStatus;
  at: ISODate | null;
}

export interface DelegationResult {
  summary: string;
  bullets: string[];
  knowledgeUsed: Id[];
  knowledgeCreated: Id[];
}

export type PlaybookKind =
  | "feedback-strategy"
  | "roadmap-review"
  | "dispatch"
  | "competitor-research"
  | "campaign-ideas"
  | "direct-question"
  | "generic";

export interface Delegation {
  id: Id;
  title: string;
  instruction: string;
  from: "core" | CompanionId;
  to: CompanionId;
  playbook: PlaybookKind;
  status: DelegationStatus;
  progress: number; // 0..1
  steps: DelegationStep[];
  flowId: Id | null;
  parentId: Id | null;
  result: DelegationResult | null;
  error: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface DelegationEdge {
  id: Id;
  from: "core" | CompanionId;
  to: CompanionId;
  delegationId: Id;
  label: string;
  createdAt: ISODate;
}

export type SubAgentStatus = "SPAWNED" | "EXECUTING" | "COMPLETED" | "FAILED" | "ARCHIVED";

export interface SubAgent {
  id: Id;
  name: string;
  parentCompanionId: CompanionId;
  delegationId: Id;
  status: SubAgentStatus;
  result: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AgentRun {
  id: Id;
  companionId: CompanionId;
  delegationId: Id;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  outcome: "running" | "completed" | "failed" | "cancelled";
}

export type FlowKind = "single" | "dispatch" | "chain" | "system" | "approval";
export type FlowStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "WAITING";

export interface Flow {
  id: Id;
  title: string;
  kind: FlowKind;
  status: FlowStatus;
  delegationIds: Id[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ---------- knowledge ---------- */

export interface KnowledgeEntry {
  id: Id;
  title: string;
  summary: string;
  content: string[];
  folder: KnowledgeFolder;
  tags: string[];
  createdBy: "core" | "user" | CompanionId;
  relatedCompanions: CompanionId[];
  linkedEntries: Id[];
  source: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  status: "active" | "draft" | "archived";
}

/* ---------- integrations + approvals ---------- */

export type IntegrationId = "gmail" | "slack" | "shopify" | "calendar";
export type IntegrationStatus = "DISCONNECTED" | "AUTHORIZING" | "CONNECTED";

export interface IntegrationState {
  id: IntegrationId;
  name: string;
  status: IntegrationStatus;
  account: string | null;
  scopes: string[];
  connectedAt: ISODate | null;
  previewOnly: true;
}

export type ApprovalStatus =
  | "WAITING_FOR_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "MOCK_SENT";

export interface EmailDraft {
  to: string;
  toName: string;
  subject: string;
  body: string;
  destination: IntegrationId;
}

export interface ApprovalRequest {
  id: Id;
  kind: "email";
  status: ApprovalStatus;
  payload: EmailDraft;
  requestedBy: "core" | CompanionId;
  flowId: Id | null;
  history: { at: ISODate; action: string }[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ---------- conversation ---------- */

export type ThreadId = "core" | CompanionId;

export type MessageCard =
  | { type: "plan"; steps: string[] }
  | { type: "delegation"; delegationIds: Id[]; flowId: Id | null }
  | { type: "team-gap"; covered: string[]; missing: string; facts: string[]; templateId: CompanionId }
  | { type: "companion-created"; companionId: CompanionId; knowledgeId: Id }
  | { type: "result"; delegationId: Id }
  | { type: "integration"; integration: IntegrationId; permissions: string[] }
  | { type: "approval"; approvalId: Id }
  | { type: "summary"; flowId: Id; lines: { companionId: CompanionId; ok: boolean; text: string }[] }
  | { type: "knowledge-links"; entryIds: Id[] };

export interface ChatMessage {
  id: Id;
  thread: ThreadId;
  author: "user" | "core" | CompanionId;
  text: string;
  card?: MessageCard;
  at: ISODate;
}

export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

/* ---------- activity ---------- */

export type ActivityKind =
  | "delegation"
  | "edge"
  | "status"
  | "knowledge"
  | "subagent"
  | "integration"
  | "approval"
  | "companion"
  | "error";

export interface ActivityEvent {
  id: Id;
  at: ISODate;
  actor: "core" | "user" | "system" | CompanionId;
  kind: ActivityKind;
  text: string;
  delegationId?: Id;
}

export interface LogEntry {
  id: Id;
  at: ISODate;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

/* ---------- long-term context ---------- */

export interface MemoryItem {
  id: Id;
  kind: "preference" | "goal" | "fact" | "responsibility";
  text: string;
  updatedAt: ISODate;
}
