"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Plus, ReceiptText, Search } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { currency, invoiceBalance, invoiceTotal } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";
import { useMemo, useState } from "react";

export default function InvoicesPage() {
  const { state } = useCrmStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = useMemo(() => {
    return state.invoices.filter((invoice) => {
      const matchesText = `${invoice.id} ${invoice.client} ${invoice.owner}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "All" || invoice.status === status;
      return matchesText && matchesStatus;
    });
  }, [query, state.invoices, status]);

  const receivable = state.invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const paid = state.invoices.reduce((sum, invoice) => sum + (invoice.paidAmount ?? 0), 0);
  const overdue = state.invoices.filter((invoice) => invoice.status === "Overdue").reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const draft = state.invoices.filter((invoice) => invoice.status === "Draft").length;

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Billing manager"
        title="Invoices and payments"
        actions={<ButtonLink href="/invoices/new" variant="lime"><Plus size={16} /> Create invoice</ButtonLink>}
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Receivable" value={currency(receivable)} icon={<ReceiptText size={18} />} />
          <Metric label="Paid collected" value={currency(paid)} icon={<CheckCircle2 size={18} />} />
          <Metric label="Overdue" value={currency(overdue)} icon={<AlertCircle size={18} />} />
          <Metric label="Draft invoices" value={String(draft)} icon={<Clock size={18} />} />
        </div>

        <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2e9] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-[#7c877e]" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or client" className="h-10 w-72 rounded-lg border border-[#d7dfd0] bg-white pl-9 pr-3 text-sm outline-none" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#d7dfd0] bg-white px-3 text-sm outline-none">
              <option>All</option>
              <option>Draft</option>
              <option>Sent</option>
              <option>Paid</option>
              <option>Overdue</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[150px_1.2fr_130px_130px_130px_120px] gap-3 border-b border-[#edf2e9] px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#657267]">
                <span>Invoice</span>
                <span>Client</span>
                <span>Total</span>
                <span>Paid</span>
                <span>Balance</span>
                <span>Status</span>
              </div>
              {filtered.map((invoice) => (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="grid grid-cols-[150px_1.2fr_130px_130px_130px_120px] gap-3 border-b border-[#edf2e9] px-4 py-4 text-sm transition hover:bg-[#f7faf2] last:border-b-0">
                  <span className="font-semibold">{invoice.id}</span>
                  <span>
                    <span className="block font-semibold">{invoice.client}</span>
                    <span className="text-[#657267]">{invoice.billToEmail ?? invoice.owner}</span>
                  </span>
                  <span className="font-semibold">{currency(invoiceTotal(invoice))}</span>
                  <span>{currency(invoice.paidAmount ?? 0)}</span>
                  <span className="font-semibold">{currency(invoiceBalance(invoice))}</span>
                  <span className={statusPill(invoice.status)}>{invoice.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </CrmShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#657267]">{label}</p>
        <span className="text-[#003CBB]">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function statusPill(status: string) {
  const base = "h-max w-max rounded-md px-2 py-1 text-xs font-semibold";
  if (status === "Paid") return `${base} bg-emerald-100 text-emerald-700`;
  if (status === "Overdue") return `${base} bg-rose-100 text-rose-700`;
  if (status === "Sent") return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-slate-100 text-slate-700`;
}
