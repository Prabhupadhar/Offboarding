import { appendEvent } from "./audit";
import type {
  Account,
  Application,
  Asset,
  Employee,
  Finding,
  OffboardingCase,
  State,
  User,
} from "./types";

// Demo company: Acme Technologies, 50 people. Everything here is fictional.

const users: User[] = [
  { id: "u-rahul", name: "Rahul Mehta", email: "rahul@acmetech.io", role: "admin" },
  { id: "u-daniel", name: "Daniel Okafor", email: "daniel@acmetech.io", role: "owner" },
  { id: "u-sarah", name: "Sarah Chen", email: "sarah@acmetech.io", role: "verifier" },
  { id: "u-meera", name: "Meera Iyer", email: "meera@auditpartners.example", role: "auditor" },
];

const G = "2026-10-12T06:00:00Z"; // last sync time for connected apps

const apps: Application[] = [
  {
    id: "google", name: "Google Workspace", category: "Identity & email", kind: "api", mark: "G",
    connected: true, lastSync: G, canRevoke: true,
    scopes: [
      { scope: "admin.directory.user.readonly", access: "read", why: "List people and their status" },
      { scope: "admin.reports.audit.readonly", access: "read", why: "Find apps people sign in to with Google" },
      { scope: "drive.metadata.readonly", access: "read", why: "Find files and folders a leaver owns" },
      { scope: "admin.directory.user.security", access: "write", why: "Revoke OAuth grants (optional)" },
    ],
  },
  {
    id: "slack", name: "Slack", category: "Chat", kind: "api", mark: "S", connected: true, lastSync: G,
    canRevoke: true,
    scopes: [
      { scope: "users:read", access: "read", why: "Match people by email" },
      { scope: "channels:read", access: "read", why: "Find channels a leaver manages" },
      { scope: "admin.users:write", access: "write", why: "Deactivate (Business+ / Enterprise only)" },
    ],
  },
  {
    id: "github", name: "GitHub", category: "Source code", kind: "api", mark: "GH", connected: true,
    lastSync: G, canRevoke: true,
    scopes: [
      { scope: "Members: read", access: "read", why: "List org members, outside collaborators" },
      { scope: "Administration: read", access: "read", why: "Find repo admins and sole owners" },
      { scope: "Personal access token requests: read", access: "read", why: "Find tokens with org access" },
      { scope: "Members: write", access: "write", why: "Remove from org (optional)" },
    ],
  },
  {
    id: "jira", name: "Jira", category: "Project tracking", kind: "api", mark: "J", connected: true,
    lastSync: G, canRevoke: true,
    scopes: [{ scope: "read:user:jira", access: "read", why: "Match people and account status" }],
  },
  {
    id: "confluence", name: "Confluence", category: "Docs", kind: "api", mark: "C", connected: true,
    lastSync: G, canRevoke: true,
    scopes: [{ scope: "read:confluence-user", access: "read", why: "Match people and account status" }],
  },
  {
    id: "aws", name: "AWS", category: "Cloud", kind: "api", mark: "AWS", connected: true, lastSync: G,
    canRevoke: true,
    scopes: [
      { scope: "iam:ListUsers, iam:ListAccessKeys, iam:GetAccessKeyLastUsed", access: "read", why: "Find IAM users and keys" },
      { scope: "iam:ListAttachedUserPolicies, sso:ListAccountAssignments", access: "read", why: "Find admin access" },
      { scope: "iam:UpdateAccessKey (deactivate only)", access: "write", why: "Disable keys (optional, separate role)" },
    ],
  },
  {
    id: "zoom", name: "Zoom", category: "Meetings", kind: "api", mark: "Z", connected: true, lastSync: G,
    canRevoke: true,
    scopes: [{ scope: "user:read:list_users:admin", access: "read", why: "Match people and status" }],
  },
  {
    id: "hubspot", name: "HubSpot", category: "CRM", kind: "api", mark: "H", connected: true, lastSync: G,
    canRevoke: false,
    scopes: [{ scope: "settings.users.read", access: "read", why: "Match people and status" }],
  },
  {
    id: "notion", name: "Notion", category: "Docs", kind: "manual", mark: "N", connected: false,
    canRevoke: false,
    manualSteps: "Settings → Members. Search for the person, confirm they are removed or their role is ‘Removed’. Check for pages they own in Teamspaces.",
    scopes: [],
  },
  {
    id: "figma", name: "Figma", category: "Design", kind: "manual", mark: "F", connected: false,
    canRevoke: false,
    manualSteps: "Admin → Members. Confirm the person is removed and their files were moved to a team project.",
    scopes: [],
  },
  {
    id: "salesforce", name: "Salesforce", category: "CRM", kind: "manual", mark: "SF", connected: false,
    canRevoke: false,
    manualSteps: "Setup → Users. Search for the person, confirm ‘Active’ is unchecked. Salesforce uses a local password here, so Google suspension does not lock it.",
    scopes: [],
  },
  {
    id: "1password", name: "1Password", category: "Passwords", kind: "manual", mark: "1P",
    connected: false, canRevoke: false,
    manualSteps: "People → search for the person → Suspend. Then rotate the production items in any shared vault they could open.",
    scopes: [],
  },
];

// 50 people. John Smith, Elena Rossi, Priya Nair and Marcus Lee carry the demo cases.
const roster: [string, string, string][] = [
  ["John Smith", "Engineering", "Senior Platform Engineer"],
  ["Elena Rossi", "Engineering", "Contract Backend Engineer"],
  ["Priya Nair", "Sales", "Account Executive"],
  ["Marcus Lee", "Design", "Product Designer"],
  ["Daniel Okafor", "Leadership", "CTO"],
  ["Rahul Mehta", "Operations", "IT & Operations Lead"],
  ["Sarah Chen", "People", "Head of People"],
  ["Aisha Khan", "Engineering", "Engineering Manager"],
  ["Tom Becker", "Engineering", "Backend Engineer"],
  ["Lucia Fernández", "Engineering", "Frontend Engineer"],
  ["Kenji Watanabe", "Engineering", "Site Reliability Engineer"],
  ["Grace Mwangi", "Engineering", "Backend Engineer"],
  ["Oliver Brown", "Engineering", "Data Engineer"],
  ["Ananya Rao", "Engineering", "QA Engineer"],
  ["Felix Wagner", "Engineering", "Frontend Engineer"],
  ["Hana Kim", "Engineering", "Mobile Engineer"],
  ["Samuel Adeyemi", "Engineering", "Security Engineer"],
  ["Chloe Martin", "Engineering", "Backend Engineer"],
  ["Arjun Patel", "Engineering", "Staff Engineer"],
  ["Nora Lindqvist", "Engineering", "Platform Engineer"],
  ["Diego Torres", "Engineering", "Backend Engineer"],
  ["Mei Lin", "Engineering", "ML Engineer"],
  ["Jacob Wilson", "Engineering", "Frontend Engineer"],
  ["Fatima Zahra", "Engineering", "Backend Engineer"],
  ["Ivan Petrov", "Engineering", "DevOps Engineer"],
  ["Sophie Dubois", "Product", "Product Manager"],
  ["Ethan Clarke", "Product", "Senior Product Manager"],
  ["Yuki Sato", "Design", "Design Lead"],
  ["Laura Jensen", "Design", "UX Researcher"],
  ["Kwame Mensah", "Sales", "Head of Sales"],
  ["Isabella Romano", "Sales", "Account Executive"],
  ["Noah Fischer", "Sales", "Sales Development Rep"],
  ["Zara Ahmed", "Sales", "Sales Development Rep"],
  ["Liam O'Connor", "Sales", "Solutions Engineer"],
  ["Emma Novak", "Customer Success", "CS Manager"],
  ["Ravi Shankar", "Customer Success", "Support Engineer"],
  ["Olivia Hughes", "Customer Success", "Support Engineer"],
  ["Mateo Silva", "Customer Success", "Onboarding Specialist"],
  ["Amara Obi", "Marketing", "Head of Marketing"],
  ["Lena Hoffmann", "Marketing", "Content Marketer"],
  ["Carlos Mendes", "Marketing", "Growth Marketer"],
  ["Ji-woo Park", "Marketing", "Designer"],
  ["Hannah Reid", "Finance", "Finance Manager"],
  ["Vikram Singh", "Finance", "Accountant"],
  ["Alice Moreau", "People", "Recruiter"],
  ["Ben Carter", "Operations", "Office Manager"],
  ["Sara Haddad", "Leadership", "CEO"],
  ["Tariq Hassan", "Engineering", "Contract DevOps Engineer"],
  ["Maya Gupta", "Product", "Product Analyst"],
  ["Peter Novak", "Customer Success", "Support Engineer"],
];

const slug = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").split(" ").join(".");

const employees: Employee[] = roster.map(([name, department, title], i) => ({
  id: `e-${slug(name).replace(/\./g, "-")}`,
  name,
  email: `${slug(name)}@acmetech.io`,
  title,
  department,
  type: title.startsWith("Contract") ? "contractor" : "employee",
  status: i === 3 ? "offboarded" : i < 3 ? "leaving" : "active",
}));

const byName = (n: string) => employees.find((e) => e.name === n)!;
const john = byName("John Smith");
const elena = byName("Elena Rossi");
const priya = byName("Priya Nair");
const marcus = byName("Marcus Lee");

// Which apps each department uses (for everyone not in a demo case).
const deptApps: Record<string, string[]> = {
  Engineering: ["google", "slack", "zoom", "notion", "github", "jira", "confluence", "aws", "1password"],
  Product: ["google", "slack", "zoom", "notion", "jira", "confluence", "figma"],
  Design: ["google", "slack", "zoom", "notion", "figma", "jira"],
  Sales: ["google", "slack", "zoom", "notion", "salesforce", "hubspot"],
  "Customer Success": ["google", "slack", "zoom", "notion", "hubspot", "jira"],
  Marketing: ["google", "slack", "zoom", "notion", "hubspot", "figma"],
  Finance: ["google", "slack", "zoom", "notion", "1password"],
  People: ["google", "slack", "zoom", "notion"],
  Operations: ["google", "slack", "zoom", "notion", "1password", "aws"],
  Leadership: ["google", "slack", "zoom", "notion", "github", "aws", "1password", "salesforce"],
};

const ssoApps = new Set(["notion", "zoom", "figma", "hubspot", "jira", "confluence", "slack"]);

function acct(e: Employee, appId: string, over: Partial<Account> = {}): Account {
  const app = apps.find((a) => a.id === appId)!;
  return {
    id: `a-${e.id.slice(2)}-${appId}`,
    employeeId: e.id,
    appId,
    externalId: e.email,
    matchedBy: ssoApps.has(appId) ? "sso" : "email",
    matchConfidence: 1,
    role: "Member",
    privileged: false,
    bypassesSso: !ssoApps.has(appId) && appId !== "google",
    discoveredVia: app.kind === "api" ? "api" : ssoApps.has(appId) ? "sso-logs" : "inventory",
    lastActive: "2026-10-11T15:20:00Z",
    status: "active",
    ...over,
  };
}

const demoIds = new Set([john.id, elena.id, priya.id, marcus.id]);
const accounts: Account[] = employees
  .filter((e) => !demoIds.has(e.id))
  .flatMap((e) => (deptApps[e.department] ?? []).map((a) => acct(e, a)));

// John: 12 systems. 8 verified, 2 need a person, 2 still active.
const jv = (appId: string, over: Partial<Account> = {}) =>
  acct(john, appId, { status: "verified", lastActive: "2026-10-10T16:50:00Z", ...over });
accounts.push(
  jv("google", { role: "User", matchedBy: "email" }),
  jv("slack", { role: "Member · channel manager" }),
  jv("jira", { role: "Project admin (PLAT)", privileged: true }),
  jv("confluence"),
  jv("zoom"),
  jv("hubspot", { role: "View only" }),
  jv("notion", { role: "Member" }),
  jv("figma", { role: "Viewer" }),
  acct(john, "github", {
    externalId: "jsmith-acme", matchedBy: "username", matchConfidence: 0.92, role: "Org member · admin on 2 repos",
    privileged: true, bypassesSso: true, lastActive: "2026-10-09T21:14:00Z", status: "active",
  }),
  acct(john, "aws", {
    externalId: "arn:aws:iam::4417…:user/john.smith", matchedBy: "username", matchConfidence: 0.88,
    role: "IAM user · AdministratorAccess", privileged: true, bypassesSso: true,
    lastActive: "2026-10-11T02:41:00Z", status: "active",
  }),
  acct(john, "salesforce", { role: "Standard user", status: "action", lastActive: "2026-09-30T10:00:00Z", discoveredVia: "inventory" }),
  acct(john, "1password", { role: "Member · Engineering – Prod vault", status: "action", discoveredVia: "inventory", lastActive: "2026-10-10T11:02:00Z" }),
);

// Elena: contractor whose contract ended. Google is gone, GitHub collaborator access is not.
accounts.push(
  acct(elena, "google", { status: "verified", lastActive: "2026-09-30T17:00:00Z" }),
  acct(elena, "slack", { status: "verified", role: "Single-channel guest", lastActive: "2026-09-30T17:00:00Z" }),
  acct(elena, "jira", { status: "verified", lastActive: "2026-09-30T17:00:00Z" }),
  acct(elena, "github", {
    externalId: "erossi-dev", matchedBy: "manual", matchConfidence: 1, role: "Outside collaborator · write on 3 repos",
    bypassesSso: true, lastActive: "2026-10-07T09:12:00Z", status: "active",
  }),
);

// Priya: leaving on Friday. Accounts stay active until then; the case is prepared in advance.
accounts.push(
  acct(priya, "google", { lastActive: "2026-10-12T08:40:00Z" }),
  acct(priya, "slack", { lastActive: "2026-10-12T08:41:00Z" }),
  acct(priya, "zoom"),
  acct(priya, "notion", { status: "action" }),
  acct(priya, "hubspot", { role: "Sales seat" }),
  acct(priya, "salesforce", { role: "Standard user", status: "action" }),
);

// Marcus: closed last week.
for (const a of ["google", "slack", "zoom", "notion", "figma", "jira"])
  accounts.push(acct(marcus, a, { status: "verified", lastActive: "2026-10-02T17:30:00Z" }));

const cases: OffboardingCase[] = [
  { id: "c-1042", employeeId: john.id, lastDay: "2026-10-10", openedAt: "2026-10-03T09:12:00Z", openedBy: "BambooHR sync", owner: "Rahul Mehta" },
  { id: "c-1039", employeeId: elena.id, lastDay: "2026-09-30", openedAt: "2026-09-24T11:00:00Z", openedBy: "Rahul Mehta", owner: "Rahul Mehta" },
  { id: "c-1044", employeeId: priya.id, lastDay: "2026-10-16", openedAt: "2026-10-09T14:30:00Z", openedBy: "BambooHR sync", owner: "Sarah Chen" },
  {
    id: "c-1031", employeeId: marcus.id, lastDay: "2026-10-02", openedAt: "2026-09-25T10:00:00Z", openedBy: "BambooHR sync",
    owner: "Rahul Mehta", closedAt: "2026-10-05T16:22:00Z", closedBy: "Rahul Mehta",
  },
];

const f = (x: Omit<Finding, "status"> & Partial<Pick<Finding, "status">>): Finding => ({ status: "open", ...x });
const accId = (e: Employee, app: string) => `a-${e.id.slice(2)}-${app}`;

const findings: Finding[] = [
  // John — still active
  f({ id: "f-1", evidenceLabel: "AWS access key AKIA…7QXM", caseId: "c-1042", kind: "api_token", appId: "aws", fix: "revoke",
    title: "AWS access key AKIA…7QXM is active",
    detail: "Long-lived key on IAM user john.smith, created Mar 2025. Last call: s3:PutObject on Oct 11 from a GitHub Actions IP range. A deploy pipeline is probably using John's personal key. Move the pipeline to a role before you disable the key, or the deploy will break.",
    impact: 5, exposure: "external", lastUsed: "2026-10-11T02:41:00Z" }),
  f({ id: "f-2", evidenceLabel: "AWS IAM user john.smith (AdministratorAccess)", caseId: "c-1042", kind: "privileged_access", appId: "aws", accountId: accId(john, "aws"), fix: "revoke",
    title: "AWS IAM user has AdministratorAccess",
    detail: "IAM user john.smith in the production account (4417…) has the AdministratorAccess policy attached directly and a console password. It is not managed by Google sign-in.",
    impact: 5, exposure: "external", lastUsed: "2026-10-08T18:05:00Z" }),
  f({ id: "f-3", evidenceLabel: "GitHub org membership @jsmith-acme", caseId: "c-1042", kind: "active_account", appId: "github", accountId: accId(john, "github"), fix: "revoke",
    title: "GitHub user @jsmith-acme is still in the acme-tech org",
    detail: "Matched by commit email john.smith@acmetech.io (92% confidence). GitHub sign-in is not tied to Google here, so suspending Google did not remove this access.",
    impact: 4, exposure: "external", lastUsed: "2026-10-09T21:14:00Z" }),
  f({ id: "f-4", evidenceLabel: "CircleCI OAuth grant on GitHub", caseId: "c-1042", kind: "oauth_grant", appId: "github", fix: "revoke",
    title: "CircleCI has repo access through John's GitHub account",
    detail: "OAuth app ‘CircleCI’ authorized by @jsmith-acme with repo and admin:repo_hook scopes. Builds for 2 projects run under his identity.",
    impact: 3, exposure: "external", lastUsed: "2026-10-10T13:00:00Z" }),
  f({ id: "f-5", evidenceLabel: "Zapier OAuth grant on Google (3 Zaps)", caseId: "c-1042", kind: "oauth_grant", appId: "google", fix: "transfer",
    title: "Zapier is connected to John's Google account",
    detail: "Scopes: Gmail send, Drive read/write. 3 active Zaps (invoice export, lead routing, weekly report) will fail now that the account is suspended. Rebuild them under ops@acmetech.io, then revoke the grant.",
    impact: 3, exposure: "normal", lastUsed: "2026-10-10T07:00:00Z" }),
  // John — ownership
  f({ id: "f-6", evidenceLabel: "Repo acme-tech/infra-terraform (admin)", caseId: "c-1042", kind: "owned_resource", appId: "github", fix: "transfer",
    title: "Sole admin of repo acme-tech/infra-terraform",
    detail: "No other admin. Branch protection and deploy keys can only be changed by John.",
    impact: 2, exposure: "contained" }),
  f({ id: "f-7", evidenceLabel: "Repo acme-tech/billing-service (admin)", caseId: "c-1042", kind: "owned_resource", appId: "github", fix: "transfer",
    title: "Sole admin of repo acme-tech/billing-service",
    detail: "No other admin. 2 deploy keys were added by John.",
    impact: 2, exposure: "contained" }),
  f({ id: "f-8", evidenceLabel: "Drive folder ‘Customer Contracts 2026’", caseId: "c-1042", kind: "owned_resource", appId: "google", fix: "transfer",
    title: "Owns Drive folder ‘Customer Contracts 2026’",
    detail: "214 files. Shared with 3 external domains. If the account is deleted before transfer, the files are deleted with it.",
    impact: 3, exposure: "normal" }),
  f({ id: "f-9", evidenceLabel: "Slack #incident-response (channel manager)", caseId: "c-1042", kind: "owned_resource", appId: "slack", fix: "transfer",
    title: "Only channel manager of #incident-response",
    detail: "Private channel, 18 members. Nobody else can add members or change settings.",
    impact: 1, exposure: "contained" }),
  // John — manual checks
  f({ id: "f-10", evidenceLabel: "Salesforce user account", caseId: "c-1042", kind: "manual_check", appId: "salesforce", accountId: accId(john, "salesforce"), fix: "verify",
    title: "Confirm Salesforce user is deactivated",
    detail: "No API connection. Salesforce uses a local password here, so suspending Google does not lock it.",
    impact: 4, exposure: "external" }),
  f({ id: "f-11", evidenceLabel: "1Password account and Prod vault secrets", caseId: "c-1042", kind: "manual_check", appId: "1password", accountId: accId(john, "1password"), fix: "verify",
    title: "Confirm 1Password is suspended and prod secrets rotated",
    detail: "John could open the ‘Engineering – Prod’ vault (38 items, 6 tagged production). Suspend him, then rotate the 6 production items.",
    impact: 4, exposure: "external" }),
  // John — assets
  f({ id: "f-12", evidenceLabel: "Office access card A-2231", caseId: "c-1042", kind: "asset", assetId: "as-john-badge", fix: "return",
    title: "Office access card not returned",
    detail: "Card #A-2231. Badge access was disabled in the door system on Oct 10, so this is a recovery item.",
    impact: 1, exposure: "contained" }),

  // Elena
  f({ id: "f-20", evidenceLabel: "GitHub outside collaborator @erossi-dev", caseId: "c-1039", kind: "active_account", appId: "github", accountId: accId(elena, "github"), fix: "revoke",
    title: "Outside collaborator @erossi-dev still has write access",
    detail: "Write on 3 repos including acme-tech/api. Contract ended Sep 30. Last push Oct 7 to a personal fork, last clone of acme-tech/api Oct 7.",
    impact: 4, exposure: "external", lastUsed: "2026-10-07T09:12:00Z" }),
  f({ id: "f-21", evidenceLabel: "YubiKey 5C", caseId: "c-1039", kind: "asset", assetId: "as-elena-key", fix: "return",
    title: "YubiKey not returned", detail: "Contractor-issued hardware key, serial 1882…", impact: 1, exposure: "contained" }),

  // Priya (upcoming)
  f({ id: "f-30", caseId: "c-1044", kind: "active_account", appId: "google", accountId: accId(priya, "google"), fix: "revoke",
    title: "Suspend Google account on Oct 16", detail: "Scheduled for 18:00 on the last day.", impact: 2, exposure: "normal" }),
  f({ id: "f-31", caseId: "c-1044", kind: "manual_check", appId: "salesforce", accountId: accId(priya, "salesforce"), fix: "verify",
    title: "Reassign 41 open opportunities, then deactivate Salesforce user", detail: "Owner of 41 open opportunities worth $412k.", impact: 2, exposure: "normal" }),
  f({ id: "f-32", caseId: "c-1044", kind: "manual_check", appId: "notion", accountId: accId(priya, "notion"), fix: "verify",
    title: "Confirm Notion member is removed", detail: "Owns the ‘Sales playbook’ page tree.", impact: 1, exposure: "normal" }),

  // Marcus (closed) — everything resolved
  ...["google", "slack", "zoom", "notion", "figma", "jira"].map((app, i) =>
    f({
      id: `f-4${i}`, caseId: "c-1031", kind: "active_account", appId: app, accountId: accId(marcus, app),
      fix: app === "notion" || app === "figma" ? "verify" : "revoke",
      title: `${apps.find((a) => a.id === app)!.name} access removed`, detail: "", impact: 2, exposure: "normal",
      status: "resolved",
      resolution: {
        method: app === "notion" || app === "figma" ? "manual" : "api",
        by: "Rahul Mehta", at: `2026-10-0${i < 3 ? 2 : 5}T1${i}:2${i}:00Z`,
        note: app === "figma" ? "Removed in Admin → Members; files moved to ‘Design / Archive’." : undefined,
      },
    })),
];

const assets: Asset[] = [
  { id: "as-john-mac", employeeId: john.id, kind: "laptop", label: "MacBook Pro 14″ (M3)", serial: "C02FX1Q3MD6T", status: "returned" },
  { id: "as-john-badge", employeeId: john.id, kind: "badge", label: "Office access card", serial: "A-2231", status: "assigned" },
  { id: "as-elena-key", employeeId: elena.id, kind: "hardware-key", label: "YubiKey 5C", serial: "1882 4410", status: "assigned" },
  { id: "as-priya-mac", employeeId: priya.id, kind: "laptop", label: "MacBook Air 13″", serial: "C02GL8TYQ6L4", status: "assigned" },
  { id: "as-marcus-mac", employeeId: marcus.id, kind: "laptop", label: "MacBook Pro 16″", serial: "C02DK3P1MD6R", status: "returned" },
];

export function seed(): State {
  let state: State = {
    org: { id: "org-acme", name: "Acme Technologies", domain: "acmetech.io", plan: "Team" },
    me: users[0],
    users,
    employees,
    apps,
    accounts,
    cases,
    findings,
    assets,
    audit: [],
    now: "2026-10-12T10:15:00Z",
  };
  const ev = (at: string, actor: string, action: string, target: string, detail?: string) => {
    state = appendEvent(state, { at, actor, action, target, detail });
  };
  ev("2026-09-24T11:00:00Z", "Rahul Mehta", "case.opened", "Elena Rossi (c-1039)", "Contract end Sep 30");
  ev("2026-09-25T10:00:00Z", "BambooHR sync", "case.opened", "Marcus Lee (c-1031)", "Termination recorded, last day Oct 2");
  ev("2026-09-30T18:00:00Z", "Google Workspace API", "access.verified", "Elena Rossi · Google Workspace", "User suspended, re-read confirms suspended=true");
  ev("2026-10-02T18:05:00Z", "Google Workspace API", "access.verified", "Marcus Lee · Google Workspace", "User suspended");
  ev("2026-10-03T09:12:00Z", "BambooHR sync", "case.opened", "John Smith (c-1042)", "Termination recorded, last day Oct 10");
  ev("2026-10-03T09:13:00Z", "Discovery", "discovery.completed", "John Smith (c-1042)", "12 accounts across 12 systems · 8 via API, 2 via Google sign-in logs, 2 from app inventory");
  ev("2026-10-05T16:22:00Z", "Rahul Mehta", "case.closed", "Marcus Lee (c-1031)", "Receipt OB-1031 issued, 0 open items");
  ev("2026-10-09T14:30:00Z", "BambooHR sync", "case.opened", "Priya Nair (c-1044)", "Resignation recorded, last day Oct 16");
  ev("2026-10-10T18:02:00Z", "Google Workspace API", "access.verified", "John Smith · Google Workspace", "User suspended, re-read confirms suspended=true");
  for (const a of ["Slack", "Jira", "Confluence", "Zoom", "HubSpot"])
    ev("2026-10-10T18:10:00Z", `${a} API`, "access.verified", `John Smith · ${a}`, "Account status re-read: deactivated");
  ev("2026-10-10T18:31:00Z", "Rahul Mehta", "access.attested", "John Smith · Notion", "Manual check: member removed");
  ev("2026-10-10T18:33:00Z", "Rahul Mehta", "access.attested", "John Smith · Figma", "Manual check: member removed");
  ev("2026-10-10T18:40:00Z", "Rahul Mehta", "asset.returned", "John Smith · MacBook Pro 14″", "Serial C02FX1Q3MD6T, wiped via MDM");
  ev("2026-10-12T06:00:00Z", "Discovery", "risk.detected", "John Smith · AWS", "Access key AKIA…7QXM used Oct 11, after last day");
  return state;
}
