import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mailjet = body.mailjet;

    if (!mailjet?.enabled || !mailjet.apiKey || !mailjet.apiSecret || !mailjet.fromEmail) {
      return NextResponse.json({ error: "Mailjet is not configured" }, { status: 400 });
    }

    const response = await fetch("https://api.mailjet.com/v3.1/send", {
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
            To: [
              {
                Email: body.toEmail,
                Name: body.toName || body.toEmail,
              },
            ],
            Subject: body.subject,
            TextPart: body.text,
            Attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
          },
        ],
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: "Mailjet send failed", result }, { status: response.status });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mail send failed" }, { status: 500 });
  }
}
