import { useStore } from "../state";
import { Page } from "../components/ui";

const ROLES = [
  { role: "Owner", can: "Everything, including billing, deleting the workspace and connecting systems with write access." },
  { role: "Admin", can: "Connect systems (read-only), run offboarding, revoke access, transfer ownership, close cases." },
  { role: "Verifier", can: "Record manual checks and returned equipment on cases assigned to them. Cannot revoke or close." },
  { role: "Auditor", can: "Read-only: receipts, audit log, exports. Time-limited access for external auditors." },
];

export function Settings() {
  const { state, dispatch, toast } = useStore();
  return (
    <Page title="Settings" sub={`${state.org.name} · ${state.org.domain} · ${state.org.plan} plan`}>
      <section className="section">
        <h2>Members</h2>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {state.users.map((u) => (
                <tr key={u.id}><td><b>{u.name}</b></td><td className="mono">{u.email}</td><td style={{ textTransform: "capitalize" }}>{u.role}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Roles</h2>
        <div className="card table-wrap">
          <table><tbody>{ROLES.map((r) => <tr key={r.role}><td style={{ width: 110 }}><b>{r.role}</b></td><td>{r.can}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="section">
        <h2>Data and security</h2>
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: "80ch" }}>
          <p><b>What we store:</b> names, work emails, account status, roles and resource names. We don’t read email bodies, file contents, messages or code.</p>
          <p><b>Retention:</b> receipts and audit events are kept for 7 years by default (adjustable to 1–10). Raw discovery data is deleted 90 days after a case closes.</p>
          <p><b>Credentials:</b> each connection’s token is encrypted with a per-workspace key held in a cloud KMS. Write access is a separate, optional credential you can remove without losing read access.</p>
          <p><b>Sign-in:</b> Google or Microsoft sign-in with MFA required for Owners and Admins.</p>
        </div>
      </section>

      <section className="section">
        <h2>Demo</h2>
        <div className="card card-pad spread">
          <p className="muted">Put Acme Technologies back to its starting state (John Smith’s case reopened with 12 open items).</p>
          <button className="btn danger" onClick={() => { dispatch({ type: "reset" }); toast("Demo data reset"); }}>Reset demo data</button>
        </div>
      </section>
    </Page>
  );
}
