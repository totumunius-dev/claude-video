import { useUI } from "../state/uiStore";

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone}`} onClick={() => dismiss(t.id)}>
          <i />
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
