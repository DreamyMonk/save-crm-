import { NextResponse } from "next/server";

type ResendAttachment = {
  filename?: string;
  content?: string;
  contentType?: string;
  Filename?: string;
  Base64Content?: string;
  ContentType?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resend = body.resend;

    if (!resend?.enabled || !resend.apiKey || !resend.fromEmail) {
      return NextResponse.json({ error: "Resend is not configured" }, { status: 400 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.fromName ? `${resend.fromName} <${resend.fromEmail}>` : resend.fromEmail,
        to: [body.toName ? `${body.toName} <${body.toEmail}>` : body.toEmail],
        subject: body.subject,
        text: body.text,
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

function normalizeAttachments(attachments: unknown) {
  if (!Array.isArray(attachments)) return undefined;
  return attachments.map((attachment: ResendAttachment) => ({
    filename: attachment.filename ?? attachment.Filename ?? "attachment",
    content: attachment.content ?? attachment.Base64Content ?? "",
    contentType: attachment.contentType ?? attachment.ContentType,
  }));
}
