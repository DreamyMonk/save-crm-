import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebase";

type ResendConfig = {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
};

async function sendResendNotification(email: string, resend?: ResendConfig) {
  if (!resend?.enabled || !resend.apiKey || !resend.fromEmail) {
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.fromName ? `${resend.fromName} <${resend.fromEmail}>` : resend.fromEmail,
      to: [email],
      subject: "SavePlanet CRM password reset requested",
      text: "A password reset was requested for your SavePlanet CRM account. Please check your Firebase reset email for the secure reset link.",
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (body.notifyOnly) {
      await sendResendNotification(email, body.resend);
      return NextResponse.json({ ok: true });
    }

    const origin = request.headers.get("origin");
    const firebaseResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
        continueUrl: origin ? `${origin}/login` : undefined,
      }),
    });

    const result = await firebaseResponse.json().catch(() => ({}));
    if (!firebaseResponse.ok) {
      return NextResponse.json({ error: result.error?.message ?? "Firebase reset failed" }, { status: firebaseResponse.status });
    }

    await sendResendNotification(email, body.resend);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset failed" }, { status: 500 });
  }
}
