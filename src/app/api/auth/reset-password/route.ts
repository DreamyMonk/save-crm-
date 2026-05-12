import { NextResponse } from "next/server";
import { firebaseConfig } from "@/lib/firebase";

type ResendConfig = {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  enabled?: boolean;
};

const FALLBACK_RESEND_API_KEY = "re_AAMy2FPa_BDLsSmAi4kCcGHjGzqT5mUwb";
const DEFAULT_RESEND_FROM_EMAIL = "noreply@saveplanet.au";
const DEFAULT_RESEND_FROM_NAME = "SavePlanet CRM";

async function sendResendNotification(email: string, resend: ResendConfig | undefined, resetLink?: string, temporaryPassword?: string) {
  const resolvedResend = resolveResendSettings(resend);
  if (!resolvedResend.enabled || !resolvedResend.apiKey || !resolvedResend.fromEmail) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedResend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resolvedResend.fromName ? `${resolvedResend.fromName} <${resolvedResend.fromEmail}>` : resolvedResend.fromEmail,
      to: [email],
      subject: "Reset your SavePlanet CRM password",
      text: resetPasswordText(email, resetLink, temporaryPassword),
      html: resetPasswordEmailHtml(email, resetLink, temporaryPassword),
    }),
  });

  return response.ok;
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

    const temporaryPassword = typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";
    if (temporaryPassword) {
      await sendResendNotification(email, body.resend, undefined, temporaryPassword);
      return NextResponse.json({ ok: true, temporary: true });
    }

    const origin = request.headers.get("origin");
    const continueUrl = origin ? `${origin}/login` : undefined;
    const resolvedResend = resolveResendSettings(body.resend);
    const canSendBrandedEmail = Boolean(resolvedResend.enabled && resolvedResend.apiKey && resolvedResend.fromEmail);

    if (canSendBrandedEmail) {
      const linkResponse = await requestFirebasePasswordReset(email, continueUrl, true);
      const linkResult = await linkResponse.json().catch(() => ({}));
      const resetLink = typeof linkResult.oobLink === "string" ? linkResult.oobLink : "";
      if (linkResponse.ok && resetLink && await sendResendNotification(email, resolvedResend, resetLink)) {
        return NextResponse.json({ ok: true, branded: true });
      }
    }

    const firebaseResponse = await requestFirebasePasswordReset(email, continueUrl, false);
    const result = await firebaseResponse.json().catch(() => ({}));
    if (!firebaseResponse.ok) {
      return NextResponse.json({ error: result.error?.message ?? "Firebase reset failed" }, { status: firebaseResponse.status });
    }

    await sendResendNotification(email, resolvedResend);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset failed" }, { status: 500 });
  }
}

function resolveResendSettings(resend?: ResendConfig): Required<ResendConfig> {
  return {
    apiKey: process.env.RESEND_API_KEY || resend?.apiKey || FALLBACK_RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || resend?.fromEmail || DEFAULT_RESEND_FROM_EMAIL,
    fromName: process.env.RESEND_FROM_NAME || resend?.fromName || DEFAULT_RESEND_FROM_NAME,
    enabled: resend?.enabled ?? true,
  };
}

function requestFirebasePasswordReset(email: string, continueUrl?: string, returnOobLink = false) {
  return fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email,
      continueUrl,
      returnOobLink,
    }),
  });
}

function resetPasswordText(email: string, resetLink?: string, temporaryPassword?: string) {
  if (temporaryPassword) {
    return `A temporary SavePlanet CRM password was created for ${email}.

Temporary password:
${temporaryPassword}

Sign in with this password, then ask an admin to update your access password if needed.

SavePlanet CRM`;
  }

  if (!resetLink) {
    return `A password reset was requested for ${email}. Please check your Firebase reset email for the secure reset link.`;
  }

  return `A password reset was requested for ${email}.

Reset your password here:
${resetLink}

This link is single-use. If you did not request this, you can ignore this email.

SavePlanet CRM`;
}

function resetPasswordEmailHtml(email: string, resetLink?: string, temporaryPassword?: string) {
  const safeEmail = escapeHtml(email);
  const action = temporaryPassword
    ? `<div style="margin-top:20px;border:1px solid #d9e2f2;background:#f6f8fc;border-radius:12px;padding:16px;color:#0f172a;font-size:14px;line-height:1.6;">
         <div style="color:#657267;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">Temporary CRM password</div>
         <div style="margin-top:8px;font-size:22px;font-weight:800;color:#003CBB;">${escapeHtml(temporaryPassword)}</div>
       </div>
       <p style="margin:18px 0 0;color:#657267;font-size:13px;line-height:1.6;">Use this password on the CRM login page. This CRM fallback is used when Firebase password reset is unavailable.</p>`
    : resetLink
    ? `<a href="${escapeHtml(resetLink)}" style="display:inline-block;margin-top:20px;background:#003CBB;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:800;font-size:14px;">Reset password</a>
       <p style="margin:18px 0 0;color:#657267;font-size:12px;line-height:1.6;">If the button does not work, paste this secure link into your browser:<br><span style="word-break:break-all;color:#003CBB;">${escapeHtml(resetLink)}</span></p>`
    : `<div style="margin-top:20px;border:1px solid #d9e2f2;background:#f6f8fc;border-radius:12px;padding:16px;color:#0f172a;font-size:14px;line-height:1.6;">Your secure reset link was sent by Firebase Auth. Please open the Firebase email to choose a new password.</div>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d9e2f2;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#003CBB;padding:30px;color:#ffffff;">
                <div style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#dbe7ff;">SavePlanet CRM</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Reset your password</h1>
                <p style="margin:10px 0 0;color:#dbe7ff;font-size:15px;line-height:1.5;">Use the secure link below to choose a new CRM password.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0;font-size:16px;line-height:1.6;">We received a password reset request for <strong>${safeEmail}</strong>.</p>
                ${action}
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:1px solid #e5edf7;">
                  <tr>
                    <td style="padding-top:18px;color:#657267;font-size:13px;line-height:1.6;">This link is single-use. If you did not request a reset, ignore this email and your current password will stay unchanged.</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
