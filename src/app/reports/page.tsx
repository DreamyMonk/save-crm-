"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { AnalyticsDashboard } from "@/components/report-widgets";
import { currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function ReportsPage() {
  const { state } = useCrmStore();
  const [selectedPipelineId, setSelectedPipelineId] = useState("all");
  const filteredLeads = selectedPipelineId === "all" ? state.leads : state.leads.filter((lead) => lead.pipelineId === selectedPipelineId);
  const totalValue = filteredLeads.reduce((sum, lead) => sum + lead.amount, 0);
  const weighted = filteredLeads.reduce((sum, lead) => sum + lead.amount * (lead.probability / 100), 0);
  const won = filteredLeads.filter((lead) => lead.stageId.includes("closed") || lead.stageId.includes("install"));

  function downloadCsv() {
    const header = ["Lead", "Company", "Source", "Sales phase", "Pipeline", "Stage", "Amount", "Ticket size", "Probability", "Owner", "Calls", "Last contacted"];
    const rows = filteredLeads.map((lead) => {
      const pipeline = state.pipelines.find((item) => item.id === lead.pipelineId);
      const stage = pipeline?.stages.find((item) => item.id === lead.stageId);
      const owner = state.team.find((member) => member.id === lead.assignedTo);
      return [
        lead.title,
        lead.company,
        lead.leadSource ?? lead.source,
        lead.salesPhase ?? "",
        pipeline?.name ?? lead.pipelineId,
        stage?.name ?? lead.stageId,
        String(lead.amount),
        String(lead.ticketSize ?? lead.amount),
        String(lead.probability),
        owner?.name ?? "",
        String(lead.callCount ?? 0),
        lead.lastContactedAt ?? "",
      ];
    });
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "saveplanet-detailed-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Reports"
        title="Detailed sales analytics"
        actions={
          <button onClick={downloadCsv} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white shadow-sm">
            <Download size={16} /> Export CSV
          </button>
        }
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Total opportunity value" value={currency(totalValue)} />
          <Summary label="Weighted forecast" value={currency(weighted)} />
          <Summary label="Won opportunities" value={String(won.length)} />
          <Summary label="Total leads" value={String(filteredLeads.length)} />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Manual leads" value={String(filteredLeads.filter((lead) => (lead.leadSource ?? lead.source) === "Manual").length)} />
          <Summary label="Meta ad leads" value={String(filteredLeads.filter((lead) => (lead.leadSource ?? lead.source) === "Meta Ads").length)} />
          <Summary label="Google ad leads" value={String(filteredLeads.filter((lead) => (lead.leadSource ?? lead.source) === "Google Ads").length)} />
          <Summary label="Agent calls logged" value={String(filteredLeads.reduce((sum, lead) => sum + (lead.callCount ?? 0), 0))} />
        </div>
        <AnalyticsDashboard
          leads={state.leads}
          pipelines={state.pipelines}
          team={state.team}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
        />
      </div>
    </CrmShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-[#657267]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
