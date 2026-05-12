"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MailMessage, defaultCommunicationPreferences } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { canAccessLead, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

export default function LeadMailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("SavePlanet CRM update");
  const [message, setMessage] = useState("");
  const lead = state.leads.find((item) => item.id === id);
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const hasLeadAccess = memberReady && canAccessLead(currentMember, lead);

  async function sendMail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plainBody = htmlToPlainText(body).trim();
    if (!lead || !plainBody || !subject.trim()) return;

    const preferences = lead.communicationPreferences ?? defaultCommunicationPreferences();
    if (preferences.dndAllChannels || !preferences.email) {
      setMessage("Email blocked by this lead's communication preferences.");
      return;
    }

    setMessage("Sending email...");
    const response = await fetch("/api/resend/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resend: state.settings.resend,
        toEmail: lead.email,
        toName: lead.contact,
        subject: subject.trim(),
        text: plainBody,
      }),
    });

    if (!response.ok) {
      setMessage("Email failed. Check Resend settings and the lead email address.");
      return;
    }

    const mail: MailMessage = {
      id: `M-${Date.now()}`,
      subject: subject.trim(),
      body,
      direction: "Out",
      createdAt: new Date().toLocaleString("en-AU"),
    };
    setState({
      ...state,
      leads: state.leads.map((item) => (item.id === lead.id ? { ...item, updatedAt: new Date().toISOString(), mails: [...item.mails, mail] } : item)),
    });
    setBody("");
    setMessage("Outgoing email sent.");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Outgoing email" title={lead && hasLeadAccess ? `Email ${lead.contact}` : memberReady ? "No lead access" : "Checking lead access"} actions={<ButtonLink href={`/leads/${id}`}>Back to lead</ButtonLink>} />
      {lead && hasLeadAccess ? (
        <div className="p-4 md:p-8">
          <form onSubmit={sendMail} className="mx-auto max-w-3xl rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Send outgoing email</h2>
            <p className="mt-1 text-sm text-[#657267]">To: {lead.email}</p>
            {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none focus:border-[#003CBB]" />
            </label>
            <div className="mt-3">
              <RichTextEditor value={body} onChange={setBody} placeholder="Write email..." minHeight={240} />
            </div>
            <button className="mt-3 h-11 rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white">Send email</button>
          </form>
        </div>
      ) : memberReady ? (
        <div className="p-4 text-sm font-semibold text-[#657267] md:p-8">No access to this lead.</div>
      ) : null}
    </CrmShell>
  );
}
