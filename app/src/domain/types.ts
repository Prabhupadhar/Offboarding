// Domain model for the prototype. These types mirror the planned PostgreSQL
// schema (see docs/ARCHITECTURE.md) so the UI can later be pointed at a real API.

export type ISODate = string;

export type VerificationStatus =
  | "verified" // access confirmed removed (by API or attested manually)
  | "active" // access still exists
  | "action" // a human has to do or confirm something
  | "unknown"; // we could not check

export type VerificationMethod = "api" | "manual" | "exception";

export type IntegrationKind = "api" | "manual";

export interface Organization {
  id: string;
  name: string;
  domain: string;
  plan: "Free" | "Team" | "Growth";
}

export type UserRole = "owner" | "admin" | "verifier" | "auditor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  manager?: string;
  type: "employee" | "contractor";
  status: "active" | "leaving" | "offboarded";
}

export interface Application {
  id: string;
  name: string;
  category: string;
  kind: IntegrationKind;
  /** Short monogram used as the app mark in the UI. */
  mark: string;
  connected: boolean;
  lastSync?: ISODate;
  /** Scopes requested from the customer, read-only first. */
  scopes: { scope: string; access: "read" | "write"; why: string }[];
  canRevoke: boolean;
  /** For manual apps: what the verifier should do. */
  manualSteps?: string;
}

export interface Account {
  id: string;
  employeeId: string;
  appId: string;
  externalId: string; // username / IAM ARN / email in that system
  matchedBy: "email" | "sso" | "username" | "manual";
  matchConfidence: number; // 0..1
  role: string;
  privileged: boolean;
  bypassesSso: boolean;
  /** How we found this account: a connected API, SSO logs, or the admin's app list. */
  discoveredVia: "api" | "sso-logs" | "inventory";
  lastActive?: ISODate;
  status: VerificationStatus;
}

export type FindingKind =
  | "privileged_access"
  | "api_token"
  | "oauth_grant"
  | "owned_resource"
  | "active_account"
  | "manual_check"
  | "unknown_access"
  | "asset";

export interface Finding {
  id: string;
  caseId: string;
  kind: FindingKind;
  appId?: string;
  /** Set when resolving this finding also settles an account's status. */
  accountId?: string;
  assetId?: string;
  title: string;
  /** How the item reads on a receipt once settled, e.g. "AWS access key AKIA…7QXM". */
  evidenceLabel?: string;
  detail: string;
  /** Inputs to the risk engine. */
  impact: 1 | 2 | 3 | 4 | 5;
  exposure: "contained" | "normal" | "external";
  lastUsed?: ISODate;
  status: "open" | "resolved" | "accepted";
  resolution?: Resolution;
  /** What resolving it means for this kind of finding. */
  fix: "revoke" | "transfer" | "verify" | "return";
}

export interface Resolution {
  method: VerificationMethod;
  by: string;
  at: ISODate;
  note?: string;
  transferTo?: string;
}

export interface Asset {
  id: string;
  employeeId: string;
  kind: "laptop" | "badge" | "phone" | "hardware-key";
  label: string;
  serial: string;
  status: "assigned" | "returned" | "lost";
}

export interface OffboardingCase {
  id: string;
  employeeId: string;
  lastDay: ISODate;
  openedAt: ISODate;
  openedBy: string;
  owner: string;
  closedAt?: ISODate;
  closedBy?: string;
  riskOverride?: { band: RiskBand; reason: string; by: string; at: ISODate };
}

export type RiskBand = "low" | "medium" | "high" | "critical";

export interface AuditEvent {
  seq: number;
  at: ISODate;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  prevHash: string;
  hash: string;
}

export interface State {
  org: Organization;
  me: User;
  users: User[];
  employees: Employee[];
  apps: Application[];
  accounts: Account[];
  cases: OffboardingCase[];
  findings: Finding[];
  assets: Asset[];
  audit: AuditEvent[];
  /** The prototype's notion of "now", so the demo is reproducible. */
  now: ISODate;
}
