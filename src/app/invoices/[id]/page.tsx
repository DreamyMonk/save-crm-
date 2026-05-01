"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { currency, invoiceBalance, invoiceSubtotal, invoiceTax, invoiceTotal, slugify } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { useCrmStore } from "@/lib/use-crm-store";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [payment, setPayment] = useState("");
  const invoice = state.invoices.find((item) => item.id === id);

  if (!invoice) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Billing manager" title="Invoice not found" actions={<ButtonLink href="/invoices">Back to billing</ButtonLink>} />
      </CrmShell>
    );
  }
  const currentInvoice = invoice;
  const invoiceId = currentInvoice.id;

  function updateInvoice(updates: Partial<typeof invoice>) {
    setState({
      ...state,
      invoices: state.invoices.map((item) => (item.id === invoiceId ? { ...item, ...updates } : item)),
    });
  }

  function sendInvoice() {
    updateInvoice({ status: "Sent" });
  }

  function recordPayment() {
    const amount = Number(payment);
    if (!amount) return;
    const paidAmount = (currentInvoice.paidAmount ?? 0) + amount;
    updateInvoice({ paidAmount, status: paidAmount >= invoiceTotal(currentInvoice) ? "Paid" : "Sent" });
    setPayment("");
  }

  async function downloadInvoice() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const items = currentInvoice.lineItems?.length
      ? currentInvoice.lineItems
      : [{ id: "legacy", description: "Billing amount", quantity: 1, rate: currentInvoice.amount }];
    let y = 84;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("SAVEPLANET BILLING", 20, 22);
    pdf.setFontSize(24);
    pdf.text(currentInvoice.id, 20, 38);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Bill to: ${currentInvoice.client}`, 20, 52);
    pdf.text(`Email: ${currentInvoice.billToEmail ?? "Not set"}`, 20, 60);
    pdf.text(`Issue: ${currentInvoice.issueDate ?? "Not set"} | Due: ${currentInvoice.due}`, 20, 68);

    pdf.setFont("helvetica", "bold");
    pdf.text("Description", 20, y);
    pdf.text("Qty", 116, y);
    pdf.text("Rate", 135, y);
    pdf.text("Amount", 165, y);
    y += 8;
    pdf.line(20, y - 4, 190, y - 4);
    pdf.setFont("helvetica", "normal");

    items.forEach((item) => {
      const description = pdf.splitTextToSize(item.description, 82);
      pdf.text(description, 20, y);
      pdf.text(String(item.quantity), 116, y);
      pdf.text(currency(item.rate), 135, y);
      pdf.text(currency(item.quantity * item.rate), 165, y);
      y += Math.max(10, description.length * 6);
    });

    y += 8;
    pdf.line(115, y - 5, 190, y - 5);
    pdf.text(`Subtotal: ${currency(invoiceSubtotal(currentInvoice))}`, 125, y);
    pdf.text(`Tax: ${currency(invoiceTax(currentInvoice))}`, 125, y + 8);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total: ${currency(invoiceTotal(currentInvoice))}`, 125, y + 18);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Paid: ${currency(currentInvoice.paidAmount ?? 0)}`, 125, y + 28);
    pdf.text(`Balance: ${currency(invoiceBalance(currentInvoice))}`, 125, y + 36);
    if (currentInvoice.notes) {
      pdf.text(pdf.splitTextToSize(`Notes: ${htmlToPlainText(currentInvoice.notes)}`, 170), 20, y + 54);
    }
    pdf.save(`${slugify(currentInvoice.client)}-${currentInvoice.id}.pdf`);
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow="Billing manager"
        title={`${invoice.id} · ${invoice.client}`}
        actions={<ButtonLink href="/invoices">Back to billing</ButtonLink>}
      />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
          <div className="border-b border-[#edf2e9] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#657267]">Bill to</p>
                <h2 className="mt-1 text-2xl font-semibold">{invoice.client}</h2>
                <p className="text-sm text-[#657267]">{invoice.billToEmail ?? "No billing email"}</p>
              </div>
              <span className="rounded-md bg-[#eef4ff] px-3 py-2 text-sm font-semibold">{invoice.status}</span>
            </div>
          </div>
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Box label="Total" value={currency(invoiceTotal(invoice))} />
              <Box label="Paid" value={currency(invoice.paidAmount ?? 0)} />
              <Box label="Balance" value={currency(invoiceBalance(invoice))} />
            </div>
            <div className="mt-6 overflow-hidden rounded-lg border border-[#edf2e9]">
              <div className="grid grid-cols-[1fr_80px_130px_130px] gap-3 bg-[#f7faf2] px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#657267]">
                <span>Description</span>
                <span>Qty</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
              {(invoice.lineItems?.length ? invoice.lineItems : [{ id: "legacy", description: "Billing amount", quantity: 1, rate: invoice.amount }]).map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_80px_130px_130px] gap-3 border-t border-[#edf2e9] px-4 py-4 text-sm">
                  <span className="font-medium">{item.description}</span>
                  <span>{item.quantity}</span>
                  <span>{currency(item.rate)}</span>
                  <span className="font-semibold">{currency(item.quantity * item.rate)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid justify-end gap-2 text-sm">
              <p>Subtotal: <strong>{currency(invoiceSubtotal(invoice))}</strong></p>
              <p>Tax: <strong>{currency(invoiceTax(invoice))}</strong></p>
              <p className="text-lg">Total: <strong>{currency(invoiceTotal(invoice))}</strong></p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Billing actions</h2>
            <div className="mt-4 grid gap-3">
              <button onClick={sendInvoice} className="h-11 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Mark as sent</button>
              <button onClick={downloadInvoice} className="h-11 rounded-lg border border-[#d7dfd0] bg-white px-4 text-sm font-semibold">Download invoice</button>
              <button onClick={() => updateInvoice({ status: "Overdue" })} className="h-11 rounded-lg border border-[#d7dfd0] bg-white px-4 text-sm font-semibold">Mark overdue</button>
            </div>
          </section>
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Record payment</h2>
            <div className="mt-3 flex gap-2">
              <input value={payment} onChange={(event) => setPayment(event.target.value)} type="number" placeholder="Amount" className="h-11 min-w-0 flex-1 rounded-lg border border-[#d7dfd0] px-3 outline-none" />
              <button onClick={recordPayment} className="rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-[#0f172a]">Save</button>
            </div>
          </section>
          <section className="rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Invoice notes</h2>
            <div className="mt-3">
              <RichTextEditor value={invoice.notes ?? ""} onChange={(value) => updateInvoice({ notes: value })} minHeight={170} />
            </div>
          </section>
        </aside>
      </div>
    </CrmShell>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#eef4ff] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657267]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
