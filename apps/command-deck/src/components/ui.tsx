import type { ReactNode } from "react";
import { BRAND, CORE_HUE } from "../data/seed";
import { useCompanions } from "../state/companionStore";

const PATHS: Record<string, ReactNode> = {
  world: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>),
  brain: (<><path d="M3 5h6a3 3 0 013 3v12a2 2 0 00-2-2H3zM21 5h-6a3 3 0 00-3 3v12a2 2 0 012-2h7z" /></>),
  companions: (<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" /></>),
  integrations: (<><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4" /></>),
  memory: (<><path d="M6 3h12v18l-6-4-6 4z" /></>),
  bolt: (<path d="M13 2L4 14h7l-1 8 9-12h-7z" />),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01" /></>),
  doc: (<><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
};

export function Icon({ name, title }: { name: keyof typeof PATHS | string; title?: string }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`st ${value}`}>{(label ?? value).replace(/_/g, " ")}</span>;
}

export function Bar({ value, state }: { value: number; state?: "done" | "fail" }) {
  return (
    <div className={`bar ${state ?? ""}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export const rgb = (h: [number, number, number], a = 1) => `rgba(${h[0]},${h[1]},${h[2]},${a})`;

export function useHue(id: string): [number, number, number] {
  return useCompanions((s) => s.companions.find((c) => c.id === id)?.hue ?? s.drafts.find((c) => c.id === id)?.hue) ?? CORE_HUE;
}

export function useDisplayName(id: string): string {
  const n = useCompanions((s) => s.companions.find((c) => c.id === id)?.name);
  if (id === "core") return "Core";
  if (id === "user") return "You";
  if (id === "system") return "System";
  return n ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export function Avatar({ id, size }: { id: string; size?: number }) {
  const hue = useHue(id);
  const name = useDisplayName(id);
  const letter = id === "core" ? BRAND[0] : name[0];
  return (
    <span className="av" style={{ background: rgb(hue, 0.18), color: rgb(hue), ...(size ? { width: size, height: size } : {}) }} title={name}>
      {letter}
    </span>
  );
}

export function Name({ id }: { id: string }) {
  return <>{useDisplayName(id)}</>;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
