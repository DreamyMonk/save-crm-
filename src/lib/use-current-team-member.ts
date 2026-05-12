"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
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
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      setIdentity(readAuthIdentity(user));
      setReady(true);
    });
  }, []);

  const member = useMemo(() => {
    const normalizedEmail = identity?.email?.trim().toLowerCase();
    return (
      team.find((item) => item.active && normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail) ??
      team.find((item) => item.active && identity?.uid && item.uid === identity.uid) ??
      null
    );
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
  return lead.assignedTo === member.id || lead.substituteAssignedTo === member.id;
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
