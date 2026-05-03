"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { ArrowLeft, Copy, Download, PenLine, Save, Send } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CrmState, Customer, Product, ProductCategory, QuoteLineItem, QuoteRecord, TeamMember, currency } from "@/lib/crm-data";
import { getFirebaseAuth } from "@/lib/firebase";
import { useCrmStore } from "@/lib/use-crm-store";

const templateUrls = {
  Aircon: "/saveplanet-aircon-proposal-template.html",
  "Heat Pump": "/saveplanet-hot-water-proposal-template.html",
  Solar: "/saveplanet-solar-proposal-template.html",
  Inverter: "/saveplanet-solar-proposal-template.html",
  "Solar Battery": "/saveplanet-solar-proposal-template.html",
} as const;
const signatureFonts = [
  { label: "Elegant Script", value: "Brush Script MT, Segoe Script, cursive" },
  { label: "Classic Hand", value: "Segoe Script, Lucida Handwriting, cursive" },
  { label: "Soft Signature", value: "Lucida Handwriting, Brush Script MT, cursive" },
  { label: "Simple Cursive", value: "Comic Sans MS, Segoe Print, cursive" },
];

export default function DraftProposalPage() {
  return <ProposalWorkspace allowAnonymous />;
}

export function PublicProposalPage() {
  return <ProposalWorkspace publicView />;
}

function ProposalWorkspace({ publicView = false, allowAnonymous = false }: { publicView?: boolean; allowAnonymous?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const openTrackedRef = useRef(false);
  const { state, setState } = useCrmStore();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!allowAnonymous);
  const [message, setMessage] = useState("");
  const [proposalHtml, setProposalHtml] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [autoSignName, setAutoSignName] = useState("");
  const [autoSignFont, setAutoSignFont] = useState(signatureFonts[0].value);
  const [changeRequestDrafts, setChangeRequestDrafts] = useState<Record<string, string>>({});
  const effectivePublicView = publicView || (allowAnonymous && authChecked && !user);
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
  const quoteCategory = quote ? resolveQuoteCategory(quote, state.products) : "Aircon";
  const calculations = useMemo(() => {
    if (!quote) return undefined;
    return calculateQuote(quote);
  }, [quote]);
  const changeRequestHtml = quote ? (changeRequestDrafts[quote.id] ?? quote.proposalChangeRequestHtml ?? "") : "";

  useEffect(() => {
    if (!quote || !calculations) return;
    let cancelled = false;
    fetch(templateUrlForCategory(quoteCategory))
      .then((response) => response.text())
      .then((template) => {
        if (!cancelled) setProposalHtml(buildProposalHtml(template, quote, customer, calculations, quoteCategory));
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load the static proposal template.");
      });
    return () => {
      cancelled = true;
    };
  }, [quote, customer, calculations, quoteCategory]);

  useEffect(() => {
    if (!allowAnonymous) return;
    return onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
  }, [allowAnonymous]);

  useEffect(() => {
    if (!effectivePublicView || !quote || openTrackedRef.current) return;
    openTrackedRef.current = true;
    const openedAt = new Date().toISOString();
    const updatedQuote = {
      ...quote,
      proposalOpenedAt: openedAt,
      proposalOpenCount: (quote.proposalOpenCount ?? 0) + 1,
    };
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quote.id ? updatedQuote : item)),
    });
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(updatedQuote));
  }, [effectivePublicView, quote, setState, state]);

  if (allowAnonymous && !authChecked) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-[#0f172a]">
        <p className="font-semibold">Loading proposal...</p>
      </main>
    );
  }

  if (!quote || !calculations) {
    const notFound = (
      <>
        <PageHeader eyebrow="Draft proposal" title="Proposal not found" actions={<Link href={effectivePublicView ? "/" : "/quotes"} className="rounded-lg bg-[#003CBB] px-4 py-2 text-sm font-semibold text-white">{effectivePublicView ? "Back home" : "Back to quotes"}</Link>} />
        <main className="grid min-h-[70vh] place-items-center bg-white p-6">
          <div className="max-w-md rounded-xl border border-[#d9e2f2] bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-[#0f172a]">This proposal is not available</h2>
            <p className="mt-2 text-sm leading-6 text-[#657267]">Please check the proposal link or ask the SavePlanet team to resend it.</p>
          </div>
        </main>
      </>
    );
    return effectivePublicView ? notFound : (
      <CrmShell>
        {notFound}
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

  async function sendProposalLink() {
    if (!quote) return;
    const sentAt = new Date().toISOString();
    const sender = findSenderMember(state, quote, customer, user);
    const link = `${window.location.origin}/proposal/${quote.id}`;
    const updatedQuote = {
      ...quote,
      proposalSentAt: quote.proposalSentAt ?? sentAt,
      proposalSentBy: quote.proposalSentBy ?? sender?.name ?? customer?.salesAgent ?? user?.email ?? "SavePlanet Team",
      status: "Saved" as const,
    };
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quote.id ? updatedQuote : item)),
    });
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(updatedQuote));
    await navigator.clipboard?.writeText(link);

    if (!customer?.email) {
      setMessage("Public proposal link copied. Customer email is missing, so no email was sent.");
      return;
    }

    const emailSent = await sendResendEmail(state, {
      recipients: [{ email: customer.email, name: customerName(customer) }],
      subject: `SavePlanet proposal ${quote.id}`,
      text: `Hi ${customerName(customer)},\n\nYour SavePlanet proposal is ready.\n\nOpen it here:\n${link}\n\nYou can view, download, and sign the proposal from this link.\n\nThanks,\nSavePlanet`,
    });
    setMessage(emailSent ? "Public proposal link copied and emailed to the customer." : "Public proposal link copied. Customer email failed, please check Resend settings.");
  }

  async function saveSignature() {
    if (!quote) return;
    if (!signatureDataUrl) {
      setMessage("Please draw a signature first.");
      return;
    }
    const signedAt = new Date().toISOString();
    const firstSignature = !quote.customerSignedAt;
    const updatedQuote = { ...quote, customerSignatureDataUrl: signatureDataUrl, customerSignedAt: signedAt };
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quote.id ? updatedQuote : item)),
    });
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(updatedQuote));

    if (!firstSignature) {
      setMessage("Signature saved into the proposal.");
      return;
    }

    const recipients = signingNotificationRecipients(state, updatedQuote, customer, user);
    if (!recipients.length) {
      setMessage("Signature saved. Add real admin and agent emails in Access Manager to receive notifications.");
      return;
    }

    const emailSent = await sendResendEmail(state, {
      recipients,
      subject: `Proposal signed: ${quote.id}`,
      text: `${customerName(customer)} signed proposal ${quote.id} on ${formatDate(signedAt)}.\n\nCustomer: ${customerName(customer)}\nProposal: ${quote.id}\nStatus: Signed\n\nOpen proposal records in SavePlanet CRM:\n${window.location.origin}/proposals`,
    });
    setMessage(emailSent ? "Signature saved. Admin and sending agent were notified." : "Signature saved. Notification email failed, please check Resend settings.");
  }

  function saveChangeRequest() {
    if (!quote) return;
    if (!hasEditorText(changeRequestHtml)) {
      setMessage("Please write the requested changes first.");
      return;
    }
    const requestedAt = new Date().toISOString();
    const updatedQuote = {
      ...quote,
      proposalChangeRequestHtml: changeRequestHtml,
      proposalChangeRequestedAt: requestedAt,
    };
    setState({
      ...state,
      quotes: state.quotes.map((item) => (item.id === quote.id ? updatedQuote : item)),
    });
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(updatedQuote));
    setMessage(effectivePublicView ? "Your requested changes were sent to SavePlanet." : "Requested changes saved.");
  }

  const content = (
    <>
      <PageHeader
        eyebrow={quote.id}
        title={effectivePublicView ? "SavePlanet proposal" : "Draft proposal"}
        actions={
          effectivePublicView ? (
            <button onClick={downloadPdf} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white">
              <Download size={16} /> Download PDF
            </button>
          ) : (
            <>
            <Link href="/quotes" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold text-[#003CBB]">
              <ArrowLeft size={16} /> Back
            </Link>
            <button onClick={saveProposal} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} /> Save proposal
            </button>
            <button onClick={sendProposalLink} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#eef4ff] px-4 text-sm font-semibold text-[#003CBB]">
              <Send size={16} /> Send proposal
            </button>
            <button onClick={downloadPdf} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-semibold text-white">
              <Download size={16} /> Download PDF
            </button>
            </>
          )
        }
      />
      {message ? <p className="mx-8 mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
      <main className="bg-[#dfe6df] p-6">
        <iframe
          ref={iframeRef}
          title="SavePlanet drafted proposal"
          srcDoc={proposalHtml}
          className="mx-auto h-[calc(100vh-190px)] min-h-[760px] w-full max-w-[900px] rounded border border-[#c7d3e8] bg-white shadow-lg"
        />
        <section className="mx-auto mt-5 grid max-w-[900px] gap-4 rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2">
              <PenLine size={18} />
              <h2 className="font-semibold">Customer signature</h2>
            </div>
            <p className="mt-1 text-sm text-[#657267]">{effectivePublicView ? "Sign here to confirm that you have reviewed this proposal. Your signature will appear in the proposal customer signature area." : "Customer can sign here from the shared proposal link. Saved signature appears automatically in the proposal customer signature area."}</p>
            <SignaturePad value={quote.customerSignatureDataUrl} onChange={setSignatureDataUrl} autoName={autoSignName} autoFont={autoSignFont} />
            <div className="mt-4 rounded-lg border border-[#e5edf7] bg-[#f8fbff] p-4">
              <div className="flex items-center gap-2">
                <PenLine size={16} />
                <h3 className="text-sm font-semibold">Auto sign</h3>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#657267]">Type full name</span>
                  <input value={autoSignName} onChange={(event) => setAutoSignName(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none focus:border-[#003CBB]" placeholder="Customer name" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#657267]">Signature font</span>
                  <select value={autoSignFont} onChange={(event) => setAutoSignFont(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none focus:border-[#003CBB]">
                    {signatureFonts.map((font) => (
                      <option key={font.label} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 rounded-lg border border-dashed border-[#c7d3e8] bg-white px-4 py-3 text-4xl text-[#0f172a]" style={{ fontFamily: autoSignFont }}>
                {autoSignName || "Signature preview"}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <button onClick={saveSignature} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} /> Save signature
            </button>
            {!effectivePublicView ? <button onClick={sendProposalLink} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold text-[#003CBB]">
              <Copy size={16} /> Send and copy link
            </button> : null}
          </div>
        </section>
        <section className="mx-auto mt-5 max-w-[900px] rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PenLine size={18} />
            <h2 className="font-semibold">Changes</h2>
          </div>
          <p className="mt-1 text-sm text-[#657267]">
            {effectivePublicView ? "Write any requested changes before signing or after reviewing the proposal." : "Client requested changes from the public proposal viewer."}
          </p>
          {effectivePublicView ? (
            <>
              <div className="mt-4">
                <RichTextEditor
                  value={changeRequestHtml}
                  onChange={(value) => {
                    if (!quote) return;
                    setChangeRequestDrafts((current) => ({ ...current, [quote.id]: value }));
                  }}
                  placeholder="Write requested changes here..."
                  minHeight={180}
                />
              </div>
              <button onClick={saveChangeRequest} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
                <Send size={16} /> Send changes
              </button>
            </>
          ) : quote.proposalChangeRequestHtml ? (
            <div className="prose prose-sm mt-4 max-w-none rounded-lg border border-[#e5edf7] bg-[#f8fbff] p-4 text-[#0f172a]" dangerouslySetInnerHTML={{ __html: quote.proposalChangeRequestHtml }} />
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-[#c7d3e8] bg-[#f8fbff] p-4 text-sm text-[#657267]">No change request submitted yet.</p>
          )}
        </section>
      </main>
    </>
  );

  return effectivePublicView ? content : (
    <CrmShell>
      {content}
    </CrmShell>
  );
}

async function sendResendEmail(
  state: CrmState,
  payload: { recipients: { email: string; name?: string }[]; subject: string; text: string },
) {
  try {
    const response = await fetch("/api/resend/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resend: state.settings.resend,
        recipients: payload.recipients,
        subject: payload.subject,
        text: payload.text,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function findSenderMember(state: CrmState, quote: QuoteRecord, customer: Customer | undefined, user: User | null) {
  const currentEmail = user?.email?.toLowerCase();
  return (
    state.team.find((member) => member.active && currentEmail && member.email?.toLowerCase() === currentEmail) ??
    state.team.find((member) => member.active && member.name === quote.proposalSentBy) ??
    state.team.find((member) => member.active && member.name === customer?.salesAgent)
  );
}

function signingNotificationRecipients(state: CrmState, quote: QuoteRecord, customer: Customer | undefined, user: User | null) {
  const recipients = new Map<string, { email: string; name?: string }>();
  const addMember = (member?: TeamMember) => {
    if (!member?.email || !isDeliverableEmail(member.email)) return;
    recipients.set(member.email.toLowerCase(), { email: member.email, name: member.name });
  };

  state.team.filter((member) => member.active && member.role.toLowerCase() === "admin").forEach(addMember);
  addMember(findSenderMember(state, quote, customer, user));

  return Array.from(recipients.values());
}

function isDeliverableEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !normalized.endsWith(".local");
}

function templateUrlForCategory(category: string) {
  return templateUrls[category as keyof typeof templateUrls] ?? templateUrls.Aircon;
}

function resolveQuoteCategory(quote: QuoteRecord, products: Product[]): ProductCategory {
  const explicitCategory = quote.productCategory;
  const schemeCategory = inferCategoryFromScheme(quote.scheme);
  const itemCategory = inferQuoteCategory(quote, products);

  if (explicitCategory && explicitCategory !== "Aircon") return explicitCategory;
  if (schemeCategory) return schemeCategory;
  if (itemCategory) return itemCategory;
  return explicitCategory ?? "Aircon";
}

function inferCategoryFromScheme(scheme: string): ProductCategory | undefined {
  const normalized = scheme.toLowerCase();
  if (normalized.includes("solar")) return "Solar";
  if (normalized.includes("hot water") || normalized.includes("veu hp") || normalized.includes("stc hp")) return "Heat Pump";
  if (normalized.includes("space heating") || normalized.includes("cooling")) return "Aircon";
  return undefined;
}

function inferQuoteCategory(quote: QuoteRecord, products: Product[]): ProductCategory | undefined {
  const productId = quote.items.find((item) => item.productId)?.productId;
  const productCategory = products.find((product) => product.id === productId)?.category;
  if (productCategory) return productCategory;

  const itemText = quote.items.map((item) => `${item.role} ${item.brand} ${item.model} ${item.notes}`).join(" ").toLowerCase();
  if (itemText.includes("solar") || itemText.includes("inverter") || itemText.includes("battery")) return "Solar";
  if (itemText.includes("heat pump") || itemText.includes("hot water")) return "Heat Pump";
  if (itemText.includes("indoor head") || itemText.includes("outdoor unit") || itemText.includes("air con")) return "Aircon";
  return undefined;
}

function hasEditorText(html: string) {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replaceAll("&nbsp;", " ").trim().length > 0;
}

function buildProposalHtml(template: string, quote: QuoteRecord, customer: Customer | undefined, calculations: Calculations, category: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, "text/html");
  const quotePage = doc.querySelector(".quot-pad")?.closest(".page");
  normalizeTemplateImages(doc);

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
  if (totalValues[1]) totalValues[1].textContent = currency(calculations.gstAmount);
  if (totalValues[2]) totalValues[2].textContent = currency(calculations.systemTotalIncGst);
  if (totalValues[3]) totalValues[3].textContent = `-${currency(calculations.totalDeductions)}`;
  if (totalValues[4]) totalValues[4].textContent = currency(calculations.finalPriceIncGst);
  if (totalValues[5]) totalValues[5].textContent = currency(calculations.depositAmount);
  if (totalValues[6]) totalValues[6].textContent = currency(calculations.balanceDue);

  const bankReference = doc.querySelectorAll(".bank-row .v")[3];
  if (bankReference) bankReference.textContent = quote.id;

  applyModernProposalTemplateData(doc, quote, customer, calculations);

  if (quote.customerSignatureDataUrl) {
    doc.querySelectorAll(".sig-fld.full").forEach((field) => {
      const line = field.querySelector(".sig-line");
      if (line) {
        line.insertAdjacentHTML("beforebegin", `<img class="saved-customer-signature" src="${quote.customerSignatureDataUrl}" alt="Customer signature">`);
      }
    });
  }

  if (quotePage) {
    const fragment = doc.createElement("template");
    fragment.innerHTML = category === "Aircon" ? `${productSummaryPage(quote, calculations, category)}${sizingGuidePage(quote, customer)}` : productSummaryPage(quote, calculations, category);
    quotePage.before(fragment.content);
  }

  const script = doc.createElement("script");
  script.textContent = "if(window.lucide){window.lucide.createIcons();}";
  doc.body.appendChild(script);
  const style = doc.createElement("style");
  style.textContent = "html,body{max-width:100%;overflow-x:hidden;}@media screen{body{background:#dfe6df!important;padding:20px 0!important;}.page{margin:0 auto 24px!important;box-shadow:0 14px 30px rgba(15,23,42,.14);}.page:last-child{margin-bottom:0!important;}}.cov-card-item span{display:block;max-width:100%;overflow-wrap:anywhere;line-height:1.35;}.cov-card{align-items:start;}.saved-customer-signature{display:block;max-width:320px;max-height:90px;margin:10px 0 6px;object-fit:contain;}.modern-signature-value{font-weight:800;color:#0f172a;margin:8px 0 4px;min-height:18px;}.quote-total-hero{width:100%;margin:0 0 18px;border:1px solid #b9d7ca;background:#f4fbf7;border-radius:14px;padding:6px 12px;}.quote-total-panel{margin-left:auto;margin-top:20px;width:440px;border:1px solid #d8e6dc;border-radius:16px;background:#fbfdfb;padding:10px 14px;box-shadow:0 8px 20px rgba(15,23,42,.06);}.quote-total-panel .tot-line,.quote-total-hero .tot-line{border-bottom:1px solid #e1ece5;padding:10px 0;}.quote-total-panel .tot-line:last-child,.quote-total-hero .tot-line:last-child{border-bottom:0;}.quote-total-panel .tot-line .l,.quote-total-hero .tot-line .l{font-weight:700;color:#39483d;}.quote-total-panel .tot-line .v,.quote-total-hero .tot-line .v{font-weight:800;color:#0f172a;}.quote-total-panel .deduction .v{color:#0f7a45;}.quote-total-panel .final-price{margin:8px -6px 0;padding:12px 6px;border-radius:10px;background:#eef7ff;}.quote-total-panel .final-price .l,.quote-total-panel .final-price .v{color:#003CBB;font-size:16px;}.quote-savings-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px;}.quote-savings-card{border:1px solid #d9e2f2;border-radius:12px;background:#fff;padding:12px;}.quote-savings-card label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#657267;font-weight:800;}.quote-savings-card .name{margin-top:8px;font-size:15px;font-weight:800;color:#0f172a;}";
  doc.head.appendChild(style);
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

function applyModernProposalTemplateData(doc: Document, quote: QuoteRecord, customer: Customer | undefined, calculations: Calculations) {
  const coverValues = doc.querySelectorAll<HTMLElement>(".meta-strip .item .val");
  if (coverValues[0]) coverValues[0].textContent = customerName(customer);
  if (coverValues[1]) coverValues[1].textContent = quote.id;
  if (coverValues[2]) coverValues[2].textContent = validUntil(quote.activityDate);

  const quoteMeta = doc.querySelectorAll<HTMLElement>(".quote-header .right .meta strong");
  if (quoteMeta[0]) quoteMeta[0].textContent = formatDate(quote.activityDate);
  if (quoteMeta[1]) quoteMeta[1].textContent = quote.id;

  const billingBoxes = doc.querySelectorAll<HTMLElement>(".billing-box");
  setModernBillingLines(billingBoxes[0], [
    ["Customer Name", customerName(customer)],
    ["Phone", customer?.phone || customer?.mobile || "To be confirmed"],
    ["Email", customer?.email || "To be confirmed"],
    ["Address", customerAddress(customer)],
  ]);
  setModernBillingLines(billingBoxes[1], [
    ["Installation Address", customerAddress(customer)],
    ["Property type", customer?.customerType || "To be confirmed"],
    ["Existing system", quote.description || "To be confirmed"],
  ]);

  const metaValues = doc.querySelectorAll<HTMLElement>(".meta-row .col .v");
  if (metaValues[0]) metaValues[0].textContent = quote.id;
  if (metaValues[1]) metaValues[1].textContent = customer?.salesAgent || "SavePlanet";
  if (metaValues[2]) metaValues[2].textContent = customer?.paymentTermsValue ? `${customer.paymentTermsValue} ${customer.paymentTermsUnit}` : `${quote.depositPercent ?? 50}% Deposit`;
  if (metaValues[3]) metaValues[3].textContent = "Day of Install";

  const modernQuoteTableBody = doc.querySelector<HTMLTableSectionElement>(".items-table tbody");
  if (modernQuoteTableBody) modernQuoteTableBody.innerHTML = modernQuotationRows(quote.items, quote.additionalServices);

  const bankValues = doc.querySelectorAll<HTMLElement>(".totals-bank .ln .v");
  if (bankValues[3]) bankValues[3].textContent = `Quote # ${quote.id}`;

  const totals = doc.querySelector<HTMLElement>(".totals-calc");
  if (totals) totals.innerHTML = modernTotalsMarkup(quote, calculations);

  applyModernSignature(doc, quote, customer);
}

function setModernBillingLines(box: Element | undefined, rows: Array<[string, string]>) {
  if (!box) return;
  const lines = box.querySelectorAll<HTMLElement>(".ln");
  rows.forEach(([label, value], index) => {
    const line = lines[index];
    if (line) line.innerHTML = `<span class="lbl-inline">${escapeHtml(label)}:</span> ${escapeHtml(value)}`;
  });
}

function modernQuotationRows(items: QuoteLineItem[], addons: QuoteLineItem[]) {
  const rows = [...items, ...addons];
  if (!rows.length) {
    return `<tr><td colspan="4">Products to be confirmed.</td></tr>`;
  }
  return rows.map((item) => {
    const unitPrice = item.productPrice + item.installPrice;
    const total = unitPrice * item.quantity;
    const description = [
      item.role,
      item.area ? `Area: ${item.area}` : "",
      item.areaM2 ? `${item.areaM2} m2` : "",
      item.certificates ? `${item.certificates} certificate(s)` : "",
    ].filter(Boolean).join(" - ");
    return `
      <tr>
        <td>${item.quantity}</td>
        <td>${escapeHtml(`${item.brand} ${item.model}`)}<span class="desc">${escapeHtml(description || "Selected product")}</span></td>
        <td class="right">${currency(unitPrice)}</td>
        <td class="right">${currency(total)}</td>
      </tr>
    `;
  }).join("");
}

function modernTotalsMarkup(quote: QuoteRecord, calculations: Calculations) {
  const rows = [
    ["Subtotal", currency(calculations.productCost + calculations.installCost), ""],
    [`GST (${quote.gstRate}%)`, currency(calculations.gstAmount), ""],
    ["System Total", currency(calculations.systemTotalIncGst), ""],
    ["Certificate Discount", `-${currency(calculations.certificateDiscount)}`, "discount"],
    ["Rebate", `-${currency(calculations.rebate)}`, "discount"],
    ["Interest Free Loan", `-${currency(quote.solarVicLoan ?? 0)}`, "discount"],
    ["Final Price", currency(calculations.finalPriceIncGst), "due"],
    [`Deposit (${quote.depositPercent ?? 50}%)`, currency(calculations.depositAmount), ""],
    ["Balance Due", currency(calculations.balanceDue), "due"],
  ];
  return rows.map(([label, value, className]) => `<div class="ln ${className}"><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span></div>`).join("");
}

function applyModernSignature(doc: Document, quote: QuoteRecord, customer: Customer | undefined) {
  doc.querySelectorAll<HTMLElement>(".signature-box .sig-block").forEach((block) => {
    const label = block.querySelector(".lbl")?.textContent?.toLowerCase() ?? "";
    const line = block.querySelector(".line");
    if (!line) return;
    if (label.includes("full name")) {
      line.insertAdjacentHTML("beforebegin", `<div class="modern-signature-value">${escapeHtml(customerName(customer))}</div>`);
    }
    if (label === "date") {
      line.insertAdjacentHTML("beforebegin", `<div class="modern-signature-value">${escapeHtml(quote.customerSignedAt ? formatDate(quote.customerSignedAt) : formatDate(quote.activityDate))}</div>`);
    }
    if (label.includes("signature") && quote.customerSignatureDataUrl) {
      line.insertAdjacentHTML("beforebegin", `<img class="saved-customer-signature" src="${quote.customerSignatureDataUrl}" alt="Customer signature">`);
    }
  });
}

function normalizeTemplateImages(doc: Document) {
  doc.querySelectorAll<HTMLImageElement>('img[src^="assets/"]').forEach((image) => {
    const src = image.getAttribute("src") ?? "";
    if (src.includes("logo")) {
      image.src = inlineSvgDataUrl(savePlanetLogoSvg());
      image.alt = "SavePlanet";
      return;
    }
    image.src = inlineSvgDataUrl(productPlaceholderSvg(image.alt || assetName(src)));
  });
}

function assetName(src: string) {
  return src.split("/").pop()?.replace(/\.[^.]+$/, "").replaceAll("_", " ") || "Product";
}

function inlineSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function savePlanetLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70" viewBox="0 0 240 70"><rect width="240" height="70" rx="14" fill="#fff"/><path d="M35 12c18 0 31 13 31 29S53 58 35 58c9-10 9-36 0-46Z" fill="#08c7cc"/><path d="M66 12c15 5 25 16 25 29S81 65 66 58c9-10 9-36 0-46Z" fill="#ff6b2c"/><text x="104" y="43" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#0b3b2c">SavePlanet</text></svg>`;
}

function productPlaceholderSvg(label: string) {
  const safeLabel = escapeHtml(label);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220" viewBox="0 0 420 220"><rect width="420" height="220" rx="20" fill="#eef7f1"/><rect x="34" y="34" width="352" height="152" rx="16" fill="#fff" stroke="#b9d7ca" stroke-width="3"/><path d="M105 143 154 86l42 46 31-34 88 88H82l23-43Z" fill="#23d36f" opacity=".25"/><circle cx="296" cy="78" r="22" fill="#23d36f" opacity=".45"/><text x="210" y="190" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="#0b3b2c">${safeLabel}</text></svg>`;
}

function SignaturePad({ value, onChange, autoName, autoFont }: { value?: string; onChange: (value: string) => void; autoName: string; autoFont: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5;
    context.strokeStyle = "#0f172a";
    if (!value) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = value;
  }, [value]);

  function autoSign() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const name = autoName.trim();
    if (!canvas || !context || !name) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0f172a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `76px ${autoFont}`;
    context.fillText(name, canvas.width / 2, canvas.height / 2 + 6, canvas.width - 90);
    onChange(canvas.toDataURL("image/png"));
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextPoint = point(event);
    context.beginPath();
    context.moveTo(nextPoint.x, nextPoint.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const nextPoint = point(event);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
  }

  function stop(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="mt-4">
      <canvas
        ref={canvasRef}
        width={760}
        height={190}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerCancel={stop}
        className="h-44 w-full touch-none rounded-lg border-2 border-dashed border-[#003CBB] bg-white"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={autoSign} disabled={!autoName.trim()} className="rounded-lg bg-[#003CBB] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#9bb3ee]">
          Use auto sign
        </button>
        <button type="button" onClick={clear} className="rounded-lg border border-[#c7d3e8] bg-white px-3 py-2 text-sm font-semibold text-[#003CBB]">
          Clear signature
        </button>
      </div>
    </div>
  );
}

function productSummaryPage(quote: QuoteRecord, calculations: Calculations, category: string) {
  const keyProducts = quote.items.map((item) => `
    <tr>
      <td>${escapeHtml(`${item.brand} ${item.model}`)}<span class="desc-sub">${escapeHtml(`${item.role} - ${item.area || "Whole home"}`)}</span></td>
      <td class="c">${item.quantity}</td>
      <td class="r">${currency(item.productPrice)}</td>
      <td class="r">${currency(item.installPrice)}</td>
      <td class="r">${currency((item.productPrice + item.installPrice) * item.quantity)}</td>
    </tr>
  `).join("");
  const additionalCharges = quote.additionalServices.map((item) => `
    <tr>
      <td>${escapeHtml(`${item.brand} ${item.model}`)}<span class="desc-sub">${escapeHtml(item.area || "Additional service")}</span></td>
      <td class="c">${item.quantity}</td>
      <td class="r">${currency(item.productPrice)}</td>
      <td class="r">${currency(item.installPrice)}</td>
      <td class="r">${currency((item.productPrice + item.installPrice) * item.quantity)}</td>
    </tr>
  `).join("");
  const balanceRows = balanceOfSystemRows(category);

  return `
    <div class="page">
      <div class="quot-pad">
        <div class="sec-eyebrow"><i data-lucide="package-check"></i> Proposal Data</div>
        <h1 class="sec-h1">Quotation <em>Summary</em></h1>
        <div class="sec-rule"></div>
        <p class="sec-lead">${escapeHtml(productSummaryLead(category))}</p>
        <div class="totals-block quote-total-hero">
          <div class="tot-line due"><span class="l">System Total <small>(incl. GST)</small></span><span class="v">${currency(calculations.systemTotalIncGst)}</span></div>
        </div>
        <h3 style="font-family:'Sora';font-size:15px;margin:18px 0 8px;">Key Products</h3>
        <table class="qt">
          <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Install</th><th class="r">Total</th></tr></thead>
          <tbody>${keyProducts || `<tr><td colspan="5">Products to be confirmed.</td></tr>`}</tbody>
        </table>
        <h3 style="font-family:'Sora';font-size:15px;margin:20px 0 8px;">Balance of System</h3>
        <table class="qt">
          <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead>
          <tbody>${balanceRows}</tbody>
        </table>
        <h3 style="font-family:'Sora';font-size:15px;margin:20px 0 8px;">Additional Charges</h3>
        <table class="qt">
          <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Install</th><th class="r">Total</th></tr></thead>
          <tbody>${additionalCharges || `<tr><td colspan="5">No additional charges added.</td></tr>`}</tbody>
        </table>
        <div class="totals-block quote-total-panel">
          <div class="tot-line"><span class="l">Product and install subtotal</span><span class="v">${currency(calculations.productCost + calculations.installCost)}</span></div>
          <div class="tot-line"><span class="l">Minimum contribution adjustment</span><span class="v">${currency(quote.minimumContributionAdjustment)}</span></div>
          <div class="tot-line"><span class="l">GST (${quote.gstRate}%)</span><span class="v">${currency(calculations.gstAmount)}</span></div>
          <div class="tot-line due"><span class="l">System Total <small>(incl. GST)</small></span><span class="v">${currency(calculations.systemTotalIncGst)}</span></div>
          <div class="tot-line veec deduction"><span class="l">Deductions</span><span class="v">-${currency(calculations.totalDeductions)}</span></div>
          <div class="tot-line deduction"><span class="l">Certificate discount</span><span class="v">-${currency(calculations.certificateDiscount)}</span></div>
          <div class="tot-line deduction"><span class="l">Rebate</span><span class="v">-${currency(calculations.rebate)}</span></div>
          <div class="tot-line deduction"><span class="l">Solar VIC PV Interest Free Loan</span><span class="v">-${currency(quote.solarVicLoan ?? 0)}</span></div>
          <div class="tot-line due final-price"><span class="l">Final price incl. GST</span><span class="v">${currency(calculations.finalPriceIncGst)}</span></div>
          <div class="tot-line"><span class="l">Deposit (${quote.depositPercent ?? 50}%)</span><span class="v">${currency(calculations.depositAmount)}</span></div>
          <div class="tot-line"><span class="l">Balance due</span><span class="v">${currency(calculations.balanceDue)}</span></div>
        </div>
        <h3 style="font-family:'Sora';font-size:15px;margin:24px 0 8px;">Estimated System Performance &amp; Savings</h3>
        <div class="quote-savings-grid">
          <div class="quote-savings-card"><label>Annual Energy Production</label><div class="name">${(quote.annualEnergyProductionKwh ?? 0).toLocaleString()} kWh</div></div>
          <div class="quote-savings-card"><label>Discounted Payback</label><div class="name">${quote.discountedPaybackYears ?? 0} year(s)</div></div>
          <div class="quote-savings-card"><label>Annual Bill Savings</label><div class="name">${currency(quote.annualBillSavings ?? 0)}</div></div>
        </div>
      </div>
      <div class="page-foot-brand"><span>SavePlanet</span> - Items Summary</div>
      <div class="page-num">Appendix A</div>
    </div>
  `;
}

function productSummaryLead(category: string) {
  if (category === "Aircon") return "Product summary created from the selected outdoor unit, indoor heads, installation items, and additional services.";
  if (category === "Heat Pump") return "Product summary created from the selected hot water heat pump system, installation items, rebate, and additional services.";
  return "Product summary created from the selected solar, inverter, battery, installation, rebate, and additional services.";
}

function balanceOfSystemRows(category: string) {
  const items = category === "Aircon"
    ? ["Copper pipework", "Drain and electrical connection", "Mounting and commissioning"]
    : category === "Heat Pump"
      ? ["Plumbing connection kit", "Electrical isolation and commissioning", "Decommissioning allowance"]
      : ["AC cable run", "DC cable run", "Racking and balance equipment"];
  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item)}</td>
      <td class="c">1</td>
      <td class="r">${currency(0)}</td>
    </tr>
  `).join("");
}

function sizingGuidePage(quote: QuoteRecord, customer: Customer | undefined) {
  const heads = quote.items.filter((item) => item.role === "Indoor Head");
  const signature = quote.customerSignatureDataUrl ? `<img class="saved-customer-signature" src="${quote.customerSignatureDataUrl}" alt="Customer signature">` : "";
  const signedDate = quote.customerSignedAt ? formatDate(quote.customerSignedAt) : "__________________";
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
          <div class="quot-to-card"><label>Customer</label><div class="name">Signature</div>${signature}<p>Name: ${escapeHtml(customerName(customer))}<br>Date: ${escapeHtml(signedDate)}</p></div>
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

function calculateQuote(quote: QuoteRecord) {
  const allItems = [...quote.items, ...quote.additionalServices];
  const certificates = allItems.reduce((sum, item) => sum + item.certificates * item.quantity, 0);
  const certificateDiscount = certificates * quote.certificateRate;
  const productCost = allItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  const installCost = allItems.reduce((sum, item) => sum + item.installPrice * item.quantity, 0);
  const totalCost = productCost + installCost + quote.minimumContributionAdjustment;
  const systemTotalIncGst = totalCost * (1 + quote.gstRate / 100);
  const gstAmount = systemTotalIncGst - totalCost;
  const rebate = quote.rebate ?? (quote.stcPanelRebate ?? 0) + (quote.stcBatteryRebate ?? 0) + (quote.solarVicRebate ?? 0);
  const totalDeductions = certificateDiscount + rebate + (quote.solarVicLoan ?? 0);
  const finalPriceIncGst = Math.max(0, systemTotalIncGst - totalDeductions);
  const depositAmount = finalPriceIncGst * ((quote.depositPercent ?? 50) / 100);
  const balanceDue = Math.max(0, finalPriceIncGst - depositAmount);
  const netExGst = Math.max(0, finalPriceIncGst / (1 + quote.gstRate / 100));
  const netIncGst = finalPriceIncGst;
  return { certificates, certificateDiscount, rebate, productCost, installCost, totalCost, systemTotalIncGst, gstAmount, totalDeductions, finalPriceIncGst, depositAmount, balanceDue, netExGst, netIncGst };
}
