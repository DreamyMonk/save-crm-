"use client";

import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { getFirebaseAuth } from "@/lib/firebase";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    await updateProfile(user, { displayName: String(form.get("displayName") || "") });
    setMessage("Profile updated.");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="User login module" title="My account" />
      <form onSubmit={saveProfile} className="m-4 max-w-xl rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Display name</span>
          <input name="displayName" defaultValue={user?.displayName ?? ""} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
        </label>
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Login email</span>
          <input value={user?.email ?? ""} disabled className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-[#f7faf2] px-3 outline-none" />
        </label>
        {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
        <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
          <Save size={16} /> Save profile
        </button>
      </form>
    </CrmShell>
  );
}
