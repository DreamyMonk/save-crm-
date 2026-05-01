"use client";

import { CheckCircle2, CircleDollarSign, KanbanSquare, Plus, ReceiptText } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { currency, invoiceBalance, invoiceTotal } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";
import { AnalyticsDashboard } from "@/components/report-widgets";
import { useState } from "react";

export default function DashboardPage() {
  const { state } = useCrmStore();
  const [selectedPipelineId, setSelectedPipelineId] = useState("all");
  const openLeads = state.leads.filter((lead) => !lead.stageId.includes("closed"));
  const pipelineValue = openLeads.reduce((sum, lead) => sum + lead.amount, 0);
  const weighted = openLeads.reduce((sum, lead) => sum + lead.amount * (lead.probability / 100), 0);
  const closed = state.leads.filter((lead) => lead.stageId.includes("closed")).reduce((sum, lead) => sum + lead.amount, 0);
  const due = state.invoices.filter((invoice) => invoice.status !== "Paid").reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Sales command center"
        actions={
          <>
            <ButtonLink href="/leads/new" variant="lime">
              <Plus size={16} /> New lead
            </ButtonLink>
            <ButtonLink href="/invoices/new">Create invoice</ButtonLink>
          </>
        }
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Open pipeline" value={currency(pipelineValue)} note="Active lead value" icon={<KanbanSquare size={18} />} />
          <Metric label="Weighted forecast" value={currency(weighted)} note="Probability based" icon={<CircleDollarSign size={18} />} />
          <Metric label="Closed sales" value={currency(closed)} note="Won opportunities" icon={<CheckCircle2 size={18} />} />
          <Metric label="Invoice due" value={currency(due)} note="Sent and overdue" icon={<ReceiptText size={18} />} />
        </div>
        <AnalyticsDashboard
          leads={state.leads}
          pipelines={state.pipelines}
          team={state.team}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          compact
        />
        <section className="grid gap-6 xl:grid-cols-[1fr_0.6fr]">
          <div className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Recent invoices</h2>
            <div className="mt-4 space-y-3">
              {state.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-[#edf2e9] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{invoice.client}</p>
                    <span className="text-sm font-semibold">{currency(invoiceTotal(invoice))}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#657267]">{invoice.id} · {invoice.status} · due {invoice.due}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Report center</h2>
            <p className="mt-2 text-sm leading-6 text-[#657267]">Open the detailed reports page for agent performance, lead table, conversion and full stage distribution.</p>
            <ButtonLink href="/reports" variant="light">Open detailed reports</ButtonLink>
          </div>
        </section>
      </div>
    </CrmShell>
  );
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#657267]">{label}</p>
        <span className="text-[#003CBB]">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-[#7c877e]">{note}</p>
    </div>
  );
}
