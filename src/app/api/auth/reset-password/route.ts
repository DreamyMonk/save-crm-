import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebase";

type MailjetConfig = {
  apiKey?: string;
  apiSecret?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
};

async function sendMailjetNotification(email: string, mailjet?: MailjetConfig) {
  if (!mailjet?.enabled || !mailjet.apiKey || !mailjet.apiSecret || !mailjet.fromEmail) {
    return;
  }

  await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${mailjet.apiKey}:${mailjet.apiSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: mailjet.fromEmail,
            Name: mailjet.fromName || "SavePlanet CRM",
          },
          To: [{ Email: email }],
          Subject: "SavePlanet CRM password reset requested",
          TextPart: "A password reset was requested for your SavePlanet CRM account. Please check your Firebase reset email for the secure reset link.",
        },
      ],
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

    const firebaseResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
    });

    const result = await firebaseResponse.json().catch(() => ({}));
    if (!firebaseResponse.ok) {
      return NextResponse.json({ error: result.error?.message ?? "Firebase reset failed" }, { status: firebaseResponse.status });
    }

    await sendMailjetNotification(email, body.mailjet);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset failed" }, { status: 500 });
  }
}
