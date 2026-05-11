"use client";

import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CrmAuthUser, readHardcodedAdminUser } from "@/components/auth-gate";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { getFirebaseAuth } from "@/lib/firebase";

type AccountUser =
  | { kind: "firebase"; user: User; email: string; displayName: string }
  | { kind: "local-admin"; user: CrmAuthUser; email: string; displayName: string };

export default function AccountPage() {
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
      const localAdmin = readHardcodedAdminUser();
      if (localAdmin) {
        setAccountUser({
          kind: "local-admin",
          user: localAdmin,
          email: localAdmin.email ?? "admin@admin.com",
          displayName: "Aarav Admin",
        });
        return;
      }
      setAccountUser(
        firebaseUser
          ? {
              kind: "firebase",
              user: firebaseUser,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName ?? "",
            }
          : null,
      );
    });
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountUser) return;
    if (accountUser.kind === "local-admin") {
      setMessage("Built-in admin profile is fixed. Use Access Manager to edit real users.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "");
    await updateProfile(accountUser.user, { displayName });
    setAccountUser({ ...accountUser, displayName });
    setMessage("Profile updated.");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="User login module" title="My account" />
      <form onSubmit={saveProfile} className="m-4 max-w-xl rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Display name</span>
          <input name="displayName" defaultValue={accountUser?.displayName ?? ""} disabled={accountUser?.kind === "local-admin"} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]" />
        </label>
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Login email</span>
          <input value={accountUser?.email ?? ""} disabled className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-[#f7faf2] px-3 outline-none" />
        </label>
        {accountUser?.kind === "local-admin" ? <p className="mt-4 rounded-lg border border-[#d7dfd0] bg-[#f8fbff] p-3 text-sm text-[#657267]">You are signed in with the built-in admin account.</p> : null}
        {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
        <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
          <Save size={16} /> Save profile
        </button>
      </form>
    </CrmShell>
  );
}
