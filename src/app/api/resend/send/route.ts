import { NextResponse } from "next/server";

type ResendAttachment = {
  filename?: string;
  content?: string;
  contentType?: string;
  Filename?: string;
  Base64Content?: string;
  ContentType?: string;
};

type ResendRecipient = {
  email?: string;
  name?: string;
};

const DEFAULT_RESEND_FROM_EMAIL = "noreply@saveplanet.au";
const DEFAULT_RESEND_REPLY_TO = "info@saveplanet.com.au";
const FALLBACK_RESEND_API_KEY = "re_AAMy2FPa_BDLsSmAi4kCcGHjGzqT5mUwb";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resend = resolveResendSettings(body.resend);
    const recipients = normalizeRecipients(body);

    if (!resend.enabled || !resend.apiKey || !resend.fromEmail) {
      return NextResponse.json({ error: "Resend is not configured" }, { status: 400 });
    }

    if (!recipients.length) {
      return NextResponse.json({ error: "No email recipients provided" }, { status: 400 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.fromName ? `${resend.fromName} <${resend.fromEmail}>` : resend.fromEmail,
        reply_to: resend.replyToEmail,
        to: recipients.map((recipient) => recipient.email),
        subject: body.subject,
        text: body.text,
        html: body.html,
        attachments: normalizeAttachments(body.attachments),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: "Resend send failed", result }, { status: response.status });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mail send failed" }, { status: 500 });
  }
}

function resolveResendSettings(resend?: { apiKey?: string; fromEmail?: string; fromName?: string; enabled?: boolean }) {
  const apiKey = process.env.RESEND_API_KEY || resend?.apiKey || FALLBACK_RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || resend?.fromEmail || DEFAULT_RESEND_FROM_EMAIL;
  const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL || DEFAULT_RESEND_REPLY_TO;
  const fromName = process.env.RESEND_FROM_NAME || resend?.fromName || "SavePlanet CRM";
  return {
    apiKey,
    fromEmail,
    replyToEmail,
    fromName,
    enabled: resend?.enabled ?? true,
  };
}

function normalizeRecipients(body: { toEmail?: string; toName?: string; recipients?: ResendRecipient[] }) {
  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [{ email: body.toEmail, name: body.toName }];
  const unique = new Map<string, { email: string; name?: string }>();

  for (const recipient of rawRecipients) {
    const email = recipient.email?.trim();
    if (!email) continue;
    unique.set(email.toLowerCase(), { email, name: recipient.name?.trim() || undefined });
  }

  return Array.from(unique.values());
}

function normalizeAttachments(attachments: unknown) {
  if (!Array.isArray(attachments)) return undefined;
  return attachments.map((attachment: ResendAttachment) => ({
    filename: attachment.filename ?? attachment.Filename ?? "attachment",
    content: attachment.content ?? attachment.Base64Content ?? "",
    contentType: attachment.contentType ?? attachment.ContentType,
  }));
}
