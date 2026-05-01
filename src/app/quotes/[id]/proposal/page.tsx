"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Save } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Customer, QuoteLineItem, QuoteRecord, currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

const TEMPLATE_URL = "/saveplanet-aircon-proposal-template.html";

export default function DraftProposalPage() {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");
  const [proposalHtml, setProposalHtml] = useState("");
  const quote = useMemo(() => {
    const fromState = state.quotes.find((item) => item.id === id);
    if (fromState) return fromState;
    if (typeof window === "undefined") return undefined;
    const saved = window.localStorage.getItem(`saveplanet-quote-${id}`);
    if (!saved) return undefined;
    try {
      return JSON.parse(saved) as QuoteRecord;
    } catch {
      return undefined;
    }
  }, [id, state.quotes]);
  const customer = state.customers.find((item) => item.id === quote?.customerId);
  const calculations = useMemo(() => {
    if (!quote) return undefined;
    return calculateQuote(quote.items, quote.additionalServices, quote.certificateRate, quote.minimumContributionAdjustment, quote.gstRate);
  }, [quote]);

  useEffect(() => {
    if (!quote || !calculations) return;
    let cancelled = false;
    fetch(TEMPLATE_URL)
      .then((response) => response.text())
      .then((template) => {
        if (!cancelled) setProposalHtml(buildProposalHtml(template, quote, customer, calculations));
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load the static proposal template.");
      });
    return () => {
      cancelled = true;
    };
  }, [quote, customer, calculations]);

  if (!quote || !calculations) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Draft proposal" title="Proposal not found" actions={<Link href="/quotes" className="rounded-lg bg-[#003CBB] px-4 py-2 text-sm font-semibold text-white">Back to quotes</Link>} />
      </CrmShell>
    );
  }

  function saveProposal() {
    if (!quote) return;
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quote.id ? { ...item, status: "Saved" } : item)),
    });
    setMessage("Proposal saved.");
  }

  function downloadPdf() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow={quote.id}
        title="Draft proposal"
        actions={
          <>
            <Link href="/quotes" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold text-[#003CBB]">
              <ArrowLeft size={16} /> Back
            </Link>
            <button onClick={saveProposal} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} /> Save proposal
            </button>
            <button onClick={downloadPdf} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white">
              <Download size={16} /> Download PDF
            </button>
          </>
        }
      />
      {message ? <p className="mx-8 mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
      <main className="bg-[#dfe6df] p-6">
        <iframe
          ref={iframeRef}
          title="SavePlanet drafted proposal"
          srcDoc={proposalHtml}
          className="mx-auto h-[calc(100vh-190px)] min-h-[760px] w-full max-w-[1060px] rounded border border-[#c7d3e8] bg-white shadow-lg"
        />
      </main>
    </CrmShell>
  );
}

function buildProposalHtml(template: string, quote: QuoteRecord, customer: Customer | undefined, calculations: Calculations) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, "text/html");
  const quotePage = doc.querySelector(".quot-pad")?.closest(".page");

  const title = doc.querySelector("title");
  if (title) title.textContent = `SavePlanet - ${quote.id} Proposal`;

  const coverValues = doc.querySelectorAll(".cov-card-item span");
  if (coverValues[0]) coverValues[0].textContent = customerName(customer);
  if (coverValues[1]) coverValues[1].textContent = quote.id;
  if (coverValues[2]) coverValues[2].textContent = validUntil(quote.activityDate);

  const dateNode = doc.querySelector("#qd1");
  if (dateNode) dateNode.textContent = formatDate(quote.activityDate);

  const quoteStrong = doc.querySelectorAll(".quot-title-side .qd strong")[1];
  if (quoteStrong) quoteStrong.textContent = quote.id;

  const billTo = doc.querySelectorAll(".quot-to-card")[0];
  if (billTo) {
    const name = billTo.querySelector(".name");
    const details = billTo.querySelector("p");
    if (name) name.textContent = customerName(customer);
    if (details) details.innerHTML = `Phone: ${escapeHtml(customer?.phone || customer?.mobile || "To be confirmed")}<br>Address: ${escapeHtml(customerAddress(customer))}`;
  }

  const installTo = doc.querySelectorAll(".quot-to-card")[1];
  if (installTo) {
    const name = installTo.querySelector(".name");
    const details = installTo.querySelector("p");
    if (name) name.textContent = customerAddress(customer);
    if (details) details.innerHTML = `Property type: ${escapeHtml(customer?.customerType || "To be confirmed")}<br>Access notes: To be confirmed on site`;
  }

  const metaValues = doc.querySelectorAll(".quot-meta .qm-v");
  if (metaValues[0]) metaValues[0].textContent = quote.id;
  if (metaValues[1]) metaValues[1].textContent = customer?.salesAgent || "SavePlanet";
  if (metaValues[2]) metaValues[2].textContent = customer?.paymentTermsValue ? `${customer.paymentTermsValue} ${customer.paymentTermsUnit}` : "10% Deposit";

  const quoteTableBody = doc.querySelector(".qt tbody");
  if (quoteTableBody) quoteTableBody.innerHTML = quotationRows(quote.items, quote.additionalServices);

  const totalValues = doc.querySelectorAll(".totals-block .tot-line .v");
  if (totalValues[0]) totalValues[0].textContent = currency(calculations.productCost + calculations.installCost);
  if (totalValues[1]) totalValues[1].textContent = currency(calculations.netIncGst - calculations.netExGst);
  if (totalValues[2]) totalValues[2].textContent = currency(calculations.totalCost);
  if (totalValues[3]) totalValues[3].textContent = `-${currency(calculations.certificateDiscount)}`;
  if (totalValues[4]) totalValues[4].textContent = currency(calculations.netIncGst);
  if (totalValues[5]) totalValues[5].textContent = currency(0);
  if (totalValues[6]) totalValues[6].textContent = currency(calculations.netIncGst);

  const bankReference = doc.querySelectorAll(".bank-row .v")[3];
  if (bankReference) bankReference.textContent = quote.id;

  if (quotePage) {
    const fragment = doc.createElement("template");
    fragment.innerHTML = `${productSummaryPage(quote, calculations)}${sizingGuidePage(quote, customer)}`;
    quotePage.before(fragment.content);
  }

  const script = doc.createElement("script");
  script.textContent = "if(window.lucide){window.lucide.createIcons();}";
  doc.body.appendChild(script);
  const style = doc.createElement("style");
  style.textContent = ".cov-card-item span{display:block;max-width:100%;overflow-wrap:anywhere;line-height:1.35;}.cov-card{align-items:start;}";
  doc.head.appendChild(style);
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function productSummaryPage(quote: QuoteRecord, calculations: Calculations) {
  const rows = [...quote.items, ...quote.additionalServices].map((item) => `
    <tr>
      <td>${escapeHtml(`${item.brand} ${item.model}`)}<span class="desc-sub">${escapeHtml(`${item.role} - ${item.area || "Whole home"}`)}</span></td>
      <td class="c">${item.quantity}</td>
      <td class="r">${currency(item.productPrice)}</td>
      <td class="r">${currency(item.installPrice)}</td>
      <td class="r">${currency((item.productPrice + item.installPrice) * item.quantity)}</td>
    </tr>
  `).join("");

  return `
    <div class="page">
      <div class="quot-pad">
        <div class="sec-eyebrow"><i data-lucide="package-check"></i> Proposal Data</div>
        <h1 class="sec-h1">Items <em>Summary</em></h1>
        <div class="sec-rule"></div>
        <p class="sec-lead">Product summary created from the selected MIDEA outdoor unit, indoor heads, installation items, and additional services.</p>
        <table class="qt">
          <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Install</th><th class="r">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals-block" style="margin-left:auto;width:360px;">
          <div class="tot-line"><span class="l">Total product cost</span><span class="v">${currency(calculations.productCost)}</span></div>
          <div class="tot-line"><span class="l">Total install cost</span><span class="v">${currency(calculations.installCost)}</span></div>
          <div class="tot-line veec"><span class="l">Government rebate / certificate discount</span><span class="v">-${currency(calculations.certificateDiscount)}</span></div>
          <div class="tot-line due"><span class="l">Net cost incl. GST</span><span class="v">${currency(calculations.netIncGst)}</span></div>
        </div>
      </div>
      <div class="page-foot-brand"><span>SavePlanet</span> - Items Summary</div>
      <div class="page-num">Appendix A</div>
    </div>
  `;
}

function sizingGuidePage(quote: QuoteRecord, customer: Customer | undefined) {
  const heads = quote.items.filter((item) => item.role === "Indoor Head");
  const existingRows = heads.map((item) => `
    <tr>
      <td>${escapeHtml(item.area || "Room")}</td>
      <td>${item.areaM2 ?? 0}</td>
      <td>Gas ducted heater / existing equipment to be confirmed</td>
    </tr>
  `).join("");
  const proposedRows = heads.map((item) => `
    <tr>
      <td>${escapeHtml(item.area || "Room")}</td>
      <td>${item.areaM2 ?? 0} m2</td>
      <td>${escapeHtml(item.recommendedHeatingOutput || "To be confirmed")}</td>
      <td>${escapeHtml(`${item.brand} ${item.model}`)}</td>
      <td>Yes</td>
      <td>Customer requested and installer to confirm during site assessment.</td>
    </tr>
  `).join("");

  return `
    <div class="page">
      <div class="quot-pad">
        <div class="sec-eyebrow"><i data-lucide="ruler"></i> Installation Guide</div>
        <h1 class="sec-h1">System Sizing <em>Guide</em></h1>
        <div class="sec-rule"></div>
        <p class="sec-lead">System Sizing Guide for Installation of Multi-Head Reverse Cycle Air Conditioning System.</p>
        <div class="quot-to-bar">
          <div class="quot-to-card"><label>Customer Name</label><div class="name">${escapeHtml(customerName(customer))}</div><p>Proposal #: ${escapeHtml(quote.id)}<br>Date: ${escapeHtml(formatDate(quote.activityDate))}</p></div>
          <div class="quot-to-card"><label>Customer Address</label><div class="name">${escapeHtml(customerAddress(customer))}</div><p>Scheme: ${escapeHtml(quote.scheme)}<br>Install tier: ${escapeHtml(quote.installationCostTier)}</p></div>
        </div>
        <h3 style="font-family:'Sora';font-size:15px;margin:22px 0 8px;">Existing heater in home</h3>
        <table class="qt">
          <thead><tr><th>Room</th><th>Area of room (m2)</th><th>Existing Product</th></tr></thead>
          <tbody>${existingRows || `<tr><td colspan="3">Room details to be confirmed.</td></tr>`}</tbody>
        </table>
        <h3 style="font-family:'Sora';font-size:15px;margin:22px 0 8px;">Proposed multi-head HVAC to be installed</h3>
        <table class="qt">
          <thead><tr><th>Room</th><th>Area</th><th>Required Heating Output</th><th>Heating Output of Unit</th><th>Meets Sizing Guide</th><th>Justification</th></tr></thead>
          <tbody>${proposedRows || `<tr><td colspan="6">Indoor head details to be confirmed.</td></tr>`}</tbody>
        </table>
        <div class="quot-to-bar" style="margin-top:20px;">
          <div class="quot-to-card"><label>Customer</label><div class="name">Signature</div><p>Name: ${escapeHtml(customerName(customer))}<br>Date: __________________</p></div>
          <div class="quot-to-card"><label>Installer</label><div class="name">Signature</div><p>Name: __________________<br>Date: __________________</p></div>
        </div>
      </div>
      <div class="page-foot-brand"><span>SavePlanet</span> - System Sizing Guide</div>
      <div class="page-num">Appendix B</div>
    </div>
  `;
}

function quotationRows(items: QuoteLineItem[], addons: QuoteLineItem[]) {
  return [...items, ...addons].map((item) => `
    <tr>
      <td class="c">${item.quantity}</td>
      <td>${escapeHtml(`${item.brand} ${item.model}`)} <span class="desc-sub">${escapeHtml(`${item.role} - ${item.area || "Whole home"}`)}</span></td>
      <td class="r">${currency(item.productPrice + item.installPrice)}</td>
      <td class="r">${currency((item.productPrice + item.installPrice) * item.quantity)}</td>
    </tr>
  `).join("");
}

function customerName(customer?: Customer) {
  return customer?.name || customer?.businessName || "Customer";
}

function customerAddress(customer?: Customer) {
  return customer?.address || [customer?.streetNumber, customer?.streetName, customer?.streetType, customer?.suburb, customer?.stateName, customer?.postcode].filter(Boolean).join(" ") || "Address to be confirmed";
}

function formatDate(value: string) {
  if (!value) return "Date to be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });
}

function validUntil(value: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "30 days from issue";
  date.setDate(date.getDate() + 30);
  return formatDate(date.toISOString());
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type Calculations = ReturnType<typeof calculateQuote>;

function calculateQuote(items: QuoteLineItem[], addons: QuoteLineItem[], certificateRate: number, minimumContributionAdjustment: number, gstRate: number) {
  const allItems = [...items, ...addons];
  const certificates = allItems.reduce((sum, item) => sum + item.certificates * item.quantity, 0);
  const certificateDiscount = certificates * certificateRate;
  const productCost = allItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  const installCost = allItems.reduce((sum, item) => sum + item.installPrice * item.quantity, 0);
  const totalCost = productCost + installCost + minimumContributionAdjustment;
  const netExGst = Math.max(0, totalCost - certificateDiscount);
  const netIncGst = netExGst * (1 + gstRate / 100);
  return { certificates, certificateDiscount, productCost, installCost, totalCost, netExGst, netIncGst };
}
