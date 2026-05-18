// ──────────────────────────────────────────────────────────────────────────
// lib/rbac.ts — SINGLE SOURCE OF TRUTH for role-based access control.
//
// MUST be byte-identical between:
//   flood-website-community/lib/rbac.ts
//   flood-website-crm/lib/rbac.ts
//
// A drift-check test in each app asserts SHA-256 equality with the
// sibling file (tests/rbac-drift.test.ts). CI fails on drift.
//
// If you change ANYTHING here — even a comment or whitespace —
// copy the file verbatim to the other app's lib/rbac.ts. The test
// will scream at you otherwise.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Raw role keys the Java backend stamps into the JWT `role` claim
 * (uppercase, underscored). The "OPERATIONSMANAGER" / "FIELDTECHNICIAN"
 * / "NGOVOLUNTEER" variants tolerate a backend tweak that dropped the
 * underscore. Customer is deliberately NOT in this set — CRM access is
 * operator-class only.
 */
export const OPERATOR_JWT_KEYS: ReadonlySet<string> = new Set([
  "ADMIN",
  "OPERATIONS_MANAGER",
  "OPERATIONSMANAGER",
  "FIELD_TECHNICIAN",
  "FIELDTECHNICIAN",
  "NGO_VOLUNTEER",
  "NGOVOLUNTEER",
  "VIEWER",
]);

/** Canonical role keys after normalisation. */
export type RoleKey =
  | "ADMIN"
  | "OPERATIONS_MANAGER"
  | "FIELD_TECHNICIAN"
  | "NGO_VOLUNTEER"
  | "VIEWER"
  | "CUSTOMER";

/** CRM display labels — what the UI shows. */
export type RoleLabel =
  | "Admin"
  | "Operations Manager"
  | "Field Technician"
  | "NGO Volunteer"
  | "Viewer"
  | "Customer";

const KEY_TO_LABEL: Record<RoleKey, RoleLabel> = {
  ADMIN: "Admin",
  OPERATIONS_MANAGER: "Operations Manager",
  FIELD_TECHNICIAN: "Field Technician",
  NGO_VOLUNTEER: "NGO Volunteer",
  VIEWER: "Viewer",
  CUSTOMER: "Customer",
};

/**
 * Normalise any role string (JWT enum name, display label, ROLE_ prefix,
 * whitespace, mixed case) to a canonical RoleKey. Returns null for
 * unrecognised values.
 *
 *   "Admin"              → "ADMIN"
 *   "ADMIN"              → "ADMIN"
 *   "Operations Manager" → "OPERATIONS_MANAGER"
 *   "ROLE_ADMIN"         → "ADMIN"
 *   "OPERATIONSMANAGER"  → "OPERATIONS_MANAGER"
 *   "customer"           → "CUSTOMER"
 *   ""                   → null
 *   undefined            → null
 */
export function normalizeRoleKey(
  raw: string | null | undefined,
): RoleKey | null {
  if (!raw) return null;
  let key = String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  if (key.startsWith("ROLE_")) key = key.slice(5);
  // Tolerate the no-underscore variants that some backends emit.
  if (key === "OPERATIONSMANAGER") key = "OPERATIONS_MANAGER";
  if (key === "FIELDTECHNICIAN") key = "FIELD_TECHNICIAN";
  if (key === "NGOVOLUNTEER") key = "NGO_VOLUNTEER";
  if (
    key === "ADMIN" ||
    key === "OPERATIONS_MANAGER" ||
    key === "FIELD_TECHNICIAN" ||
    key === "NGO_VOLUNTEER" ||
    key === "VIEWER" ||
    key === "CUSTOMER"
  ) {
    return key;
  }
  return null;
}

/**
 * Is this role operator-class (allowed to access the CRM)? Customer
 * and unrecognised roles return false. Used by every CRM entry-point
 * gate: middleware, /api/auth/* server routes, AppShellWrapper.
 */
export function isOperatorRole(raw: string | null | undefined): boolean {
  const key = normalizeRoleKey(raw);
  return key !== null && key !== "CUSTOMER";
}

/**
 * Map any role string to its canonical display label. Falls back to
 * "Customer" for nullish/unknown — never throws. Use for UI rendering.
 */
export function roleToDisplayLabel(
  raw: string | null | undefined,
): RoleLabel {
  const key = normalizeRoleKey(raw);
  return key !== null ? KEY_TO_LABEL[key] : "Customer";
}

/** Where this user should land after sign-in. */
export type RouteTarget =
  | {
      origin: "community";
      path: string;
      reason: "customer" | "unknown-role-default";
    }
  | { origin: "crm"; path: string; reason: "operator" };

/**
 * RBAC routing decision. Single source of truth for "where does this
 * user go after sign-in?". Both the community login form and any
 * future SSO trampolines should call this rather than hard-coding
 * the role check.
 */
export function routeForRole(
  raw: string | null | undefined,
): RouteTarget {
  const key = normalizeRoleKey(raw);
  if (key === null) {
    return { origin: "community", path: "/", reason: "unknown-role-default" };
  }
  if (key === "CUSTOMER") {
    return { origin: "community", path: "/", reason: "customer" };
  }
  return { origin: "crm", path: "/dashboard", reason: "operator" };
}
