import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { buildGraph, neighbours, type GraphFilter } from "../../core/knowledge";
import { useKnowledge } from "../../state/knowledgeStore";
import { useUI } from "../../state/uiStore";
import type { KnowledgeEntry } from "../../types/models";
import { Name } from "../ui";
import { layeredLayout } from "./layout";

type KNodeData = { entry: KnowledgeEntry; mode: "sel" | "near" | "faded" | "" };

function KNode({ data }: NodeProps<Node<KNodeData>>) {
  return (
    <div className={`knode ${data.mode}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div>{data.entry.title}</div>
      <div className="f">
        <span>{data.entry.folder}</span>
        <span><Name id={data.entry.createdBy} /></span>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { k: KNode };

export function GraphView({ filter }: { filter: GraphFilter }) {
  const entries = useKnowledge((s) => s.entries);
  const selected = useUI((s) => s.selectedEntry);
  const openEntry = useUI((s) => s.openEntry);

  const g = useMemo(() => buildGraph(entries, filter), [entries, filter]);
  const pos = useMemo(() => layeredLayout(g), [g]);
  const near = useMemo(() => new Set(selected ? neighbours(entries, selected).map((n) => n.id) : []), [entries, selected]);

  const nodes: Node<KNodeData>[] = g.nodes.map((n) => ({
    id: n.id,
    type: "k",
    position: pos[n.id] ?? { x: 0, y: 0 },
    data: { entry: n, mode: !selected ? "" : n.id === selected ? "sel" : near.has(n.id) ? "near" : "faded" },
  }));
  const edges: Edge[] = g.edges.map((e) => {
    const hot = !!selected && (e.source === selected || e.target === selected);
    return {
      ...e,
      animated: hot,
      markerEnd: { type: MarkerType.ArrowClosed, color: hot ? "#ff6a2b" : "#4f4845" },
      style: { stroke: hot ? "#ff6a2b" : "#4f4845", strokeWidth: hot ? 2 : 1.2, opacity: selected && !hot ? 0.35 : 1 },
    };
  });

  return (
    <div className="graph-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.2}
        maxZoom={2}
        nodesConnectable={false}
        onNodeClick={(_, n) => openEntry(n.id)}
        onPaneClick={() => openEntry(null)}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#221c1a" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {g.nodes.length === 0 && <div className="empty" style={{ position: "absolute", top: 12, left: 12 }}>No entries match these filters.</div>}
    </div>
  );
}
