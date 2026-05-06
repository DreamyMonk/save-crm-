import { CrmState } from "./crm-data";

export async function sendResendEmail(
  state: CrmState,
  payload: { recipients: { email: string; name?: string }[]; subject: string; text: string },
) {
  try {
    const response = await fetch("/api/resend/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resend: state.settings.resend,
        recipients: payload.recipients,
        subject: payload.subject,
        text: payload.text,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function isDeliverableEmail(email?: string) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !normalized.endsWith(".local");
}
