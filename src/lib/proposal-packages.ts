import { CrmState, Customer, Invoice, ProductCategory, ProposalPackage, QuoteRecord } from "./crm-data";

export function proposalStatusFromQuote(quote: QuoteRecord): ProposalPackage["status"] {
  if (quote.customerSignedAt) return "Signed";
  if (quote.proposalChangeRequestHtml) return "Changes requested";
  if (quote.proposalOpenedAt) return "Opened";
  if (quote.proposalSentAt) return "Sent";
  return "Draft";
}

export function templateTypeForCategory(category?: ProductCategory): ProposalPackage["templateType"] {
  if (category === "Aircon") return "aircon";
  if (category === "Heat Pump") return "heatpump";
  return "solar";
}

export function proposalPackageFromQuote(quote: QuoteRecord, customer?: Customer, existingPackage?: ProposalPackage): ProposalPackage {
  return {
    id: existingPackage?.id ?? `PP-${quote.id}`,
    quoteId: quote.id,
    invoiceId: existingPackage?.invoiceId,
    customerId: quote.customerId,
    leadId: customer?.leadId,
    productCategory: quote.productCategory,
    templateType: templateTypeForCategory(quote.productCategory),
    publicToken: existingPackage?.publicToken ?? quote.id,
    status: proposalStatusFromQuote(quote),
    assignedAgent: customer?.salesAgent || existingPackage?.assignedAgent || "vinay dhanekula",
    substituteAgent: customer?.secondSalesAgent || existingPackage?.substituteAgent,
    sentBy: quote.proposalSentBy ?? existingPackage?.sentBy,
    sentAt: quote.proposalSentAt ?? existingPackage?.sentAt,
    openedAt: quote.proposalOpenedAt ?? existingPackage?.openedAt,
    openCount: quote.proposalOpenCount ?? existingPackage?.openCount ?? 0,
    signedAt: quote.customerSignedAt ?? existingPackage?.signedAt,
    signatureDataUrl: quote.customerSignatureDataUrl ?? existingPackage?.signatureDataUrl,
    changeRequestHtml: quote.proposalChangeRequestHtml ?? existingPackage?.changeRequestHtml,
    changeRequestedAt: quote.proposalChangeRequestedAt ?? existingPackage?.changeRequestedAt,
    lastActivityAt: quote.customerSignedAt ?? quote.proposalChangeRequestedAt ?? quote.proposalOpenedAt ?? quote.proposalSentAt ?? quote.activityDate,
  };
}

export function upsertProposalPackage(packages: ProposalPackage[], quote: QuoteRecord, customer?: Customer, invoiceId?: string) {
  const existingPackage = packages.find((item) => item.quoteId === quote.id || item.id === `PP-${quote.id}`);
  const nextPackage = {
    ...proposalPackageFromQuote(quote, customer, existingPackage),
    invoiceId: invoiceId ?? existingPackage?.invoiceId,
  };
  return existingPackage
    ? packages.map((item) => (item.id === existingPackage.id ? nextPackage : item))
    : [nextPackage, ...packages];
}

export function invoiceFromQuote(quote: QuoteRecord, customer: Customer | undefined, amount: number, owner: string): Invoice {
  const issued = quote.proposalSentAt ? new Date(quote.proposalSentAt) : new Date();
  const due = new Date(issued);
  due.setDate(due.getDate() + 14);
  return {
    id: `INV-${quote.id.replace(/^\D+/, "") || quote.id}`,
    client: customer?.name || customer?.businessName || quote.description || "Customer",
    amount,
    status: "Sent",
    issueDate: issued.toISOString().slice(0, 10),
    due: due.toISOString().slice(0, 10),
    owner,
    leadId: customer?.leadId,
    billToEmail: customer?.email,
    taxRate: quote.gstRate,
    paidAmount: 0,
    notes: `Auto generated from proposal ${quote.id}.`,
    lineItems: [...quote.items, ...quote.additionalServices].map((item, index) => ({
      id: `${quote.id}-LI-${index + 1}`,
      description: `${item.role}: ${item.brand} ${item.model}`,
      quantity: item.quantity,
      rate: item.productPrice + item.installPrice,
    })),
  };
}

export function syncProposalCollections(state: CrmState, quote: QuoteRecord, customer: Customer | undefined, invoice?: Invoice): CrmState {
  return {
    ...state,
    quotes: state.quotes.some((item) => item.id === quote.id)
      ? state.quotes.map((item) => (item.id === quote.id ? quote : item))
      : [quote, ...state.quotes],
    proposalPackages: upsertProposalPackage(state.proposalPackages ?? [], quote, customer, invoice?.id),
    invoices: invoice
      ? state.invoices.some((item) => item.id === invoice.id)
        ? state.invoices.map((item) => (item.id === invoice.id ? invoice : item))
        : [invoice, ...state.invoices]
      : state.invoices,
  };
}
