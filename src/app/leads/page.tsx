"use client";

import Link from "next/link";
import { ClipboardList, Plus, Search, Settings2 } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { Lead, LeadSource, currency } from "@/lib/crm-data";
import { isDeliverableEmail, sendResendEmail } from "@/lib/send-email";
import { canAccessLead, canManageLeads, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";
import { useMemo, useState } from "react";

export default function LeadsPage() {
  const { state, setState } = useCrmStore();
  const [pipelineId, setPipelineId] = useState(() => initialPipelineIdFromUrl() || state.pipelines[0]?.id || "");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [priority, setPriority] = useState("all");
  const [source, setSource] = useState("all");
  const [message, setMessage] = useState("");
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const canManageAllLeads = canManageLeads(currentMember);

  const activePipeline = state.pipelines.find((pipeline) => pipeline.id === pipelineId) ?? state.pipelines[0];
  const assignable = useMemo(() => {
    if (canManageAllLeads) return state.team.filter(isLeadAssignableMember);
    return currentMember && isLeadAssignableMember(currentMember) ? [currentMember] : [];
  }, [canManageAllLeads, currentMember, state.team]);
  const scopedLeads = useMemo(() => {
    if (!memberReady) return [];
    if (canManageAllLeads) return state.leads;
    return state.leads.filter((lead) => canAccessLead(currentMember, lead));
  }, [canManageAllLeads, currentMember, memberReady, state.leads]);

  const visibleLeads = useMemo(() => {
    return scopedLeads.filter((lead) => {
      const text = `${lead.title} ${lead.company} ${lead.contact}`.toLowerCase();
      return (
        lead.pipelineId === activePipeline?.id &&
        text.includes(search.toLowerCase()) &&
        (owner === "all" || lead.assignedTo === owner) &&
        (source === "all" || (lead.leadSource ?? lead.source) === source) &&
        (priority === "all" || lead.priority === priority)
      );
    });
  }, [activePipeline?.id, owner, priority, scopedLeads, search, source]);

  function moveLead(leadId: string, stageId: string) {
    const targetLead = state.leads.find((lead) => lead.id === leadId);
    if (!targetLead || !canAccessLead(currentMember, targetLead)) return;
    const updatedAt = new Date().toISOString();
    setState({
      ...state,
      leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, stageId, updatedAt } : lead)),
    });
  }

  async function assignLead(leadId: string, memberId: string) {
    if (!canManageAllLeads) {
      setMessage("Only admins and lead coordinators can reassign leads.");
      return;
    }
    const lead = state.leads.find((item) => item.id === leadId);
    const member = state.team.find((item) => item.id === memberId);
    if (!lead || !member) return;
    const assignedAt = new Date().toISOString();
    const nextLead: Lead = {
      ...lead,
      updatedAt: assignedAt,
      assignedTo: memberId,
      activities: [
        {
          id: `A-${lead.id}-${(lead.activities ?? []).length + 1}`,
          type: "Note",
          summary: `Lead assigned to ${member.name}.`,
          outcome: "Allocation updated by admin.",
          createdAt: assignedAt,
          createdBy: "Admin",
        },
        ...(lead.activities ?? []),
      ],
    };
    setState({ ...state, leads: state.leads.map((item) => (item.id === leadId ? nextLead : item)) });
    if (isDeliverableEmail(member.email)) {
      const sent = await sendResendEmail(state, {
        recipients: [{ email: member.email!, name: member.name }],
        subject: `New lead assigned: ${lead.title}`,
        text: `Hi ${member.name},\n\nA lead has been assigned to you in SavePlanet CRM.\n\nLead: ${lead.title}\nCustomer: ${lead.contact}\nCompany: ${lead.company}\nSource: ${lead.leadSource ?? lead.source}\nTicket size: ${currency(lead.ticketSize ?? lead.amount)}\n\nPlease open the CRM and update call/follow-up activity.`,
      });
      setMessage(sent ? `Assigned to ${member.name} and email sent.` : `Assigned to ${member.name}. Email failed.`);
    } else {
      setMessage(`Assigned to ${member.name}. Add a real email in Access Manager for notifications.`);
    }
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Lead module"
        title="Kanban pipelines"
        actions={
          <>
            <ButtonLink href="/pipelines/new" variant="light">
              <Plus size={16} /> New pipeline
            </ButtonLink>
            <ButtonLink href="/leads/new" variant="lime">
              <Plus size={16} /> New lead
            </ButtonLink>
          </>
        }
      />
      <div className="space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activePipeline?.id}
              onChange={(event) => setPipelineId(event.target.value)}
              className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm font-medium shadow-sm outline-none"
            >
              {state.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
              ))}
            </select>
            {activePipeline ? (
              <ButtonLink href={`/pipelines/${activePipeline.id}`} variant="light">
                <Settings2 size={16} /> Pipeline options
              </ButtonLink>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-[#7c877e]" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads" className="h-10 w-60 rounded-lg border border-[#d7dfd0] bg-white pl-9 pr-3 text-sm outline-none" />
            </label>
            <select value={owner} onChange={(event) => setOwner(event.target.value)} className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm outline-none">
              <option value="all">All owners</option>
              {assignable.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm outline-none">
              <option value="all">All priority</option>
              <option>Hot</option>
              <option>Warm</option>
              <option>Cold</option>
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm outline-none">
              <option value="all">All sources</option>
              {(["Manual", "Meta Ads", "Google Ads", "Website", "Referral", "Walk-in", "Campaign"] as LeadSource[]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>
        {message ? <p className="rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
        <div className="grid auto-cols-[340px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {activePipeline?.stages.map((stage) => {
            const stageLeads = visibleLeads.filter((lead) => lead.stageId === stage.id);
            const stageAmount = stageLeads.reduce((sum, lead) => sum + lead.amount, 0);
            return (
              <section
                key={stage.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => moveLead(event.dataTransfer.getData("leadId"), stage.id)}
                className="min-h-[620px] rounded-lg border border-[#d7e3ff] bg-white shadow-sm"
              >
                <div className="border-b border-[#e6edff] bg-[#f7faff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full bg-[#003CBB]" />
                      <h2 className="truncate font-semibold">{stage.name}</h2>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#003CBB] shadow-sm">{stageLeads.length}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0f172a]">{currency(stageAmount)}</p>
                </div>
                <div className="space-y-3 p-3">
                  {stageLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} owner={state.team.find((member) => member.id === lead.assignedTo)?.name ?? "Unassigned"} members={assignable} canAssign={canManageAllLeads} onAssign={assignLead} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </CrmShell>
  );
}

function initialPipelineIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("pipeline") ?? "";
}

function isLeadAssignableMember(member: { active: boolean; name: string; role: string; modules: string[] }) {
  const role = member.role.toLowerCase();
  const name = member.name.trim().toLowerCase().replace(/\s+/g, " ");
  if (name === "aarav admin" || name === "arav admin") return false;
  return member.active && (member.modules.includes("leads") || role.includes("sales") || role.includes("lead") || role.includes("admin"));
}

function LeadCard({ lead, owner, members, canAssign, onAssign }: { lead: Lead; owner: string; members: { id: string; name: string }[]; canAssign: boolean; onAssign: (leadId: string, memberId: string) => void }) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("leadId", lead.id)}
      className="rounded-lg border border-[#d7e3ff] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#003CBB] hover:shadow-md"
    >
      <Link href={`/leads/${lead.id}`} className="block">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#003CBB]">{lead.id}</p>
        <h3 className="mt-1 line-clamp-2 font-semibold leading-5">{lead.title}</h3>
        <p className="mt-1 truncate text-sm text-[#657267]">{lead.company} · {lead.contact}</p>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-xs font-semibold text-[#003CBB]">{lead.priority}</span>
        <span className="text-sm font-semibold">{currency(lead.amount)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-md bg-[#f6f8fc] px-2 py-1 font-semibold text-[#4f5e55]">{lead.leadSource ?? lead.source}</span>
        <span className="rounded-md bg-[#f6f8fc] px-2 py-1 font-semibold text-[#4f5e55]">{lead.salesPhase ?? "Enquiry"}</span>
      </div>
      <div className="mt-3 border-t border-[#edf2e9] pt-3">
        <Link href={`/leads/${lead.id}/tasks`} className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d7e3ff] bg-white text-[#003CBB] transition hover:bg-[#eef4ff]" title="Tasks and notes">
          <ClipboardList size={16} />
        </Link>
      </div>
      {canAssign ? (
        <label className="mt-3 block text-xs font-semibold text-[#657267]">
          Allocate
          <select value={lead.assignedTo} onChange={(event) => onAssign(lead.id, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#d7dfd0] bg-white px-2 text-xs outline-none">
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#657267]">
        <span className="truncate">{owner}</span>
        <span>{lead.probability}%</span>
      </div>
    </article>
  );
}
