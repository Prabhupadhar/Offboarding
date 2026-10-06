import { useStore } from "../state";
import { AppMark, Page, when } from "../components/ui";

export function Integrations() {
  const { state } = useStore();
  const api = state.apps.filter((a) => a.kind === "api");
  const manual = state.apps.filter((a) => a.kind === "manual");
  const users = (id: string) => state.accounts.filter((a) => a.appId === id).length;

  return (
    <Page title="Systems" sub="Connected systems are checked automatically. The rest get a manual check with a named person and a timestamp.">
      <p className="callout">
        Every connection starts read-only. Write access (to remove users or disable keys) is optional, asked for separately, and kept apart from the read credentials.
        Where a system supports it, we use short-lived tokens or a role you can delete at any time instead of a stored password or key.
      </p>

      <section className="section">
        <div className="section-head"><h2>Connected</h2><span className="muted">{api.length} systems</span></div>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>System</th><th>Accounts</th><th>Last checked</th><th>Permissions requested</th></tr></thead>
            <tbody>
              {api.map((a) => (
                <tr key={a.id}>
                  <td><div className="cell-app"><AppMark app={a} /><div><b>{a.name}</b><div className="muted" style={{ fontSize: "0.8rem" }}>{a.category}</div></div></div></td>
                  <td className="num">{users(a.id)}</td>
                  <td className="num muted">{when(a.lastSync)}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {a.scopes.map((s) => (
                        <div key={s.scope} className="row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "baseline" }}>
                          <span className={`chip ${s.access === "read" ? "r" : "w"}`}>{s.access}</span>
                          <span><span className="mono">{s.scope}</span> <span className="muted">· {s.why}</span></span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Checked by hand</h2><span className="muted">Found in Google sign-in logs or added to the app list</span></div>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>System</th><th>Accounts</th><th>Check instructions shown to the verifier</th></tr></thead>
            <tbody>
              {manual.map((a) => (
                <tr key={a.id}>
                  <td><div className="cell-app"><AppMark app={a} /><div><b>{a.name}</b><div className="muted" style={{ fontSize: "0.8rem" }}>{a.category}</div></div></div></td>
                  <td className="num">{users(a.id)}</td>
                  <td className="muted" style={{ maxWidth: "60ch" }}>{a.manualSteps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
