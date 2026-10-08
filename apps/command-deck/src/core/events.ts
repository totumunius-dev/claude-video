import { useActivity } from "../state/activityStore";
import { useConversation } from "../state/conversationStore";
import { useUI } from "../state/uiStore";
import type { ActivityEvent, ChatMessage, LogEntry, MessageCard, ThreadId } from "../types/models";
import { clock } from "./clock";
import { uid } from "./ids";

/** Post a message to a chat thread. */
export function say(thread: ThreadId, author: ChatMessage["author"], text: string, card?: MessageCard): ChatMessage {
  const m: ChatMessage = { id: uid("msg"), thread, author, text, at: clock.now(), ...(card ? { card } : {}) };
  useConversation.getState().add(m);
  return m;
}

/** A user-facing Live Activity line. Never contains model reasoning. */
export function activity(actor: ActivityEvent["actor"], kind: ActivityEvent["kind"], text: string, delegationId?: string) {
  useActivity.getState().addEvent({ id: uid("evt"), at: clock.now(), actor, kind, text, ...(delegationId ? { delegationId } : {}) });
}

export function log(source: string, message: string, level: LogEntry["level"] = "info") {
  useActivity.getState().addLog({ id: uid("log"), at: clock.now(), level, source, message });
}

export function notify(text: string, tone: "ok" | "warn" | "error" = "ok") {
  const id = uid("toast");
  useUI.getState().toast({ id, text, tone });
  setTimeout(() => useUI.getState().dismiss(id), 5000);
}
