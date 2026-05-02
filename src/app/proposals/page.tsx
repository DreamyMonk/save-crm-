"use client";

import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { QuoteRecord } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function ProposalsPage() {
  const { state } = useCrmStore();
  const [proposalSearch, setProposalSearch] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
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
  const selectedRow = proposalRows.find((row) => row.quote.id === selectedQuoteId) ?? proposalRows[0];
  const sentCount = state.quotes.filter((quote) => quote.proposalSentAt).length;
  const openedCount = state.quotes.filter((quote) => quote.proposalOpenedAt).length;
  const signedCount = state.quotes.filter((quote) => quote.customerSignedAt).length;
  const changesCount = state.quotes.filter((quote) => quote.proposalChangeRequestHtml).length;

  return (
    <CrmShell>
      <PageHeader eyebrow="Proposal section" title="Proposal tracking" />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Summary label="Sent proposals" value={String(sentCount)} />
          <Summary label="Opened by clients" value={String(openedCount)} />
          <Summary label="Signed proposals" value={String(signedCount)} />
          <Summary label="Change requests" value={String(changesCount)} />
        </div>

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
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                    <Th>Changes</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {proposalRows.map(({ quote, customerName, agent, proposalName, status }) => (
                    <tr key={quote.id} className={`border-t border-[#e5edf7] ${selectedRow?.quote.id === quote.id ? "bg-[#eef4ff]" : ""}`}>
                      <Td>
                        <button onClick={() => setSelectedQuoteId(quote.id)} className="text-left">
                          <span className="block font-semibold text-[#0f172a]">{proposalName}</span>
                          <span className="text-xs font-medium text-[#003CBB]">{quote.id}</span>
                        </button>
                      </Td>
                      <Td>{customerName}</Td>
                      <Td>{agent}</Td>
                      <Td><StatusPill status={status} /></Td>
                      <Td>{formatDateTime(quote.proposalSentAt)}</Td>
                      <Td>{formatDateTime(quote.proposalOpenedAt)}</Td>
                      <Td>{quote.proposalOpenCount ?? 0}</Td>
                      <Td>{formatDateTime(quote.customerSignedAt)}</Td>
                      <Td>{quote.proposalChangeRequestHtml ? formatDateTime(quote.proposalChangeRequestedAt) : "-"}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedQuoteId(quote.id)} className="inline-flex h-9 items-center rounded-lg border border-[#c7d3e8] px-3 text-xs font-semibold text-[#003CBB]">
                            View
                          </button>
                          <Link href={`/proposal/${quote.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#c7d3e8] px-3 text-xs font-semibold text-[#003CBB]">
                            <ExternalLink size={14} />
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {proposalRows.length === 0 ? (
                    <tr className="border-t border-[#e5edf7]">
                      <td colSpan={10} className="p-8 text-center text-[#657267]">No proposals match this search.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <aside className="border-t border-[#e5edf7] p-5 xl:border-l xl:border-t-0">
              <h3 className="text-lg font-semibold">Proposal details</h3>
              {selectedRow ? (
                <div className="mt-4 space-y-4">
                  <Detail label="Proposal" value={`${selectedRow.proposalName} (${selectedRow.quote.id})`} />
                  <Detail label="Customer" value={selectedRow.customerName} />
                  <Detail label="Agent" value={selectedRow.agent} />
                  <Detail label="Status" value={selectedRow.status} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#657267]">Client changes</p>
                    {selectedRow.quote.proposalChangeRequestHtml ? (
                      <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-[#d9e2f2] bg-[#f8fbff] p-4 text-sm leading-6 text-[#0f172a]" dangerouslySetInnerHTML={{ __html: selectedRow.quote.proposalChangeRequestHtml }} />
                    ) : (
                      <p className="mt-2 rounded-lg border border-dashed border-[#c7d3e8] bg-[#f8fbff] p-4 text-sm text-[#657267]">No change request submitted yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#657267]">Select a proposal to view details.</p>
              )}
            </aside>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#657267]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0f172a]">{value}</p>
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
    status === "Changes requested"
      ? "bg-rose-50 text-rose-700"
      : status === "Signed"
        ? "bg-emerald-50 text-emerald-700"
        : status === "Opened"
          ? "bg-blue-50 text-[#003CBB]"
          : status === "Sent"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-600";

  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

function proposalStatus(quote: QuoteRecord) {
  if (quote.proposalChangeRequestHtml) return "Changes requested";
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
