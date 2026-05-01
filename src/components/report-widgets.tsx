"use client";

import { SlidersHorizontal } from "lucide-react";
import { Lead, Pipeline, TeamMember, currency } from "@/lib/crm-data";

const colors = ["#54adf7", "#22c1dc", "#7b91f2", "#9b7bf2", "#4d7ff0", "#67cfe8", "#003CBB"];

type AnalyticsProps = {
  leads: Lead[];
  pipelines: Pipeline[];
  team: TeamMember[];
  selectedPipelineId: string;
  onPipelineChange?: (pipelineId: string) => void;
  compact?: boolean;
};

export function AnalyticsDashboard({ leads, pipelines, team, selectedPipelineId, onPipelineChange, compact = false }: AnalyticsProps) {
  const filteredLeads = selectedPipelineId === "all" ? leads : leads.filter((lead) => lead.pipelineId === selectedPipelineId);
  const activePipeline = selectedPipelineId === "all" ? undefined : pipelines.find((pipeline) => pipeline.id === selectedPipelineId);
  const wonLeads = filteredLeads.filter((lead) => lead.stageId.includes("closed") || lead.stageId.includes("install"));
  const wonRevenue = wonLeads.reduce((sum, lead) => sum + lead.amount, 0);
  const totalRevenue = filteredLeads.reduce((sum, lead) => sum + lead.amount, 0);
  const conversion = filteredLeads.length ? Math.round((wonLeads.length / filteredLeads.length) * 10000) / 100 : 0;
  const statusRows = getStatusRows(filteredLeads);
  const stageRows = getStageRows(filteredLeads, pipelines, activePipeline);
  const agentRows = team.map((member) => ({
    name: member.name,
    count: filteredLeads.filter((lead) => lead.assignedTo === member.id).length,
    amount: filteredLeads.filter((lead) => lead.assignedTo === member.id).reduce((sum, lead) => sum + lead.amount, 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Opportunity Status" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
          <Donut rows={statusRows} center={String(filteredLeads.length)} />
        </Card>
        <Card title="Opportunity Value" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
          <HorizontalBars rows={statusRows.map((row) => ({ name: row.name, value: row.amount }))} footerLabel="Total revenue" footerValue={currency(totalRevenue)} />
        </Card>
        <Card title="Conversion" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
          <Conversion value={conversion} wonRevenue={wonRevenue} />
        </Card>
      </div>

      <div className={`grid gap-4 ${compact ? "xl:grid-cols-1" : "xl:grid-cols-[1fr_1fr]"}`}>
        <Card title="Funnel" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
          <Funnel rows={stageRows} />
        </Card>
        <Card title="Stage Distribution" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
          <Donut rows={stageRows.map((row) => ({ ...row, color: row.color }))} center={String(filteredLeads.length)} wide />
        </Card>
      </div>

      {!compact ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Sales Agent Performance" pipelines={pipelines} selectedPipelineId={selectedPipelineId} onPipelineChange={onPipelineChange}>
            <HorizontalBars rows={agentRows.map((row) => ({ name: `${row.name} (${row.count})`, value: row.amount }))} footerLabel="Assigned revenue" footerValue={currency(agentRows.reduce((sum, row) => sum + row.amount, 0))} />
          </Card>
          <Card title="Detailed Lead Table">
            <LeadTable leads={filteredLeads} pipelines={pipelines} team={team} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  children,
  pipelines,
  selectedPipelineId,
  onPipelineChange,
}: {
  title: string;
  children: React.ReactNode;
  pipelines?: Pipeline[];
  selectedPipelineId?: string;
  onPipelineChange?: (pipelineId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2e9] p-4">
        <h2 className="font-semibold">{title}</h2>
        {pipelines && selectedPipelineId && onPipelineChange ? (
          <div className="flex items-center gap-3">
            <select value={selectedPipelineId} onChange={(event) => onPipelineChange(event.target.value)} className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm outline-none">
              <option value="all">All Pipelines</option>
              {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
            <SlidersHorizontal size={17} className="text-[#657267]" />
          </div>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Donut({ rows, center, wide = false }: { rows: { name: string; count: number; amount: number; color?: string }[]; center: string; wide?: boolean }) {
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.count, 0));
  const gradientParts = rows.reduce<{ offset: number; parts: string[] }>(
    (acc, row, index) => {
      const start = acc.offset;
      const end = start + (row.count / total) * 100;
      return {
        offset: end,
        parts: [...acc.parts, `${row.color ?? colors[index % colors.length]} ${start}% ${end}%`],
      };
    },
    { offset: 0, parts: [] },
  );
  const gradient = gradientParts.parts.join(", ");

  return (
    <div className={`grid items-center gap-6 ${wide ? "md:grid-cols-[1fr_220px]" : "md:grid-cols-[1fr_170px]"}`}>
      <div className="mx-auto grid size-48 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient || "#e8edf7 0% 100%"})` }}>
        <div className="grid size-32 place-items-center rounded-full bg-white text-2xl font-semibold">{center}</div>
      </div>
      <div className="space-y-3 text-sm">
        {rows.map((row, index) => (
          <div key={row.name} className="flex items-start gap-2">
            <span className="mt-1 size-3 rounded-sm" style={{ background: row.color ?? colors[index % colors.length] }} />
            <div>
              <p className="font-medium">{row.name} - {row.count}</p>
              <p className="text-xs text-[#657267]">{currency(row.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ rows, footerLabel, footerValue }: { rows: { name: string; value: number }[]; footerLabel: string; footerValue: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.name} className="grid grid-cols-[100px_1fr_90px] items-center gap-3 text-sm">
            <span className="truncate text-[#657267]">{row.name}</span>
            <div className="h-3 rounded-full bg-[#e7edf8]">
              <div className="h-3 rounded-full bg-[#54adf7]" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-semibold">{currency(row.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <p className="text-xs text-[#657267]">{footerLabel}</p>
        <p className="font-semibold">{footerValue}</p>
      </div>
    </div>
  );
}

function Conversion({ value, wonRevenue }: { value: number; wonRevenue: number }) {
  return (
    <div className="grid place-items-center">
      <div className="grid size-56 place-items-center rounded-full" style={{ background: `conic-gradient(#54adf7 0% ${value}%, #e8edf7 ${value}% 100%)` }}>
        <div className="grid size-40 place-items-center rounded-full bg-white">
          <p className="text-3xl font-semibold">{value}%</p>
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-xs text-[#657267]">Won revenue</p>
        <p className="font-semibold">{currency(wonRevenue)}</p>
      </div>
    </div>
  );
}

function Funnel({ rows }: { rows: { name: string; count: number; amount: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.amount || row.count));
  return (
    <div className="space-y-1">
      {rows.map((row, index) => {
        const width = Math.max(34, ((row.amount || row.count) / max) * 100);
        const cumulative = rows[0]?.count ? Math.round((row.count / rows[0].count) * 10000) / 100 : 0;
        const next = rows[index + 1]?.count && row.count ? Math.round((rows[index + 1].count / row.count) * 10000) / 100 : row.count ? 100 : 0;
        return (
          <div key={row.name} className="grid grid-cols-[1fr_92px_92px] items-stretch gap-3 text-sm">
            <div className="rounded-md px-4 py-3 text-white" style={{ width: `${width}%`, background: row.color ?? colors[index % colors.length] }}>
              <p className="font-medium">{row.name}</p>
              <p>{currency(row.amount)}</p>
            </div>
            <div className="grid place-items-center rounded-md bg-[#eef2f8] text-xs font-semibold">{cumulative}%</div>
            <div className="grid place-items-center rounded-md bg-[#eef2f8] text-xs font-semibold">{next}%</div>
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_92px_92px] gap-3 pt-2 text-center text-xs font-semibold">
        <span />
        <span>Cumulative</span>
        <span>Next step</span>
      </div>
    </div>
  );
}

function LeadTable({ leads, pipelines, team }: { leads: Lead[]; pipelines: Pipeline[]; team: TeamMember[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[1fr_150px_140px_120px_120px] gap-3 border-b border-[#edf2e9] pb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#657267]">
          <span>Lead</span>
          <span>Pipeline</span>
          <span>Owner</span>
          <span>Stage</span>
          <span>Value</span>
        </div>
        {leads.map((lead) => {
          const pipeline = pipelines.find((item) => item.id === lead.pipelineId);
          const stage = pipeline?.stages.find((item) => item.id === lead.stageId);
          const owner = team.find((member) => member.id === lead.assignedTo);
          return (
            <div key={lead.id} className="grid grid-cols-[1fr_150px_140px_120px_120px] gap-3 border-b border-[#edf2e9] py-3 text-sm">
              <span><strong>{lead.title}</strong><br /><span className="text-[#657267]">{lead.company}</span></span>
              <span>{pipeline?.name ?? lead.pipelineId}</span>
              <span>{owner?.name ?? "Unassigned"}</span>
              <span>{stage?.name ?? lead.stageId}</span>
              <span className="font-semibold">{currency(lead.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatusRows(leads: Lead[]) {
  const rows = [
    { name: "Won", matcher: (lead: Lead) => lead.stageId.includes("closed") || lead.stageId.includes("install") },
    { name: "Open", matcher: (lead: Lead) => !lead.stageId.includes("closed") && !lead.stageId.includes("install") },
    { name: "Abandoned", matcher: (lead: Lead) => lead.priority === "Cold" },
  ];
  return rows.map((row, index) => {
    const matched = leads.filter(row.matcher);
    return {
      name: row.name,
      count: matched.length,
      amount: matched.reduce((sum, lead) => sum + lead.amount, 0),
      color: colors[index],
    };
  });
}

function getStageRows(leads: Lead[], pipelines: Pipeline[], activePipeline?: Pipeline) {
  const stages = activePipeline ? activePipeline.stages : pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => ({ ...stage, name: `${pipeline.name}: ${stage.name}` })));
  return stages.map((stage, index) => {
    const matched = leads.filter((lead) => lead.stageId === stage.id);
    return {
      name: stage.name,
      count: matched.length,
      amount: matched.reduce((sum, lead) => sum + lead.amount, 0),
      color: colors[index % colors.length],
    };
  });
}
