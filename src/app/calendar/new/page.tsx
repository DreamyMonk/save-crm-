"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Appointment } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { useCrmStore } from "@/lib/use-crm-store";

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<CrmShell><PageHeader eyebrow="Appointments" title="Schedule appointment" /></CrmShell>}>
      <NewAppointmentContent />
    </Suspense>
  );
}

function NewAppointmentContent() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead") ?? state.leads[0]?.id ?? "";
  const selectedLead = state.leads.find((lead) => lead.id === leadId);
  const [notes, setNotes] = useState("<p>We will review the requirement and next steps.</p>");
  const [status, setStatus] = useState("");

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lead = state.leads.find((item) => item.id === String(form.get("leadId")));
    if (!lead) return;

    const appointment: Appointment = {
      id: `APT-${Date.now()}`,
      leadId: lead.id,
      title: String(form.get("title") || `Meeting with ${lead.company}`),
      date: String(form.get("date") || ""),
      time: String(form.get("time") || ""),
      duration: String(form.get("duration") || "30"),
      meetingType: String(form.get("meetingType") || "Google Meet") as Appointment["meetingType"],
      meetingLink: String(form.get("meetingLink") || ""),
      notes,
      status: "Scheduled",
      emailStatus: "Not sent",
    };

    let emailStatus: Appointment["emailStatus"] = "Not sent";
    if (state.settings.resend.enabled && !lead.communicationPreferences?.dndAllChannels && lead.communicationPreferences?.email) {
      try {
        const response = await fetch("/api/resend/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resend: state.settings.resend,
            toEmail: lead.email,
            toName: lead.contact,
            subject: `Appointment scheduled: ${appointment.title}`,
            text: `Hi ${lead.contact},\n\nYour appointment is scheduled for ${appointment.date} at ${appointment.time}.\nMeeting: ${appointment.meetingType}\nLink: ${appointment.meetingLink}\n\n${htmlToPlainText(notes)}`,
          }),
        });
        emailStatus = response.ok ? "Sent" : "Failed";
      } catch {
        emailStatus = "Failed";
      }
    }

    const savedAppointment = { ...appointment, emailStatus };
    setState({
      ...state,
      appointments: [savedAppointment, ...state.appointments],
      leads: state.leads.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              tasks: [
                ...item.tasks,
                { id: `T-${Date.now()}`, title: `Appointment: ${appointment.title}`, due: `${appointment.date} ${appointment.time}`, status: "Open" },
              ],
              mails: [
                ...item.mails,
                {
                  id: `M-${Date.now()}`,
                  subject: `Appointment scheduled`,
                  body: `Appointment scheduled for ${appointment.date} at ${appointment.time}. Email status: ${emailStatus}`,
                  direction: "Out",
                  createdAt: "Now",
                },
              ],
            }
          : item,
      ),
    });
    setStatus(`Appointment saved. Email status: ${emailStatus}`);
    router.push("/calendar");
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Appointments" title="Schedule appointment" />
      <form onSubmit={schedule} className="m-4 grid max-w-6xl gap-5 rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-[#657267]">Lead</span>
            <select name="leadId" defaultValue={selectedLead?.id} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
              {state.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company} - {lead.contact}</option>)}
            </select>
          </label>
          <Input name="title" label="Appointment title" defaultValue={selectedLead ? `Meeting with ${selectedLead.company}` : ""} required />
          <Input name="date" label="Date" type="date" required />
          <Input name="time" label="Time" type="time" required />
          <Input name="duration" label="Duration minutes" type="number" defaultValue="30" />
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#657267]">Meeting type</span>
            <select name="meetingType" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
              <option>Google Meet</option>
              <option>Zoom</option>
              <option>Phone</option>
              <option>Office</option>
            </select>
          </label>
          <Input name="meetingLink" label="Zoom / Google Meet link" placeholder="https://meet.google.com/..." />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-[#657267]">Appointment notes</span>
            <RichTextEditor value={notes} onChange={setNotes} minHeight={190} />
          </label>
        </section>
        <aside className="rounded-lg bg-[#eef4ff] p-5">
          <h2 className="font-semibold">Automatic email</h2>
          <p className="mt-2 text-sm leading-6 text-[#4f5e55]">
            Email is sent automatically when Resend is enabled in Settings and the lead allows Email communication.
          </p>
          {status ? <p className="mt-4 rounded-lg bg-white p-3 text-sm font-medium">{status}</p> : null}
          <button className="mt-5 h-11 w-full rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white">Schedule appointment</button>
        </aside>
      </form>
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
