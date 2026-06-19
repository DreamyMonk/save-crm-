import { CrmState, Customer, Invoice, Lead, ProductCategory, ProposalPackage, QuoteRecord } from "./crm-data";

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
  const effectiveQuote = latestQuote([quote, existingPackage?.quoteSnapshot]) ?? quote;
  return {
    id: existingPackage?.id ?? `PP-${effectiveQuote.id}`,
    quoteId: effectiveQuote.id,
    invoiceId: existingPackage?.invoiceId,
    customerId: effectiveQuote.customerId,
    leadId: customer?.leadId,
    productCategory: effectiveQuote.productCategory,
    templateType: templateTypeForCategory(effectiveQuote.productCategory),
    publicToken: existingPackage?.publicToken ?? effectiveQuote.id,
    status: proposalStatusFromQuote(effectiveQuote),
    assignedAgent: customer?.salesAgent || existingPackage?.assignedAgent || "vinay dhanekula",
    substituteAgent: customer?.secondSalesAgent || existingPackage?.substituteAgent,
    sentBy: effectiveQuote.proposalSentBy ?? existingPackage?.sentBy,
    sentAt: effectiveQuote.proposalSentAt,
    openedAt: effectiveQuote.proposalOpenedAt,
    openCount: effectiveQuote.proposalOpenCount ?? 0,
    signedAt: effectiveQuote.customerSignedAt,
    signatureDataUrl: effectiveQuote.customerSignatureDataUrl,
    changeRequestHtml: effectiveQuote.proposalChangeRequestHtml,
    changeRequestedAt: effectiveQuote.proposalChangeRequestedAt,
    lastActivityAt: effectiveQuote.customerSignedAt ?? effectiveQuote.proposalChangeRequestedAt ?? effectiveQuote.proposalOpenedAt ?? effectiveQuote.proposalSentAt ?? effectiveQuote.activityDate,
    quoteSnapshot: effectiveQuote,
    customerSnapshot: customer ?? existingPackage?.customerSnapshot,
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
  const previousQuote = state.quotes.find((item) => item.id === quote.id);
  return {
    ...state,
    quotes: state.quotes.some((item) => item.id === quote.id)
      ? state.quotes.map((item) => (item.id === quote.id ? quote : item))
      : [quote, ...state.quotes],
    proposalPackages: upsertProposalPackage(state.proposalPackages ?? [], quote, customer, invoice?.id),
    leads: updateLinkedLeadForProposal(state, quote, previousQuote, customer),
    invoices: invoice
      ? state.invoices.some((item) => item.id === invoice.id)
        ? state.invoices.map((item) => (item.id === invoice.id ? invoice : item))
        : [invoice, ...state.invoices]
      : state.invoices,
  };
}

function updateLinkedLeadForProposal(state: CrmState, quote: QuoteRecord, previousQuote: QuoteRecord | undefined, customer: Customer | undefined) {
  const leadId = customer?.leadId;
  if (!leadId) return state.leads;
  const previousStatus = previousQuote ? proposalStatusFromQuote(previousQuote) : "Draft";
  const nextStatus = proposalStatusFromQuote(quote);
  return state.leads.map((lead) => {
    if (lead.id !== leadId) return lead;
    const updates = leadUpdatesForProposalStatus(lead, nextStatus);
    if (!updates && previousStatus === nextStatus) return lead;
    const updatedAt = proposalActivityDate(quote) ?? new Date().toISOString();
    const activitySummary = `Proposal ${quote.id} status: ${nextStatus}.`;
    const alreadyLogged = (lead.activities ?? []).some((activity) => activity.summary === activitySummary);
    return {
      ...lead,
      ...(updates ?? {}),
      updatedAt,
      activities: alreadyLogged
        ? lead.activities ?? []
        : [
            {
              id: `A-${lead.id}-${(lead.activities ?? []).length + 1}`,
              type: "Proposal" as const,
              summary: activitySummary,
              outcome: proposalActivityOutcome(nextStatus),
              createdAt: updatedAt,
              createdBy: quote.proposalSentBy || "SavePlanet CRM",
            },
            ...(lead.activities ?? []),
          ],
    };
  });
}

function leadUpdatesForProposalStatus(lead: Lead, status: ProposalPackage["status"]): Partial<Lead> | undefined {
  if (status === "Signed") {
    return {
      salesPhase: "Signed won",
      stageId: leadStageForStatus(lead, "Signed") ?? lead.stageId,
      probability: Math.max(lead.probability ?? 0, 100),
    };
  }
  if (status === "Sent" || status === "Opened") {
    return {
      salesPhase: "Proposal sent",
      stageId: leadStageForStatus(lead, "Sent") ?? lead.stageId,
      probability: Math.max(lead.probability ?? 0, 70),
    };
  }
  if (status === "Changes requested") {
    return {
      salesPhase: "Proposal pending",
      stageId: leadStageForStatus(lead, "Changes requested") ?? lead.stageId,
    };
  }
  return undefined;
}

function leadStageForStatus(lead: Lead, status: ProposalPackage["status"]) {
  if (lead.pipelineId === "sales") {
    if (status === "Signed") return "closed";
    if (status === "Sent" || status === "Opened") return "proposal";
    if (status === "Changes requested") return "quote-pending";
  }
  if (lead.pipelineId === "solar") {
    if (status === "Signed") return "install";
    if (status === "Sent" || status === "Opened") return "quote";
    if (status === "Changes requested") return "approval";
  }
  return undefined;
}

function proposalActivityOutcome(status: ProposalPackage["status"]) {
  if (status === "Signed") return "Customer signed the proposal.";
  if (status === "Opened") return "Customer opened the proposal link.";
  if (status === "Sent") return "Proposal email was sent to the customer.";
  if (status === "Changes requested") return "Customer requested proposal changes.";
  return "Proposal returned to draft.";
}

function proposalActivityDate(quote: QuoteRecord) {
  return quote.customerSignedAt ?? quote.proposalChangeRequestedAt ?? quote.proposalOpenedAt ?? quote.proposalSentAt ?? quote.proposalUpdatedAt;
}

function latestQuote(quotes: Array<QuoteRecord | undefined>) {
  return quotes
    .filter((item): item is QuoteRecord => Boolean(item))
    .sort((left, right) => quoteActivityTime(right) - quoteActivityTime(left))[0];
}

function quoteActivityTime(quote: QuoteRecord) {
  return Math.max(
    timestamp(quote.customerSignedAt),
    timestamp(quote.proposalChangeRequestedAt),
    timestamp(quote.proposalOpenedAt),
    timestamp(quote.proposalSentAt),
    timestamp(quote.proposalUpdatedAt),
    timestamp(quote.activityDate),
  );
}

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
