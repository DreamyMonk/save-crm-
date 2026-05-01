"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MailMessage } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { useCrmStore } from "@/lib/use-crm-store";

export default function LeadMailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [body, setBody] = useState("");
  const lead = state.leads.find((item) => item.id === id);

  function sendMail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !body.trim()) return;
    const mail: MailMessage = {
      id: `M-${Date.now()}`,
      subject: "CRM reply",
      body,
      direction: "Out",
      createdAt: "Now",
    };
    setState({
      ...state,
      leads: state.leads.map((item) => (item.id === lead.id ? { ...item, mails: [...item.mails, mail] } : item)),
    });
    setBody("");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Mail" title={lead ? `Email ${lead.contact}` : "Lead not found"} actions={<ButtonLink href={`/leads/${id}`}>Back to lead</ButtonLink>} />
      {lead ? (
        <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[1fr_420px]">
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Mailbox</h2>
            <div className="mt-4 space-y-3">
              {lead.mails.map((mail) => (
                <article key={mail.id} className="rounded-lg border border-[#edf2e9] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{mail.subject}</p>
                    <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold">{mail.direction}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#4f5e55]">{htmlToPlainText(mail.body)}</p>
                  <p className="mt-2 text-xs text-[#657267]">{mail.createdAt}</p>
                </article>
              ))}
            </div>
          </section>
          <form onSubmit={sendMail} className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Compose email</h2>
            <p className="mt-1 text-sm text-[#657267]">To: {lead.email}</p>
            <input className="mt-4 h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" defaultValue="CRM reply" />
            <div className="mt-3">
              <RichTextEditor value={body} onChange={setBody} placeholder="Write email..." minHeight={240} />
            </div>
            <button className="mt-3 h-11 rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white">Send email</button>
          </form>
        </div>
      ) : null}
    </CrmShell>
  );
}
