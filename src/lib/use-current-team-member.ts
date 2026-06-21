"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { fullAccessModules, isProtectedAdminEmail, protectedAdminMemberForEmail } from "./admin-access";
import { Lead, TeamMember } from "./crm-data";
import { getFirebaseAuth } from "./firebase";

type AuthIdentity = {
  email: string | null;
  uid: string;
};

const hardcodedAdminEmail = "admin@admin.com";
const hardcodedAdminStorageKey = "saveplanet-hardcoded-admin";
const localAccessStorageKey = "saveplanet-local-access-user";
const hardcodedAdminIdentity: AuthIdentity = {
  email: hardcodedAdminEmail,
  uid: "hardcoded-admin",
};

export function useCurrentTeamMember(team: TeamMember[]) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(() => (typeof window === "undefined" ? null : readAuthIdentity(getFirebaseAuth().currentUser)));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const fallbackTimeout = window.setTimeout(() => {
      if (active) setReady(true);
    }, 3500);
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (!active) return;
      window.clearTimeout(fallbackTimeout);
      setIdentity(readAuthIdentity(user));
      setReady(true);
    });
    return () => {
      active = false;
      window.clearTimeout(fallbackTimeout);
      unsubscribe();
    };
  }, []);

  const member = useMemo(() => {
    const normalizedEmail = identity?.email?.trim().toLowerCase();
    const matchedMember =
      team.find((item) => item.active && normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail) ??
      team.find((item) => item.active && identity?.uid && item.uid === identity.uid);
    if (isProtectedAdminEmail(normalizedEmail)) {
      const protectedAdmin = protectedAdminMemberForEmail(normalizedEmail, identity?.uid);
      return { ...(matchedMember ?? protectedAdmin!), modules: fullAccessModules, role: "Admin", active: true };
    }
    return matchedMember ?? null;
  }, [identity, team]);

  return { member, ready };
}

export function canManageLeads(member: TeamMember | null | undefined) {
  if (!member) return false;
  const role = member.role.toLowerCase();
  return member.modules.includes("access") || role.includes("admin");
}

export function canAccessLead(member: TeamMember | null | undefined, lead: Lead | null | undefined) {
  if (!member || !lead) return false;
  if (canManageLeads(member)) return true;
  return memberMatchesAssignment(member, lead.assignedTo) || memberMatchesAssignment(member, lead.substituteAssignedTo);
}

export function memberMatchesAssignment(member: Pick<TeamMember, "id" | "uid" | "email" | "name"> | null | undefined, value?: string) {
  if (!member || !value) return false;
  const normalizedValue = normalizeIdentityValue(value);
  return memberIdentityValues(member).some((identity) => identity === normalizedValue);
}

export function memberIdentityValues(member: Pick<TeamMember, "id" | "uid" | "email" | "name">) {
  return [member.id, member.uid, member.email, member.name].map(normalizeIdentityValue).filter(Boolean);
}

function normalizeIdentityValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function readAuthIdentity(user: User | null): AuthIdentity | null {
  if (typeof window !== "undefined" && window.localStorage.getItem(hardcodedAdminStorageKey) === "true") {
    return hardcodedAdminIdentity;
  }
  const localAccessUser = readLocalAccessUser();
  if (localAccessUser) return { email: localAccessUser.email, uid: localAccessUser.uid };
  return user ? { email: user.email, uid: user.uid } : null;
}

function readLocalAccessUser(): AuthIdentity | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(localAccessStorageKey);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as AuthIdentity;
    return parsed.email && parsed.uid ? parsed : null;
  } catch {
    return null;
  }
}
