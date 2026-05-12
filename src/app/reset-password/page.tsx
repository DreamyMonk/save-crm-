"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { LockKeyhole, Sparkles } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";
import { useCrmStore } from "@/lib/use-crm-store";

export default function ResetPasswordPage() {
  const { state } = useCrmStore();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();

    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resend: state.settings.resend,
          notifyOnly: true,
        }),
      }).catch(() => undefined);

      setMessage("Password reset email requested. Check your inbox.");
    } catch (resetError) {
      const fallbackSent = await requestServerReset(email);
      if (fallbackSent) {
        setMessage("Password reset email requested. Check your inbox.");
      } else {
        setError(resetError instanceof Error ? friendlyResetError(resetError.message) : "Could not send reset email.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white p-4 text-[#0f172a] lg:p-8">
      <div className="m-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-[#dce3d5] bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[680px] bg-[#003CBB] lg:block">
          <Image src={state.settings.loginImageUrl} alt="SavePlanet CRM reset" fill className="object-cover" unoptimized priority />
          <div className="absolute inset-0 bg-[#003CBB]/55" />
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">Password reset</p>
            <h1 className="mt-3 max-w-lg text-4xl font-semibold tracking-tight">Recover access to your CRM workspace.</h1>
          </div>
        </section>
        <section className="flex min-h-[620px] items-center p-6 md:p-10">
          <div className="w-full">
            <div className="flex items-center gap-3">
              <div className="relative grid size-11 place-items-center overflow-hidden rounded-lg bg-[#003CBB] text-white">
                {state.settings.logoUrl ? <Image src={state.settings.logoUrl} alt="SavePlanet CRM logo" fill className="object-contain p-1" unoptimized /> : <Sparkles size={22} />}
              </div>
              <div>
                <h1 className="text-xl font-semibold">Reset password</h1>
                <p className="text-sm text-[#657267]">Send reset instructions</p>
              </div>
            </div>
            <form onSubmit={resetPassword} className="mt-6 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-[#657267]">Email</span>
                <input name="email" type="email" required className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
              </label>
              {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
              {message ? <p className="rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
              <button disabled={sending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#9bb3ee]">
                <LockKeyhole size={16} /> {sending ? "Sending..." : "Send reset email"}
              </button>
            </form>
            <Link href="/login" className="mt-4 block text-center text-sm font-semibold text-[#003CBB]">Back to login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

async function requestServerReset(email: string) {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response.ok;
}

function friendlyResetError(message: string) {
  if (message.includes("auth/user-not-found") || message.includes("EMAIL_NOT_FOUND")) return "No Firebase login account was found for this email.";
  if (message.includes("auth/invalid-email") || message.includes("INVALID_EMAIL")) return "Enter a valid email address.";
  if (message.includes("auth/too-many-requests") || message.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) return "Too many reset attempts. Try again later.";
  return "Could not send reset email. Check Firebase Auth email/password sign-in settings.";
}
