import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const twilio = body.twilio;
    const leadPhone = String(body.leadPhone || "").trim();
    const leadName = String(body.leadName || "the lead").trim();

    if (!twilio?.enabled || !twilio.accountSid || !twilio.authToken || !twilio.fromNumber || !twilio.agentNumber) {
      return NextResponse.json({ error: "Twilio is not configured" }, { status: 400 });
    }

    if (!leadPhone) {
      return NextResponse.json({ error: "Lead phone number is missing" }, { status: 400 });
    }

    const twiml = [
      "<Response>",
      `<Say voice="alice">Connecting your SavePlanet CRM call to ${escapeXml(leadName)}.</Say>`,
      `<Dial callerId="${escapeXml(twilio.fromNumber)}">`,
      `<Number>${escapeXml(leadPhone)}</Number>`,
      "</Dial>",
      "</Response>",
    ].join("");

    const form = new URLSearchParams({
      To: twilio.agentNumber,
      From: twilio.fromNumber,
      Twiml: twiml,
      Timeout: "30",
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: "Twilio call failed", result }, { status: response.status });
    }

    return NextResponse.json({ ok: true, callSid: result.sid, status: result.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Twilio call failed" }, { status: 500 });
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
