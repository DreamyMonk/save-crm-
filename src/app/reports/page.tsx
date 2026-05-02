"use client";

import Link from "next/link";
import { Download, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { AnalyticsDashboard } from "@/components/report-widgets";
import { currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function ReportsPage() {
  const { state } = useCrmStore();
  const [selectedPipelineId, setSelectedPipelineId] = useState("all");
  const [proposalSearch, setProposalSearch] = useState("");
  const filteredLeads = selectedPipelineId === "all" ? state.leads : state.leads.filter((lead) => lead.pipelineId === selectedPipelineId);
  const totalValue = filteredLeads.reduce((sum, lead) => sum + lead.amount, 0);
  const weighted = filteredLeads.reduce((sum, lead) => sum + lead.amount * (lead.probability / 100), 0);
  const won = filteredLeads.filter((lead) => lead.stageId.includes("closed") || lead.stageId.includes("install"));
  const proposalRows = useMemo(() => {
    const term = proposalSearch.trim().toLowerCase();
    return state.quotes
      .map((quote) => {
        const customer = state.customers.find((item) => item.id === quote.customerId);
        const agent = quote.proposalSentBy || customer?.salesAgent || "Not sent";
        const customerName = customer?.name || customer?.businessName || "Unknown customer";
        const proposalName = quote.description || quote.id;
        return {
          quote,
          customer,
          agent,
          customerName,
          proposalName,
          status: proposalStatus(quote),
        };
      })
      .filter(({ quote, customerName, agent, proposalName }) => {
        if (!term) return true;
        return [quote.id, proposalName, agent, customerName].join(" ").toLowerCase().includes(term);
      });
  }, [proposalSearch, state.customers, state.quotes]);
  const sentCount = state.quotes.filter((quote) => quote.proposalSentAt).length;
  const openedCount = state.quotes.filter((quote) => quote.proposalOpenedAt).length;
  const signedCount = state.quotes.filter((quote) => quote.customerSignedAt).length;

  function downloadCsv() {
    const header = ["Lead", "Company", "Pipeline", "Stage", "Amount", "Probability", "Owner"];
    const rows = filteredLeads.map((lead) => {
      const pipeline = state.pipelines.find((item) => item.id === lead.pipelineId);
      const stage = pipeline?.stages.find((item) => item.id === lead.stageId);
      const owner = state.team.find((member) => member.id === lead.assignedTo);
      return [lead.title, lead.company, pipeline?.name ?? lead.pipelineId, stage?.name ?? lead.stageId, String(lead.amount), String(lead.probability), owner?.name ?? ""];
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
        <AnalyticsDashboard
          leads={state.leads}
          pipelines={state.pipelines}
          team={state.team}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
        />
        <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf7] p-5">
            <div>
              <p className="text-sm font-medium text-[#657267]">Proposal history</p>
              <h2 className="text-xl font-semibold">Previously sent proposals</h2>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#657267]" size={17} />
              <input
                value={proposalSearch}
                onChange={(event) => setProposalSearch(event.target.value)}
                placeholder="Search proposal, agent, or customer"
                className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#003CBB]"
              />
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-3">
            <Summary label="Sent proposals" value={String(sentCount)} />
            <Summary label="Opened by clients" value={String(openedCount)} />
            <Summary label="Signed proposals" value={String(signedCount)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#f6f8fc] text-left text-xs uppercase tracking-[0.04em] text-[#657267]">
                <tr>
                  <Th>Proposal</Th>
                  <Th>Customer</Th>
                  <Th>Sent by</Th>
                  <Th>Status</Th>
                  <Th>Sent</Th>
                  <Th>Last opened</Th>
                  <Th>Opens</Th>
                  <Th>Signed</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {proposalRows.map(({ quote, customerName, agent, proposalName, status }) => (
                  <tr key={quote.id} className="border-t border-[#e5edf7]">
                    <Td>
                      <div className="font-semibold text-[#0f172a]">{proposalName}</div>
                      <div className="text-xs font-medium text-[#003CBB]">{quote.id}</div>
                    </Td>
                    <Td>{customerName}</Td>
                    <Td>{agent}</Td>
                    <Td><StatusPill status={status} /></Td>
                    <Td>{formatDateTime(quote.proposalSentAt)}</Td>
                    <Td>{formatDateTime(quote.proposalOpenedAt)}</Td>
                    <Td>{quote.proposalOpenCount ?? 0}</Td>
                    <Td>{formatDateTime(quote.customerSignedAt)}</Td>
                    <Td>
                      <Link href={`/proposal/${quote.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#c7d3e8] px-3 text-xs font-semibold text-[#003CBB]">
                        <ExternalLink size={14} /> View
                      </Link>
                    </Td>
                  </tr>
                ))}
                {proposalRows.length === 0 ? (
                  <tr className="border-t border-[#e5edf7]">
                    <td colSpan={9} className="p-8 text-center text-[#657267]">No proposals match this search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#0f172a]">{children}</td>;
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "Signed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Opened"
        ? "bg-blue-50 text-[#003CBB]"
        : status === "Sent"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

function proposalStatus(quote: { proposalSentAt?: string; proposalOpenedAt?: string; customerSignedAt?: string }) {
  if (quote.customerSignedAt) return "Signed";
  if (quote.proposalOpenedAt) return "Opened";
  if (quote.proposalSentAt) return "Sent";
  return "Draft";
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
