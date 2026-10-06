# Architecture: prototype now, MVP next

## What exists today (prototype)

`app/` is a front-end-only React + TypeScript app. All state lives in a reducer (`src/domain/store.ts`), seeded with the Acme Technologies demo (`src/domain/seed.ts`), and is cached in `localStorage`. The domain layer has no React in it:

| File | What it is | Becomes, in the MVP |
|---|---|---|
| `domain/types.ts` | Entities | DB schema / API types |
| `domain/risk.ts` | Risk scoring | Server-side scoring service (same code in Node) |
| `domain/audit.ts` | Hash-chained audit log | `audit_events` table with DB-enforced append-only access |
| `domain/receipt.ts` | Receipt and digest | PDF/JSON evidence export, signed |
| `domain/store.ts` | Workflow transitions | API handlers |

Integrations are **simulated**. "Remove from GitHub" changes local state only.

## Recommended MVP stack (solo builder)

**TypeScript end to end.** One language, shared types between the UI and the API, and the domain code above moves server-side unchanged.

- **Web:** this React app (Vite). Move to Next.js only if marketing pages need SSR.
- **API:** Node + Fastify (or Hono) with zod validation.
- **DB:** PostgreSQL (Neon/RDS) with Drizzle. Row-level security keyed on `org_id`.
- **Jobs:** discovery and sync runs on a Postgres-backed queue (pg-boss or Graphile Worker). No Redis needed at this size.
- **Auth:** WorkOS or Clerk with Google/Microsoft sign-in, MFA enforced for admins. Don't build this yourself.
- **Hosting:** AWS (ECS Fargate or App Runner) so KMS and IAM roles are native. Render or Fly is acceptable for the beta if KMS is still used.
- **PDF:** render the receipt HTML with Playwright on the server, sign it with a KMS asymmetric key.

## Data model (PostgreSQL)

```
organizations(id, name, domain, plan, created_at)
users(id, org_id→organizations, email, name, role[owner|admin|verifier|auditor], mfa_enrolled)
employees(id, org_id, hris_id, email, name, title, department, manager_id→employees, type, status, start_date, end_date)
integrations(id, org_id, provider, status, scopes[], read_secret_ref, write_secret_ref NULL, last_sync_at, last_error)
applications(id, org_id, name, kind[api|manual], integration_id NULL, manual_steps, discovered_via)
accounts(id, org_id, employee_id NULL, application_id, external_id, matched_by, match_confidence, role, privileged, bypasses_sso, last_active_at, status)
permissions(id, account_id, name, scope, privileged)
resources(id, org_id, application_id, external_id, kind[repo|drive_folder|channel|zap|...], name)
ownerships(id, resource_id, account_id, role[owner|sole_admin|manager])
credentials(id, account_id, kind[access_key|pat|ssh_key|deploy_key], external_id_hash, created_at, last_used_at, status)
oauth_connections(id, account_id, client_name, client_id, scopes[], last_used_at, status)
assets(id, org_id, employee_id, kind, label, serial, status)
offboarding_cases(id, org_id, employee_id, last_day, opened_at, opened_by, owner_user_id, closed_at, closed_by, risk_override jsonb)
findings(id, org_id, case_id, kind, subject_type, subject_id, impact, exposure, last_used_at, status, fix)
resolutions(id, finding_id, method[api|manual|exception], actor, at, note, transfer_to, evidence_id NULL)
evidence(id, org_id, case_id, kind[screenshot|api_snapshot|receipt_pdf], storage_key, sha256, created_at)
audit_events(seq bigserial, org_id, at, actor, action, target, detail, prev_hash, hash)  -- INSERT only
```

`org_id` sits on every table, even when it could be derived, so row-level security policies stay simple.

## Security architecture

What we hold is admin-level access to customers' identity, code and cloud systems. The design aims to keep the damage small if we are breached.

1. **Read-only by default. Write access is opt-in, a separate credential, and can be removed on its own.**
2. **Avoid long-lived secrets:**
   - **AWS:** a cross-account role with an External ID, using STS sessions of at most 1 hour. Nothing is stored except the role ARN.
   - **GitHub:** a GitHub App. The private key lives in KMS, and installation tokens last 1 hour.
   - **Google:** prefer per-customer admin OAuth with a refresh token over domain-wide delegation of our own service account. One leaked service-account key would cover every tenant.
   - **Slack and Microsoft 365:** per-tenant OAuth.
3. **Envelope encryption:** each tenant's data key is wrapped by KMS. Refresh tokens are decrypted only inside the worker that needs them, never in the web tier.
4. **Separate workers:** sync workers run under their own IAM identity, with no inbound network access and egress allowed only to provider APIs. The web API can enqueue jobs but cannot read secrets.
5. **Tenant isolation:** Postgres row-level security on `org_id`, plus tests that try to read across tenants. Per-tenant KMS keys allow crypto-shredding when a customer leaves.
6. **Least data:** store metadata only (names, statuses, scopes, last-used times). Never store email bodies, file contents or code. Hash credential identifiers.
7. **Audit:** the hash chain is anchored daily by writing the head hash to an object-locked S3 bucket, so an attacker with database access can't silently rewrite history.
8. **App security:** MFA for admins, short sessions, CSRF protection, strict CSP. Webhooks are verified with HMAC or the provider signature, with replay windows. Per-tenant rate limits.
9. **Rotation and incident response:** one-click "revoke all our access" per tenant. Documented rotation for the GitHub App key and OAuth client secrets. A customer notification runbook. Tenants can view an access log of every call our workers made against their systems.
10. **Retention:** receipts and audit events kept 7 years by default. Raw discovery snapshots deleted 90 days after a case closes. Full deletion within 30 days of cancellation.

## MVP REST API (sketch)

```
POST   /v1/integrations                {provider}            → {id, authorize_url}
GET    /v1/employees?status=leaving
GET    /v1/employees/:id/access                               → accounts + resources + credentials
POST   /v1/offboarding                 {employee_id, last_day} → case with discovered findings
GET    /v1/offboarding/:id                                    → case, findings, counts, risk
POST   /v1/offboarding/:id/findings/:fid/resolve  {method, note?, transfer_to?, evidence_id?}
POST   /v1/offboarding/:id/findings/:fid/accept   {reason}
POST   /v1/offboarding/:id/verify                             → re-run API checks for all findings
POST   /v1/offboarding/:id/close                              → 409 if findings are open
GET    /v1/offboarding/:id/evidence?format=pdf|json
GET    /v1/risks?band=critical
GET    /v1/audit?after_seq=…
```

Every write requires a role check (`verifier` can only resolve with `manual`; only `admin` can resolve with `api`, close, or override) and appends an audit event in the same transaction.
