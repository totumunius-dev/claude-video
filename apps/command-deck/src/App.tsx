import { ActiveFlows } from "./components/ActiveFlows";
import { ActivityPanel } from "./components/ActivityPanel";
import { AgentRoster } from "./components/AgentRoster";
import { BrainView } from "./components/brain/BrainView";
import { EntryDrawer } from "./components/brain/EntryDrawer";
import { Calendar } from "./components/Calendar";
import { ChatPanel } from "./components/chat/ChatPanel";
import { CompanionBuilder } from "./components/CompanionBuilder";
import { GmailAuthModal } from "./components/GmailAuthModal";
import { Dock, Header, Rail } from "./components/Shell";
import { Toasts } from "./components/Toasts";
import { CompanionsView } from "./components/views/CompanionsView";
import { IntegrationsView } from "./components/views/IntegrationsView";
import { MemoryView } from "./components/views/MemoryView";
import { WorldView } from "./components/views/WorldView";
import { useUI } from "./state/uiStore";

function Stage() {
  const view = useUI((s) => s.view);
  return (
    <main className="stage" aria-label="Command Deck">
      {view === "world" && <WorldView />}
      {view === "brain" && <BrainView />}
      {view === "companions" && <CompanionsView />}
      {view === "integrations" && <IntegrationsView />}
      {view === "memory" && <MemoryView />}
      <Dock />
    </main>
  );
}

export function App() {
  return (
    <>
      <div className="app">
        <Rail />
        <Header />
        <section className="col left">
          <ActiveFlows />
          <Calendar />
          <ActivityPanel />
        </section>
        <Stage />
        <section className="col right">
          <AgentRoster />
          <ChatPanel />
        </section>
      </div>
      <CompanionBuilder />
      <GmailAuthModal />
      <EntryDrawer />
      <Toasts />
    </>
  );
}
