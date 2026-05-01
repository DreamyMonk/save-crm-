"use client";

import { Save, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { useCrmStore } from "@/lib/use-crm-store";

export default function SettingsPage() {
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");
  const mailjet = state.settings.mailjet;
  const twilio = state.settings.twilio;

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({
      ...state,
      settings: {
        ...state.settings,
        loginImageUrl: String(form.get("loginImageUrl") || state.settings.loginImageUrl),
        logoUrl: String(form.get("logoUrl") || ""),
        mailjet: {
          apiKey: String(form.get("apiKey") || ""),
          apiSecret: String(form.get("apiSecret") || ""),
          fromEmail: String(form.get("fromEmail") || ""),
          fromName: String(form.get("fromName") || "SavePlanet CRM"),
          enabled: form.get("enabled") === "on",
        },
        twilio: {
          accountSid: String(form.get("twilioAccountSid") || ""),
          authToken: String(form.get("twilioAuthToken") || ""),
          fromNumber: String(form.get("twilioFromNumber") || ""),
          agentNumber: String(form.get("twilioAgentNumber") || ""),
          enabled: form.get("twilioEnabled") === "on",
        },
      },
    });
    setMessage("Settings saved.");
  }

  async function testMailjet() {
    setMessage("Sending test email...");
    const response = await fetch("/api/mailjet/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailjet: state.settings.mailjet,
        toEmail: state.settings.mailjet.fromEmail,
        toName: state.settings.mailjet.fromName,
        subject: "SavePlanet CRM Mailjet test",
        text: "Mailjet is connected to SavePlanet CRM.",
      }),
    });
    setMessage(response.ok ? "Test email sent." : "Test email failed. Check Mailjet settings.");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Settings" title="Mail and automation settings" />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[520px_1fr]">
        <form onSubmit={saveSettings} className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Login, Mailjet and Twilio settings</h2>
          <p className="mt-1 text-sm text-[#657267]">Customize branding, automatic email, and one-click calling.</p>
          <div className="mt-5 grid gap-3">
            <Input name="loginImageUrl" label="Login side image URL" defaultValue={state.settings.loginImageUrl} />
            <Input name="logoUrl" label="Logo image URL" defaultValue={state.settings.logoUrl} />
            <div className="mt-2 border-t border-[#e5edf7] pt-4">
              <h3 className="text-sm font-semibold text-[#0f172a]">Mailjet</h3>
            </div>
            <Input name="apiKey" label="Mailjet API key" defaultValue={mailjet.apiKey} />
            <Input name="apiSecret" label="Mailjet API secret" type="password" defaultValue={mailjet.apiSecret} />
            <Input name="fromEmail" label="From email" type="email" defaultValue={mailjet.fromEmail} />
            <Input name="fromName" label="From name" defaultValue={mailjet.fromName} />
            <label className="flex items-center justify-between rounded-lg border border-[#d7dfd0] p-3 text-sm font-medium">
              <span>Enable Mailjet sending</span>
              <input name="enabled" type="checkbox" defaultChecked={mailjet.enabled} />
            </label>
            <div className="mt-2 border-t border-[#e5edf7] pt-4">
              <h3 className="text-sm font-semibold text-[#0f172a]">Twilio calling</h3>
            </div>
            <Input name="twilioAccountSid" label="Twilio Account SID" defaultValue={twilio.accountSid} />
            <Input name="twilioAuthToken" label="Twilio Auth Token" type="password" defaultValue={twilio.authToken} />
            <Input name="twilioFromNumber" label="Twilio phone number" placeholder="+14155550100" defaultValue={twilio.fromNumber} />
            <Input name="twilioAgentNumber" label="Agent or office phone to ring first" placeholder="+919876543210" defaultValue={twilio.agentNumber} />
            <label className="flex items-center justify-between rounded-lg border border-[#d7dfd0] p-3 text-sm font-medium">
              <span>Enable Twilio calling</span>
              <input name="twilioEnabled" type="checkbox" defaultChecked={twilio.enabled} />
            </label>
          </div>
          {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} /> Save settings
            </button>
            <button type="button" onClick={testMailjet} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#d7dfd0] bg-white px-4 text-sm font-semibold">
              <Send size={16} /> Send test
            </button>
          </div>
        </form>
        <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
          <h2 className="font-semibold">How calling works</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#4f5e55]">
            <p>1. Add Twilio Account SID, Auth Token, Twilio phone number, and the agent phone number.</p>
            <p>2. Enable Twilio calling.</p>
            <p>3. In a lead, make sure DND All Channels is off and Calls & voicemail is enabled.</p>
            <p>4. Click Call. Twilio rings the agent number first, then connects to the lead phone.</p>
          </div>
        </section>
      </div>
    </CrmShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input {...props} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}
