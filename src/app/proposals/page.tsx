"use client";

import Link from "next/link";
import { ExternalLink, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { ProposalPackage, QuoteRecord } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

type ProposalRow = {
  quote?: QuoteRecord;
  proposalPackage?: ProposalPackage;
  quoteId: string;
  customerName: string;
  agent: string;
  proposalName: string;
  status: ProposalPackage["status"];
  sentAt?: string;
  openedAt?: string;
  openCount: number;
  signedAt?: string;
  changeRequestHtml?: string;
  changeRequestedAt?: string;
  activityDate?: string;
};

export default function ProposalsPage() {
  const { state, setState } = useCrmStore();
  const { member: currentMember } = useCurrentTeamMember(state.team);
  const canDeleteProposals = isAdminMember(currentMember);
  const [proposalSearch, setProposalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const proposalRows = useMemo(() => {
    const term = proposalSearch.trim().toLowerCase();
    const packageByQuote = new Map(state.proposalPackages.map((proposalPackage) => [proposalPackage.quoteId, proposalPackage]));
    const quoteIds = new Set(state.quotes.map((quote) => quote.id));
    const quoteRows: ProposalRow[] = state.quotes.map((quote) => {
      const customer = state.customers.find((item) => item.id === quote.customerId);
      const proposalPackage = packageByQuote.get(quote.id);
      const agent = quote.proposalSentBy || proposalPackage?.sentBy || proposalPackage?.assignedAgent || customer?.salesAgent || "Not sent";
      const customerName = customer?.name || customer?.businessName || "Unknown customer";
      const proposalName = quote.description || quote.id;
      return {
        quote,
        proposalPackage,
        quoteId: quote.id,
        agent,
        customerName,
        proposalName,
        status: proposalPackage?.status ?? proposalStatus(quote),
        sentAt: quote.proposalSentAt ?? proposalPackage?.sentAt,
        openedAt: quote.proposalOpenedAt ?? proposalPackage?.openedAt,
        openCount: quote.proposalOpenCount ?? proposalPackage?.openCount ?? 0,
        signedAt: quote.customerSignedAt ?? proposalPackage?.signedAt,
        changeRequestHtml: quote.proposalChangeRequestHtml ?? proposalPackage?.changeRequestHtml,
        changeRequestedAt: quote.proposalChangeRequestedAt ?? proposalPackage?.changeRequestedAt,
        activityDate: proposalActivityDate(quote) ?? proposalPackage?.lastActivityAt,
      };
    });
    const packageRows: ProposalRow[] = state.proposalPackages
      .filter((proposalPackage) => !quoteIds.has(proposalPackage.quoteId))
      .map((proposalPackage) => {
        const customer = state.customers.find((item) => item.id === proposalPackage.customerId);
        const customerName = customer?.name || customer?.businessName || "Unknown customer";
        const categoryLabel = proposalPackage.productCategory ? `${proposalPackage.productCategory} proposal` : "Proposal";
        return {
          proposalPackage,
          quoteId: proposalPackage.quoteId,
          customerName,
          agent: proposalPackage.sentBy || proposalPackage.assignedAgent || customer?.salesAgent || "Not sent",
          proposalName: categoryLabel,
          status: proposalPackage.status,
          sentAt: proposalPackage.sentAt,
          openedAt: proposalPackage.openedAt,
          openCount: proposalPackage.openCount ?? 0,
          signedAt: proposalPackage.signedAt,
          changeRequestHtml: proposalPackage.changeRequestHtml,
          changeRequestedAt: proposalPackage.changeRequestedAt,
          activityDate: proposalPackage.lastActivityAt,
        };
      });
    return [...quoteRows, ...packageRows].filter((row) => {
      const matchesSearch = !term || [row.quoteId, row.proposalName, row.agent, row.customerName].join(" ").toLowerCase().includes(term);
      return matchesSearch && matchesStatusFilter(row, statusFilter) && matchesDateFilter(row, dateFilter, rangeStart, rangeEnd);
    });
  }, [dateFilter, proposalSearch, rangeEnd, rangeStart, state.customers, state.proposalPackages, state.quotes, statusFilter]);
  const selectedRow = proposalRows.find((row) => row.quoteId === selectedQuoteId) ?? proposalRows[0];
  const packageRows = state.proposalPackages.length
    ? state.proposalPackages
    : state.quotes.map((quote) => ({
        sentAt: quote.proposalSentAt,
        openedAt: quote.proposalOpenedAt,
        signedAt: quote.customerSignedAt,
        changeRequestHtml: quote.proposalChangeRequestHtml,
      }));
  const sentCount = packageRows.filter((proposalPackage) => proposalPackage.sentAt).length;
  const openedCount = packageRows.filter((proposalPackage) => proposalPackage.openedAt).length;
  const signedCount = packageRows.filter((proposalPackage) => proposalPackage.signedAt).length;
  const changesCount = packageRows.filter((proposalPackage) => proposalPackage.changeRequestHtml).length;

  function deleteProposal(quote: QuoteRecord) {
    if (!canDeleteProposals || !canDeleteProposal(quote)) return;
    const confirmed = window.confirm(`Delete proposal ${quote.id}?`);
    if (!confirmed) return;
    setState((currentState) => {
      const linkedPackage = currentState.proposalPackages.find((item) => item.quoteId === quote.id);
      return {
        ...currentState,
        deletedQuoteIds: Array.from(new Set([...(currentState.deletedQuoteIds ?? []), quote.id])),
        deletedProposalPackageIds: linkedPackage ? Array.from(new Set([...(currentState.deletedProposalPackageIds ?? []), linkedPackage.id])) : currentState.deletedProposalPackageIds,
        deletedInvoiceIds: linkedPackage?.invoiceId ? Array.from(new Set([...(currentState.deletedInvoiceIds ?? []), linkedPackage.invoiceId])) : currentState.deletedInvoiceIds,
        quotes: currentState.quotes.filter((item) => item.id !== quote.id),
        proposalPackages: currentState.proposalPackages.filter((item) => item.quoteId !== quote.id),
        invoices: linkedPackage?.invoiceId ? currentState.invoices.filter((invoice) => invoice.id !== linkedPackage.invoiceId) : currentState.invoices,
      };
    });
    if (selectedQuoteId === quote.id) {
      setSelectedQuoteId("");
      setDetailsOpen(false);
    }
  }

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
          <div className="grid gap-3 border-b border-[#e5edf7] p-5 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label="Status" value={statusFilter} options={["All", "Signed", "Opened", "Not opened", "Changes requested", "Sent", "Draft"]} onChange={setStatusFilter} />
            <FilterSelect label="Date" value={dateFilter} options={["All", "Today", "Yesterday", "Range"]} onChange={setDateFilter} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">From</span>
              <input
                type="date"
                value={rangeStart}
                disabled={dateFilter !== "Range"}
                onChange={(event) => setRangeStart(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none disabled:bg-[#f4f6f2] disabled:text-[#9aa59a]"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">To</span>
              <input
                type="date"
                value={rangeEnd}
                disabled={dateFilter !== "Range"}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none disabled:bg-[#f4f6f2] disabled:text-[#9aa59a]"
              />
            </label>
          </div>
          <div>
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
                  {proposalRows.map((row) => (
                    <tr key={row.quoteId} className={`border-t border-[#e5edf7] ${selectedRow?.quoteId === row.quoteId ? "bg-[#eef4ff]" : ""}`}>
                      <Td>
                        <button onClick={() => { setSelectedQuoteId(row.quoteId); setDetailsOpen(true); }} className="text-left">
                          <span className="block font-semibold text-[#0f172a]">{row.proposalName}</span>
                          <span className="text-xs font-medium text-[#003CBB]">{row.quoteId}</span>
                        </button>
                      </Td>
                      <Td>{row.customerName}</Td>
                      <Td>{row.agent}</Td>
                      <Td><StatusPill status={row.status} /></Td>
                      <Td>{formatDateTime(row.sentAt)}</Td>
                      <Td>{formatDateTime(row.openedAt)}</Td>
                      <Td>{row.openCount}</Td>
                      <Td>{formatDateTime(row.signedAt)}</Td>
                      <Td>{row.changeRequestHtml ? formatDateTime(row.changeRequestedAt) : "-"}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setSelectedQuoteId(row.quoteId); setDetailsOpen(true); }} className="inline-flex h-9 items-center rounded-lg border border-[#c7d3e8] px-3 text-xs font-semibold text-[#003CBB]">
                            View
                          </button>
                          {row.quote ? (
                            <Link href={`/quotes/${row.quoteId}/proposal`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#003CBB] px-3 text-xs font-semibold text-white">
                              <ExternalLink size={14} /> Open proposal
                            </Link>
                          ) : (
                            <span className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-500">Saved status only</span>
                          )}
                          {row.quote && canDeleteProposals && canDeleteProposal(row.quote) ? (
                            <button onClick={() => { if (row.quote) deleteProposal(row.quote); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white">
                              <Trash2 size={14} /> Delete
                            </button>
                          ) : null}
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
          </div>
        </section>
        {detailsOpen && selectedRow ? (
          <div className="fixed inset-0 z-50 bg-[#0f172a]/30" onClick={() => setDetailsOpen(false)}>
            <aside
              className="ml-auto flex h-full w-full max-w-[420px] flex-col border-l border-[#d9e2f2] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#e5edf7] p-5">
                <h3 className="text-lg font-semibold">Proposal details</h3>
                <button onClick={() => setDetailsOpen(false)} className="grid size-9 place-items-center rounded-lg border border-[#c7d3e8] text-[#003CBB]" aria-label="Close proposal details">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <Detail label="Proposal" value={`${selectedRow.proposalName} (${selectedRow.quoteId})`} />
                <Detail label="Package" value={selectedRow.proposalPackage?.id ?? `PP-${selectedRow.quoteId}`} />
                <Detail label="Invoice" value={selectedRow.proposalPackage?.invoiceId ?? "Not generated yet"} />
                <Detail label="Customer" value={selectedRow.customerName} />
                <Detail label="Agent" value={selectedRow.agent} />
                <Detail label="Substitute agent" value={selectedRow.proposalPackage?.substituteAgent || "Not assigned"} />
                <Detail label="Status" value={selectedRow.status} />
                {selectedRow.quote ? (
                  <Link href={`/quotes/${selectedRow.quoteId}/proposal`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
                    <ExternalLink size={16} /> Open proposal
                  </Link>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#c7d3e8] bg-[#f8fbff] p-3 text-sm text-[#657267]">
                    Proposal status is saved, but the quote detail is not available on this device yet.
                  </p>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#657267]">Client changes</p>
                  {selectedRow.changeRequestHtml ? (
                    <div className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#d9e2f2] bg-[#f8fbff] p-4 text-sm leading-6 text-[#0f172a]">
                      {htmlToPlainText(selectedRow.changeRequestHtml)}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-[#c7d3e8] bg-[#f8fbff] p-4 text-sm text-[#657267]">No change request submitted yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
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

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none focus:border-[#003CBB]">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
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
  if (quote.customerSignedAt) return "Signed";
  if (quote.proposalChangeRequestHtml) return "Changes requested";
  if (quote.proposalOpenedAt) return "Opened";
  if (quote.proposalSentAt) return "Sent";
  return "Draft";
}

function canDeleteProposal(quote: QuoteRecord) {
  return !quote.proposalOpenedAt && !quote.customerSignedAt && !quote.proposalChangeRequestHtml;
}

function isAdminMember(member: { role: string } | null | undefined) {
  return member?.role.trim().toLowerCase() === "admin";
}

function matchesStatusFilter(row: ProposalRow, statusFilter: string) {
  if (statusFilter === "All") return true;
  if (statusFilter === "Signed") return Boolean(row.signedAt) || row.status === "Signed";
  if (statusFilter === "Opened") return (Boolean(row.openedAt) || row.status === "Opened") && !row.signedAt && !row.changeRequestHtml;
  if (statusFilter === "Not opened") return Boolean(row.sentAt) && !row.openedAt;
  if (statusFilter === "Changes requested") return Boolean(row.changeRequestHtml) || row.status === "Changes requested";
  if (statusFilter === "Sent") return (Boolean(row.sentAt) || row.status === "Sent") && !row.openedAt && !row.signedAt && !row.changeRequestHtml;
  if (statusFilter === "Draft") return !row.sentAt && row.status === "Draft";
  return true;
}

function matchesDateFilter(row: ProposalRow, dateFilter: string, rangeStart: string, rangeEnd: string) {
  if (dateFilter === "All") return true;
  const value = row.activityDate;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  if (dateFilter === "Today") return isSameLocalDay(timestamp, new Date());
  if (dateFilter === "Yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameLocalDay(timestamp, yesterday);
  }
  if (dateFilter === "Range") {
    const start = rangeStart ? startOfLocalDay(rangeStart).getTime() : Number.NEGATIVE_INFINITY;
    const end = rangeEnd ? endOfLocalDay(rangeEnd).getTime() : Number.POSITIVE_INFINITY;
    return timestamp >= start && timestamp <= end;
  }
  return true;
}

function proposalActivityDate(quote: QuoteRecord) {
  return quote.proposalChangeRequestedAt || quote.customerSignedAt || quote.proposalOpenedAt || quote.proposalSentAt || quote.activityDate;
}

function isSameLocalDay(timestamp: number, day: Date) {
  const date = new Date(timestamp);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function startOfLocalDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
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
