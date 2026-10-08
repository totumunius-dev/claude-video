import type { GraphData } from "../../core/knowledge";

/** Left-to-right layered layout: each node sits one column right of its deepest parent. */
export function layeredLayout(g: GraphData, colW = 215, rowH = 92): Record<string, { x: number; y: number }> {
  const parents = new Map<string, string[]>();
  for (const e of g.edges) parents.set(e.target, [...(parents.get(e.target) ?? []), e.source]);
  const depth = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const ps = parents.get(id) ?? [];
    const d = ps.length ? Math.max(...ps.map((p) => visit(p, seen) + 1)) : 0;
    depth.set(id, d);
    return d;
  };
  g.nodes.forEach((n) => visit(n.id, new Set()));
  const cols = new Map<number, string[]>();
  for (const n of g.nodes) {
    const d = depth.get(n.id) ?? 0;
    cols.set(d, [...(cols.get(d) ?? []), n.id]);
  }
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [d, ids] of cols) {
    ids.forEach((id, i) => {
      pos[id] = { x: d * colW, y: (i - (ids.length - 1) / 2) * rowH };
    });
  }
  return pos;
}
