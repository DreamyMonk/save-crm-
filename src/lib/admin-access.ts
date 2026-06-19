import { ModuleKey, TeamMember } from "./crm-data";

export const fullAccessModules: ModuleKey[] = [
  "dashboard",
  "leads",
  "customers",
  "products",
  "quotes",
  "invoices",
  "access",
  "reports",
  "pipelines",
  "calendar",
  "settings",
];

const protectedAdminEmails = new Set(["admin@admin.com", "vinay@saveplanet.com.au"]);

export function isProtectedAdminEmail(email?: string | null) {
  return Boolean(email && protectedAdminEmails.has(email.trim().toLowerCase()));
}

export function isProtectedAdminMember(member: Pick<TeamMember, "email" | "uid">) {
  return member.uid === "hardcoded-admin" || isProtectedAdminEmail(member.email);
}

export function protectedAdminMemberForEmail(email: string | null | undefined, uid?: string): TeamMember | null {
  if (!isProtectedAdminEmail(email)) return null;
  const normalizedEmail = email!.trim().toLowerCase();
  const hardcoded = normalizedEmail === "admin@admin.com";
  return {
    id: hardcoded ? "admin" : "owner-admin",
    uid: hardcoded ? "hardcoded-admin" : uid || "protected-admin-vinay",
    email: normalizedEmail,
    name: "vinay dhanekula",
    role: "Admin",
    modules: fullAccessModules,
    active: true,
    accessUpdatedAt: "2026-01-01T00:00:00.000Z",
  };
}
