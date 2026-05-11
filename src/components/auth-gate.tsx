"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { LockKeyhole, LogOut, Sparkles } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useCrmStore } from "@/lib/use-crm-store";

type CrmAuthUser = Pick<User, "email" | "uid">;

const hardcodedAdminEmail = "admin@admin.com";
const hardcodedAdminPassword = "admin@admin.com";
const localAdminStorageKey = "saveplanet-hardcoded-admin";
const hardcodedAdminUser: CrmAuthUser = {
  email: hardcodedAdminEmail,
  uid: "hardcoded-admin",
};

export function AuthGate({ children }: { children: (user: CrmAuthUser) => React.ReactNode }) {
  const [user, setUser] = useState<CrmAuthUser | null>(() => readHardcodedAdminUser());
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
      const hardcodedAdmin = readHardcodedAdminUser();
      if (currentUser && currentUser.email?.trim().toLowerCase() !== hardcodedAdminEmail) {
        window.localStorage.removeItem(localAdminStorageKey);
        setUser(currentUser);
      } else {
        setUser(hardcodedAdmin ?? currentUser);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#ffffff] text-[#0f172a]">
        <p className="font-semibold">Loading CRM access...</p>
      </main>
    );
  }

  if (!user) {
    return <UserLoginModule />;
  }

  return <>{children(user)}</>;
}

export function UserLoginModule() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { state } = useCrmStore();
  const loginImageUrl = state.settings.loginImageUrl;
  const logoUrl = state.settings.logoUrl;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    try {
      if (isHardcodedAdminLogin(email, password)) {
        window.localStorage.setItem(localAdminStorageKey, "true");
        window.location.reload();
        return;
      }
      window.localStorage.removeItem(localAdminStorageKey);
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    }
  }

  return (
    <main className="grid min-h-screen bg-[#ffffff] p-4 text-[#0f172a] lg:p-8">
      <div className="m-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-[#dce3d5] bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[680px] bg-[#003CBB] lg:block">
          <Image src={loginImageUrl} alt="SavePlanet CRM login" fill className="object-cover" unoptimized priority />
          <div className="absolute inset-0 bg-[#003CBB]/45" />
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">SavePlanet CRM</p>
            <h1 className="mt-3 max-w-lg text-4xl font-semibold tracking-tight">Manage leads, billing, appointments and access from one place.</h1>
          </div>
        </section>
        <section className="flex min-h-[620px] items-center p-6 md:p-10">
          <div className="w-full">
            <div className="flex items-center gap-3">
          <div className="relative grid size-11 place-items-center overflow-hidden rounded-lg bg-[#003CBB] text-white">
            {logoUrl ? <Image src={logoUrl} alt="SavePlanet CRM logo" fill className="object-contain p-1" unoptimized /> : <Sparkles size={22} />}
          </div>
          <div>
            <h1 className="text-xl font-semibold">SavePlanet CRM</h1>
            <p className="text-sm text-[#657267]">Universal login</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[#657267]">Email</span>
            <input name="email" type="email" required className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[#657267]">Password</span>
            <input name="password" type="password" required minLength={6} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
          </label>
          {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
          {message ? <p className="rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
          <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
            <LockKeyhole size={16} /> Login
          </button>
        </form>
        <Link href="/reset-password" className="mt-3 block w-full text-center text-sm font-semibold text-[#003CBB]">Forgot password?</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function CreateFirstAdminModule() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    try {
      await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      setMessage("Admin account created. You can now use the normal login page.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not create admin");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#ffffff] p-4 text-[#0f172a]">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-[#dce3d5] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-[#003CBB] text-white">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Create first admin</h1>
            <p className="text-sm text-[#657267]">Hidden setup page</p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[#657267]">Admin email</span>
            <input name="email" type="email" required className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[#657267]">Password</span>
            <input name="password" type="password" required minLength={6} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
          </label>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
        {message ? <p className="mt-3 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
        <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
          <LockKeyhole size={16} /> Create admin
        </button>
      </form>
    </main>
  );
}

export function SignOutButton() {
  return (
    <button
      onClick={() => {
        window.localStorage.removeItem(localAdminStorageKey);
        void signOut(getFirebaseAuth());
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-white/72 hover:bg-white/10 hover:text-white"
    >
      <LogOut size={16} /> Sign out
    </button>
  );
}

function isHardcodedAdminLogin(email: string, password: string) {
  return email.trim().toLowerCase() === hardcodedAdminEmail && password === hardcodedAdminPassword;
}

function readHardcodedAdminUser() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(localAdminStorageKey) === "true" ? hardcodedAdminUser : null;
}
