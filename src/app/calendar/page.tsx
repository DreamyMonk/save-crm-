"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { useCrmStore } from "@/lib/use-crm-store";

export default function CalendarPage() {
  const { state } = useCrmStore();

  return (
    <CrmShell>
      <PageHeader eyebrow="Appointments" title="Calendar and schedules" actions={<ButtonLink href="/calendar/new" variant="lime"><Plus size={16} /> Schedule appointment</ButtonLink>} />
      <div className="grid gap-4 p-4 md:p-8 xl:grid-cols-2">
        {state.appointments.map((appointment) => {
          const lead = state.leads.find((item) => item.id === appointment.leadId);
          return (
            <article key={appointment.id} className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#003CBB]">{appointment.status}</p>
                  <h2 className="mt-1 text-lg font-semibold">{appointment.title}</h2>
                  <p className="mt-1 text-sm text-[#657267]">{lead?.company ?? appointment.leadId} · {appointment.meetingType}</p>
                </div>
                <CalendarDays className="text-[#003CBB]" size={20} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-[#eef4ff] p-3 text-sm">
                <span>{appointment.date}</span>
                <span>{appointment.time}</span>
                <span>{appointment.duration} min</span>
              </div>
              {appointment.meetingLink ? <a href={appointment.meetingLink} target="_blank" className="mt-3 block truncate text-sm font-semibold text-[#0f172a]">{appointment.meetingLink}</a> : null}
              <p className="mt-3 text-sm text-[#657267]">Email: {appointment.emailStatus}</p>
              {lead ? <Link href={`/leads/${lead.id}`} className="mt-4 inline-flex text-sm font-semibold">Open lead</Link> : null}
            </article>
          );
        })}
      </div>
    </CrmShell>
  );
}
