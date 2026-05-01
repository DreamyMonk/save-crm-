"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Save } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Customer, QuoteLineItem, QuoteRecord, currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function DraftProposalPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");
  const quote = useMemo(() => {
    const fromState = state.quotes.find((item) => item.id === id);
    if (fromState) return fromState;
    if (typeof window === "undefined") return undefined;
    const saved = window.localStorage.getItem(`saveplanet-quote-${id}`);
    return saved ? (JSON.parse(saved) as QuoteRecord) : undefined;
  }, [id, state.quotes]);
  const customer = state.customers.find((item) => item.id === quote?.customerId);

  if (!quote) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Draft proposal" title="Proposal not found" actions={<Link href="/quotes" className="rounded-lg bg-[#003CBB] px-4 py-2 text-sm font-semibold text-white">Back to quotes</Link>} />
      </CrmShell>
    );
  }

  const calculations = calculateQuote(quote.items, quote.additionalServices, quote.certificateRate, quote.minimumContributionAdjustment, quote.gstRate);
  const quoteId = quote.id;

  function saveProposal() {
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quoteId ? { ...item, status: "Saved" } : item)),
    });
    setMessage("Proposal saved.");
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
            <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white">
              <Download size={16} /> Download PDF
            </button>
          </>
        }
      />
      {message ? <p className="mx-8 mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB] print:hidden">{message}</p> : null}
      <main className="proposal-book bg-[#dfe8e2] p-6 print:bg-white print:p-0">
        <Cover quote={quote} customer={customer} />
        <ProductSummary quote={quote} calculations={calculations} />
        <Quotation quote={quote} customer={customer} calculations={calculations} />
        <SystemSizingGuide quote={quote} customer={customer} />
        <ConsumerInfo />
      </main>
    </CrmShell>
  );
}

function Cover({ quote, customer }: { quote: QuoteRecord; customer?: Customer }) {
  return (
    <section className="proposal-page cover-page">
      <div>
        <p className="proposal-eyebrow">SavePlanet Pty Ltd</p>
        <h1>Space Heating & Cooling Upgrade Proposal</h1>
        <p className="proposal-lead">Prepared for {customerName(customer)} under {quote.scheme}.</p>
      </div>
      <div className="cover-meta">
        <Row label="Customer" value={customerName(customer)} />
        <Row label="Address" value={customerAddress(customer)} />
        <Row label="Activity Date" value={quote.activityDate} />
        <Row label="Quote" value={quote.id} />
      </div>
      <Footer page="01 / 05" label="Cover" />
    </section>
  );
}

function ProductSummary({ quote, calculations }: { quote: QuoteRecord; calculations: Calculations }) {
  const allItems = [...quote.items, ...quote.additionalServices];
  return (
    <section className="proposal-page">
      <p className="proposal-eyebrow">Items Summary</p>
      <h2>Product Summary</h2>
      <table className="proposal-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Install</th><th>Total</th></tr>
        </thead>
        <tbody>
          {allItems.map((item) => (
            <tr key={item.id}>
              <td>{item.brand} {item.model}<br /><span>{item.role} - {item.area}</span></td>
              <td>{item.quantity}</td>
              <td>{currency(item.productPrice)}</td>
              <td>{currency(item.installPrice)}</td>
              <td>{currency((item.productPrice + item.installPrice) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="summary-grid">
        <Metric label="Product cost" value={currency(calculations.productCost)} />
        <Metric label="Install cost" value={currency(calculations.installCost)} />
        <Metric label="Government rebate / certificate discount" value={currency(calculations.certificateDiscount)} />
        <Metric label="Net cost incl. GST" value={currency(calculations.netIncGst)} strong />
      </div>
      <Footer page="02 / 05" label="Product Summary" />
    </section>
  );
}

function Quotation({ quote, customer, calculations }: { quote: QuoteRecord; customer?: Customer; calculations: Calculations }) {
  return (
    <section className="proposal-page">
      <p className="proposal-eyebrow">Quotation</p>
      <div className="quote-head">
        <div>
          <h2>Quotation</h2>
          <p>Customer: {customerName(customer)}</p>
          <p>Scheme: {quote.scheme}</p>
        </div>
        <div className="quote-box">
          <Row label="Date" value={quote.activityDate} />
          <Row label="Quote #" value={quote.id} />
          <Row label="Price Tier" value={quote.priceTier} />
          <Row label="Install Tier" value={quote.installationCostTier} />
        </div>
      </div>
      <div className="calculation-card">
        <Row label="VEECs Created" value={`${calculations.certificates.toFixed(2)} @ ${quote.certificateRate.toFixed(2)}`} />
        <Row label="Certificate discount" value={currency(calculations.certificateDiscount)} />
        <Row label="Total product cost" value={currency(calculations.productCost)} />
        <Row label="Total installation cost" value={currency(calculations.installCost)} />
        <Row label="Minimum contribution adjustment" value={currency(quote.minimumContributionAdjustment)} />
        <Row label="Total cost" value={currency(calculations.totalCost)} />
        <Row label="Total net cost (ex. GST)" value={currency(calculations.netExGst)} />
        <Row label="Total net cost (incl. GST)" value={currency(calculations.netIncGst)} />
      </div>
      <p className="terms-note">This quotation includes product price information, installation price information, applicable certificate/rebate discount fields, and GST calculations based on the values entered by the client/consultant.</p>
      <Footer page="03 / 05" label="Quotation" />
    </section>
  );
}

function SystemSizingGuide({ quote, customer }: { quote: QuoteRecord; customer?: Customer }) {
  const heads = quote.items.filter((item) => item.role === "Indoor Head");
  return (
    <section className="proposal-page">
      <p className="proposal-eyebrow">System Sizing Guide</p>
      <h2>System Sizing Guide for Installation of Multi-Head Reverse Cycle Air Conditioning System</h2>
      <div className="info-table">
        <Row label="Customer Name" value={customerName(customer)} />
        <Row label="Customer Address" value={customerAddress(customer)} />
        <Row label="Proposal #" value={quote.id} />
        <Row label="Date" value={quote.activityDate} />
      </div>
      <h3>Existing heater in home</h3>
      <table className="proposal-table compact">
        <thead><tr><th>Room</th><th>Area of room (m2)</th><th>Existing Product</th></tr></thead>
        <tbody>
          {heads.map((item) => <tr key={item.id}><td>{item.area}</td><td>{item.areaM2 ?? 0}</td><td>Gas ducted heater / existing condition to be confirmed</td></tr>)}
        </tbody>
      </table>
      <h3>Proposed multi-head HVAC to be installed</h3>
      <table className="proposal-table compact">
        <thead><tr><th>Room</th><th>Area</th><th>Required Heating Output</th><th>Heating Output of Unit</th><th>Meets Sizing Guide</th><th>Justification</th></tr></thead>
        <tbody>
          {heads.map((item) => (
            <tr key={item.id}>
              <td>{item.area}</td>
              <td>{item.areaM2 ?? 0}m2</td>
              <td>{item.recommendedHeatingOutput}</td>
              <td>{item.model}</td>
              <td>Yes</td>
              <td>Customer requested / installer confirmed</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="signature-grid">
        <div><strong>Customer</strong><span>Signature</span><span>Name: {customerName(customer)}</span><span>Date</span></div>
        <div><strong>Installer</strong><span>Signature</span><span>Name</span><span>Date</span></div>
      </div>
      <Footer page="04 / 05" label="Sizing Guide" />
    </section>
  );
}

function ConsumerInfo() {
  return (
    <section className="proposal-page">
      <p className="proposal-eyebrow">Consumer Information</p>
      <h2>VEU Space Heating and Cooling Consumer Factsheet Summary</h2>
      <div className="facts-grid">
        <Metric label="Small room up to 20m2" value="2.5 to 3 kW" />
        <Metric label="Medium room 21-40m2" value="3 to 5 kW" />
        <Metric label="Large room 41-60m2" value="5 to 8 kW" />
        <Metric label="Very large room over 60m2" value="+8 kW" />
      </div>
      <ul className="proposal-list">
        <li>Before choosing a system, consider draughts, ceiling height, insulation, glazing, shade, construction type and room use.</li>
        <li>Single-split systems connect one outdoor unit to one indoor unit. Multi-split systems connect one outdoor unit to multiple indoor units. Ducted systems condition rooms through ducts and vents.</li>
        <li>Only products meeting VEU program requirements can be installed where a VEU incentive is claimed.</li>
        <li>Sizing and installation should be confirmed by a fully qualified technician. This guide supports selection but does not replace site assessment.</li>
      </ul>
      <Footer page="05 / 05" label="VEU Factsheet Summary" />
      <style jsx global>{`
        @media print {
          aside, header, .print\\:hidden { display: none !important; }
          .proposal-book { padding: 0 !important; background: white !important; }
          .proposal-page { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; page-break-after: always; }
        }
        .proposal-book{max-width:1024px;margin:0 auto;}
        .proposal-page{position:relative;min-height:1330px;background:#fff;margin-bottom:18px;padding:54px 58px;box-shadow:0 4px 30px rgba(15,30,20,.12);border-radius:4px;overflow:hidden;}
        .cover-page{background:linear-gradient(135deg,#0a1f12,#155029);color:#fff;display:flex;flex-direction:column;justify-content:space-between;}
        .cover-page h1{font-size:56px;line-height:1.05;max-width:740px;}
        .proposal-eyebrow{display:inline-flex;color:#1f7a3e;background:#e9f5ee;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;}
        .cover-page .proposal-eyebrow{color:#34d066;background:rgba(255,255,255,.08);}
        .proposal-lead{font-size:18px;opacity:.85;margin-top:18px;}
        .cover-meta,.quote-box,.calculation-card,.info-table{border:1px solid #d6e8dc;border-radius:12px;padding:18px;background:#f8fafc;}
        .cover-meta{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);}
        h2{font-size:34px;margin-bottom:20px;color:#0f1f17;}
        h3{margin:24px 0 10px;color:#155029;}
        .proposal-table{width:100%;border-collapse:collapse;margin:16px 0 26px;font-size:13px;}
        .proposal-table th{background:#20c9d2;color:#083337;text-align:left;padding:12px;border:1px solid #d6e8dc;}
        .proposal-table td{padding:12px;border:1px solid #d6e8dc;vertical-align:top;}
        .proposal-table span{color:#64748b;font-size:12px;}
        .compact th,.compact td{padding:9px;font-size:12px;}
        .summary-grid,.facts-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px;}
        .metric{border:1px solid #d6e8dc;border-radius:12px;padding:14px;background:#f8fafc;}
        .metric strong{display:block;margin-top:8px;font-size:18px;color:#155029;}
        .metric.strong{background:#e9f5ee;}
        .quote-head{display:grid;grid-template-columns:1fr 320px;gap:20px;margin-bottom:20px;}
        .row{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #e2e8f0;padding:9px 0;}
        .row:last-child{border-bottom:0;}
        .row span{color:#64748b;font-weight:700;}
        .row strong{text-align:right;}
        .terms-note{border-left:4px solid #1f7a3e;background:#e9f5ee;padding:14px;margin-top:22px;}
        .signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;}
        .signature-grid div{border:1px solid #d6e8dc;padding:14px;min-height:120px;}
        .signature-grid span{display:block;margin-top:14px;color:#64748b;}
        .proposal-list{line-height:1.8;margin-left:20px;font-size:15px;}
        .page-foot{position:absolute;bottom:18px;left:24px;right:24px;display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;font-weight:700;}
      `}</style>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="row"><span>{label}</span><strong>{value || "N/A"}</strong></div>;
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`metric ${strong ? "strong" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Footer({ page, label }: { page: string; label: string }) {
  return <div className="page-foot"><span>SavePlanet - {label}</span><span>{page}</span></div>;
}

function customerName(customer?: Customer) {
  return customer?.name || customer?.businessName || "Customer";
}

function customerAddress(customer?: Customer) {
  return customer?.address || [customer?.streetNumber, customer?.streetName, customer?.streetType, customer?.suburb, customer?.stateName, customer?.postcode].filter(Boolean).join(" ") || "Address to be confirmed";
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
