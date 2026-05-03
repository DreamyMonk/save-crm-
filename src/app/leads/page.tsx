"use client";

import Link from "next/link";
import { ClipboardList, Plus, Search, Settings2 } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { Lead, currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";
import { useMemo, useState } from "react";

export default function LeadsPage() {
  const { state, setState } = useCrmStore();
  const [pipelineId, setPipelineId] = useState(state.pipelines[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [priority, setPriority] = useState("all");

  const activePipeline = state.pipelines.find((pipeline) => pipeline.id === pipelineId) ?? state.pipelines[0];
  const assignable = state.team.filter((member) => member.active && member.modules.includes("leads"));

  const visibleLeads = useMemo(() => {
    return state.leads.filter((lead) => {
      const text = `${lead.title} ${lead.company} ${lead.contact}`.toLowerCase();
      return (
        lead.pipelineId === activePipeline?.id &&
        text.includes(search.toLowerCase()) &&
        (owner === "all" || lead.assignedTo === owner) &&
        (priority === "all" || lead.priority === priority)
      );
    });
  }, [activePipeline?.id, owner, priority, search, state.leads]);

  function moveLead(leadId: string, stageId: string) {
    setState({
      ...state,
      leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, stageId } : lead)),
    });
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
          </div>
        </div>
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
                    <LeadCard key={lead.id} lead={lead} owner={state.team.find((member) => member.id === lead.assignedTo)?.name ?? "Unassigned"} />
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

function LeadCard({ lead, owner }: { lead: Lead; owner: string }) {
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
      <div className="mt-3 border-t border-[#edf2e9] pt-3">
        <Link href={`/leads/${lead.id}/tasks`} className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d7e3ff] bg-white text-[#003CBB] transition hover:bg-[#eef4ff]" title="Tasks and notes">
          <ClipboardList size={16} />
        </Link>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#657267]">
        <span className="truncate">{owner}</span>
        <span>{lead.probability}%</span>
      </div>
    </article>
  );
}
