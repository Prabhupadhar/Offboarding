import { StoreProvider, useRoute, useStore } from "./state";
import { Dashboard } from "./views/Dashboard";
import { CaseView } from "./views/CaseView";
import { ReceiptView } from "./views/ReceiptView";
import { People, Person } from "./views/People";
import { Risks } from "./views/Risks";
import { Integrations } from "./views/Integrations";
import { Evidence } from "./views/Evidence";
import { Settings } from "./views/Settings";
import { when } from "./components/ui";

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { state } = useStore();
  const openRisks = state.findings.filter((f) => f.status === "open" && !state.cases.find((c) => c.id === f.caseId)?.closedAt).length;
  const section = route[0] ?? "";
  const nav: [string, string, number?][] = [
    ["", "Overview"],
    ["cases", "Offboarding", state.cases.filter((c) => !c.closedAt).length],
    ["risks", "Open risks", openRisks],
    ["people", "People"],
    ["integrations", "Systems"],
    ["evidence", "Evidence & audit"],
    ["settings", "Settings"],
  ];

  let view;
  if (section === "cases" && route[1] && route[2] === "receipt") view = <ReceiptView caseId={route[1]} />;
  else if (section === "cases" && route[1]) view = <CaseView caseId={route[1]} />;
  else if (section === "cases") view = <Dashboard focusCases />;
  else if (section === "people" && route[1]) view = <Person id={route[1]} />;
  else if (section === "people") view = <People />;
  else if (section === "risks") view = <Risks />;
  else if (section === "integrations") view = <Integrations />;
  else if (section === "evidence") view = <Evidence />;
  else if (section === "settings") view = <Settings />;
  else view = <Dashboard />;

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">OC</span>
          <div>
            <b>Offboarding Control</b>
            <span>{state.org.name}</span>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {nav.map(([path, label, count]) => (
            <a key={path} href={`#/${path}`} className={section === path ? "on" : ""}>
              {label}
              {path === "risks" && count ? <span className="count num">{count}</span> : null}
              {path === "cases" && count ? <span className="muted num">{count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <span>Signed in as {state.me.name} · Admin</span>
          <span>Demo clock: {when(state.now)} UTC</span>
        </div>
      </aside>
      <main className="main">{view}</main>
    </div>
  );
}
