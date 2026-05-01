"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Invoice } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<CrmShell><PageHeader eyebrow="Billing manager" title="Create invoice" /></CrmShell>}>
      <NewInvoiceContent />
    </Suspense>
  );
}

function NewInvoiceContent() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState("");
  const sourceLead = state.leads.find((lead) => lead.id === searchParams.get("lead"));

  function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity")) || 1;
    const rate = Number(form.get("rate")) || sourceLead?.amount || 0;
    const taxRate = Number(form.get("taxRate")) || 0;
    const invoice: Invoice = {
      id: `INV-${String(250 + state.invoices.length + 1).padStart(4, "0")}`,
      client: String(form.get("client") || sourceLead?.company || "Client"),
      amount: quantity * rate,
      status: "Draft",
      issueDate: String(form.get("issueDate") || "Apr 28"),
      due: String(form.get("due") || "May 15"),
      owner: "Ravi Accounts",
      leadId: sourceLead?.id,
      billToEmail: String(form.get("billToEmail") || sourceLead?.email || ""),
      taxRate,
      paidAmount: 0,
      notes,
      lineItems: [
        {
          id: `LI-${Date.now()}`,
          description: String(form.get("description") || sourceLead?.title || "Service billing"),
          quantity,
          rate,
        },
      ],
    };
    setState({ ...state, invoices: [invoice, ...state.invoices] });
    router.push(`/invoices/${invoice.id}`);
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Billing manager" title="Create invoice" />
      <form onSubmit={createInvoice} className="m-4 grid max-w-6xl gap-5 rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 md:grid-cols-2">
          <Input name="client" label="Client" defaultValue={sourceLead?.company} required />
          <Input name="billToEmail" label="Billing email" type="email" defaultValue={sourceLead?.email} />
          <Input name="issueDate" label="Issue date" defaultValue="Apr 28" />
          <Input name="due" label="Due date" defaultValue="May 15" />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-[#657267]">Line item description</span>
            <input name="description" defaultValue={sourceLead?.title} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
          </label>
          <Input name="quantity" label="Quantity" type="number" defaultValue="1" />
          <Input name="rate" label="Rate" type="number" defaultValue={sourceLead?.amount} />
          <Input name="taxRate" label="Tax rate %" type="number" defaultValue="18" />
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-[#657267]">Billing notes</span>
            <RichTextEditor value={notes} onChange={setNotes} minHeight={170} />
          </label>
        </section>
        <aside className="rounded-lg bg-[#eef4ff] p-5">
          <h2 className="font-semibold">Billing setup</h2>
          <p className="mt-2 text-sm leading-6 text-[#4f5e55]">
            Create draft invoices, send them to clients, record payment, track balance, and download invoice copies from the invoice detail page.
          </p>
          <button className="mt-5 h-11 w-full rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white">Create draft invoice</button>
        </aside>
      </form>
    </CrmShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input {...props} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}
