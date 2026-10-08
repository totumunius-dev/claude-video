import { useKnowledge } from "../state/knowledgeStore";
import type { Companion, CompanionId, KnowledgeEntry, KnowledgeFolder } from "../types/models";

export function readableFolders(c: Pick<Companion, "knowledgeFolders">): KnowledgeFolder[] {
  return c.knowledgeFolders.map((k) => k.folder);
}

export function canRead(c: Pick<Companion, "knowledgeFolders">, e: KnowledgeEntry): boolean {
  return readableFolders(c).includes(e.folder);
}

export interface KnowledgeQuery {
  folders?: KnowledgeFolder[];
  terms?: string[];
}

/**
 * Mock retrieval: entries the companion may read, optionally narrowed to folders,
 * ranked by how many query terms appear in title, summary, or tags.
 */
export function searchKnowledge(c: Pick<Companion, "knowledgeFolders">, q: KnowledgeQuery = {}): KnowledgeEntry[] {
  const allowed = useKnowledge
    .getState()
    .entries.filter((e) => e.status !== "archived" && canRead(c, e))
    .filter((e) => !q.folders || q.folders.includes(e.folder));
  if (!q.terms?.length) return allowed;
  const terms = q.terms.map((t) => t.toLowerCase());
  return allowed
    .map((e) => {
      const hay = `${e.title} ${e.summary} ${e.tags.join(" ")}`.toLowerCase();
      return { e, score: terms.filter((t) => hay.includes(t)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.updatedAt.localeCompare(a.e.updatedAt))
    .map((x) => x.e);
}

export interface GraphFilter {
  folder?: KnowledgeFolder | null;
  companion?: CompanionId | null;
}

export interface GraphData {
  nodes: KnowledgeEntry[];
  edges: { id: string; source: string; target: string }[];
}

export function buildGraph(entries: KnowledgeEntry[], f: GraphFilter = {}): GraphData {
  const nodes = entries.filter(
    (e) =>
      e.status !== "archived" &&
      (!f.folder || e.folder === f.folder) &&
      (!f.companion || e.createdBy === f.companion || e.relatedCompanions.includes(f.companion)),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const edges = nodes.flatMap((n) =>
    n.linkedEntries.filter((t) => ids.has(t)).map((t) => ({ id: `${n.id}->${t}`, source: n.id, target: t })),
  );
  return { nodes, edges };
}

/** Entries linked to or from the given entry. */
export function neighbours(entries: KnowledgeEntry[], id: string): KnowledgeEntry[] {
  const me = entries.find((e) => e.id === id);
  if (!me) return [];
  return entries.filter((e) => e.id !== id && (me.linkedEntries.includes(e.id) || e.linkedEntries.includes(id)));
}
