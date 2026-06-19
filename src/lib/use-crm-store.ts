"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, writeBatch } from "firebase/firestore";
import { fullAccessModules, isProtectedAdminEmail, isProtectedAdminMember, protectedAdminMemberForEmail } from "./admin-access";
import { withDefaultProductImage } from "./aircon-product-images";
import { CrmState, Lead, LeadSalesPhase, LeadSource, ModuleKey, ProductCategory, ProposalPackage, QuoteRecord, initialCrmState } from "./crm-data";
import { getFirebaseDb } from "./firebase";

const legacyStorageKey = "saveplanet-crm-state-v2";
const legacyCrmCacheKeys = [legacyStorageKey, "saveplanet-last-quote-number"];
const legacyCrmCachePrefixes = ["saveplanet-quote-", "saveplanet-proposal-customer-"];
const crmDocumentPath = ["crmWorkspaces", "default"] as const;
const crmChunksPath = ["crmWorkspaces", "default", "stateChunks"] as const;
const stateChunkSize = 650_000;
const seedProductReplacementCategories = new Set<ProductCategory>(["Aircon", "Heat Pump"]);

type SyncState = "loading" | "firebase" | "local" | "saving";

function normalizeState(state: CrmState): CrmState {
  const legacyEmailKey = "mail" + "jet";
  const legacyEmailSettings = (state.settings as unknown as Record<string, CrmState["settings"]["resend"] | undefined> | undefined)?.[legacyEmailKey];
  const deprecatedTeamKeys = new Set((state.team ?? initialCrmState.team).filter(isDeprecatedTeamMember).flatMap(accessMemberKeys));
  const rawNormalizedTeam = ensureProtectedAdmins(
    (state.team ?? initialCrmState.team)
      .filter((member) => !isDeprecatedTeamMember(member))
      .map((member) => ({
        ...member,
        modules: normalizeMemberModules(member.modules),
      })),
  );
  const deletedTeamMemberKeys = removeLiveMemberKeysFromDeletedKeys(state.deletedTeamMemberKeys ?? [], rawNormalizedTeam);
  const deletedCustomerIds = Array.from(new Set(state.deletedCustomerIds ?? []));
  const deletedProductIds = Array.from(new Set(state.deletedProductIds ?? []));
  const deletedLeadIds = Array.from(new Set(state.deletedLeadIds ?? []));
  const deletedQuoteIds = Array.from(new Set(state.deletedQuoteIds ?? []));
  const deletedProposalPackageIds = Array.from(new Set(state.deletedProposalPackageIds ?? []));
  const deletedInvoiceIds = Array.from(new Set(state.deletedInvoiceIds ?? []));
  const normalizedTeam = mergeByUpdatedAccess(rawNormalizedTeam, [], deletedTeamMemberKeys);
  return {
    ...initialCrmState,
    ...state,
    pipelines: normalizePipelines(state.pipelines ?? initialCrmState.pipelines),
    team: normalizedTeam,
    deletedTeamMemberKeys,
    deletedCustomerIds,
    deletedProductIds,
    deletedLeadIds,
    deletedQuoteIds,
    deletedProposalPackageIds,
    deletedInvoiceIds,
    leads: (state.leads ?? initialCrmState.leads).map((lead) => ({
      ...lead,
      assignedTo: deprecatedTeamKeys.has(lead.assignedTo) ? "admin" : lead.assignedTo,
      substituteAssignedTo: lead.substituteAssignedTo && deprecatedTeamKeys.has(lead.substituteAssignedTo) ? "" : lead.substituteAssignedTo ?? "",
      leadSource: normalizeLeadSource(lead.leadSource ?? lead.source),
      salesPhase: normalizeSalesPhase(lead.salesPhase, lead.stageId),
      ticketSize: lead.ticketSize ?? lead.amount,
      productInterest: lead.productInterest ?? lead.customFields?.find((field) => field.label.toLowerCase().includes("product"))?.value ?? lead.title,
      updatedAt: lead.updatedAt ?? leadUpdatedAt(lead),
      callCount: lead.callCount ?? lead.activities?.filter((activity) => activity.type === "Call").length ?? 0,
      lastContactedAt: lead.lastContactedAt ?? lead.activities?.[0]?.createdAt,
      activities: lead.activities ?? [],
      customFields: lead.customFields ?? [],
      communicationPreferences: lead.communicationPreferences ?? {
        dndAllChannels: true,
        email: false,
        textMessages: false,
        callsAndVoicemail: false,
        inboundCallsAndSms: false,
      },
    })).filter((lead) => !deletedLeadIds.includes(lead.id)),
    customers: (state.customers ?? initialCrmState.customers)
      .filter((customer) => !deletedCustomerIds.includes(customer.id))
      .map((customer) => ({
        ...customer,
        customerType: customer.customerType ?? "Business",
        businessName: customer.businessName ?? customer.address ?? "",
        contactType: customer.contactType ?? "Primary",
        salesAgent: isDeprecatedTeamName(customer.salesAgent) ? "vinay dhanekula" : customer.salesAgent ?? "vinay dhanekula",
        secondSalesAgent: isDeprecatedTeamName(customer.secondSalesAgent) ? "" : customer.secondSalesAgent,
      })),
    products: mergeProductsByLatestUpdate(state.products ?? [], initialCrmState.products).map(withDefaultProductImage).filter((product) => !deletedProductIds.includes(product.id)),
    quotes: (state.quotes ?? initialCrmState.quotes).filter((quote) => !deletedQuoteIds.includes(quote.id)),
    proposalPackages: normalizeProposalPackages(state),
    invoices: (state.invoices ?? initialCrmState.invoices).filter((invoice) => !deletedInvoiceIds.includes(invoice.id)),
    appointments: state.appointments ?? initialCrmState.appointments,
    settings: {
      ...initialCrmState.settings,
      ...(state.settings ?? {}),
      loginImageUrl: state.settings?.loginImageUrl ?? initialCrmState.settings.loginImageUrl,
      logoUrl: state.settings?.logoUrl || initialCrmState.settings.logoUrl,
      resend: {
        ...initialCrmState.settings.resend,
        ...(state.settings?.resend ?? legacyEmailSettings ?? {}),
        fromEmail: state.settings?.resend?.fromEmail || legacyEmailSettings?.fromEmail || initialCrmState.settings.resend.fromEmail,
        enabled: state.settings?.resend?.enabled ?? legacyEmailSettings?.enabled ?? true,
      },
      twilio: {
        ...initialCrmState.settings.twilio,
        ...(state.settings?.twilio ?? {}),
      },
    },
  };
}

const salesStages = initialCrmState.pipelines.find((pipeline) => pipeline.id === "sales")?.stages ?? [];

function normalizePipelines(pipelines: CrmState["pipelines"]) {
  return pipelines.map((pipeline) => {
    if (pipeline.id !== "sales") return pipeline;
    const stageIds = new Set(pipeline.stages.map((stage) => stage.id));
    return {
      ...pipeline,
      stages: [...pipeline.stages, ...salesStages.filter((stage) => !stageIds.has(stage.id))],
    };
  });
}

function normalizeLeadSource(value?: string): LeadSource {
  const normalized = (value || "Manual").toLowerCase();
  if (normalized.includes("meta")) return "Meta Ads";
  if (normalized.includes("google")) return "Google Ads";
  if (normalized.includes("website")) return "Website";
  if (normalized.includes("referral")) return "Referral";
  if (normalized.includes("walk")) return "Walk-in";
  if (normalized.includes("campaign")) return "Campaign";
  return "Manual";
}

function normalizeSalesPhase(value: Lead["salesPhase"], stageId: string): LeadSalesPhase {
  if (value) return value;
  if (stageId === "first-call" || stageId === "discussion") return "First call";
  if (stageId === "pitch") return "Business pitch";
  if (stageId === "quote-pending") return "Proposal pending";
  if (stageId === "proposal") return "Proposal sent";
  if (stageId === "closed" || stageId === "install") return "Signed won";
  if (stageId === "lost") return "Lost";
  return "Enquiry";
}

function normalizeProposalPackages(state: CrmState) {
  const deletedQuoteIds = new Set(state.deletedQuoteIds ?? []);
  const deletedProposalPackageIds = new Set(state.deletedProposalPackageIds ?? []);
  const quotes = (state.quotes ?? initialCrmState.quotes).filter((quote) => !deletedQuoteIds.has(quote.id));
  const existingPackages = (state.proposalPackages ?? []).filter((proposalPackage) => !deletedProposalPackageIds.has(proposalPackage.id) && !deletedQuoteIds.has(proposalPackage.quoteId));
  const packageByQuote = new Map(existingPackages.map((proposalPackage) => [proposalPackage.quoteId, proposalPackage]));
  const quotePackages = quotes.map((quote) => packageFromQuote(quote, packageByQuote.get(quote.id), state));
  const quoteIds = new Set(quotes.map((quote) => quote.id));
  const orphanPackages = existingPackages.filter((proposalPackage) => !quoteIds.has(proposalPackage.quoteId));
  return [...quotePackages, ...orphanPackages];
}

function packageFromQuote(quote: QuoteRecord, existingPackage: ProposalPackage | undefined, state: CrmState): ProposalPackage {
  const effectiveQuote = latestQuote([quote, existingPackage?.quoteSnapshot]) ?? quote;
  const customer = (state.customers ?? initialCrmState.customers).find((item) => item.id === effectiveQuote.customerId) ?? existingPackage?.customerSnapshot;
  const status = effectiveQuote.customerSignedAt
    ? "Signed"
    : effectiveQuote.proposalChangeRequestHtml
      ? "Changes requested"
      : effectiveQuote.proposalOpenedAt
        ? "Opened"
        : effectiveQuote.proposalSentAt
          ? "Sent"
          : "Draft";

  return {
    id: existingPackage?.id ?? `PP-${effectiveQuote.id}`,
    quoteId: effectiveQuote.id,
    invoiceId: existingPackage?.invoiceId,
    customerId: effectiveQuote.customerId,
    leadId: customer?.leadId,
    productCategory: effectiveQuote.productCategory,
    templateType: templateTypeForCategory(effectiveQuote.productCategory),
    publicToken: existingPackage?.publicToken ?? effectiveQuote.id,
    status,
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

function templateTypeForCategory(category: QuoteRecord["productCategory"]): ProposalPackage["templateType"] {
  if (category === "Aircon") return "aircon";
  if (category === "Heat Pump") return "heatpump";
  return "solar";
}

function normalizeMemberModules(modules: CrmState["team"][number]["modules"]) {
  const validModules = new Set(Object.keys(initialCrmStateModuleLabels()) as ModuleKey[]);
  return Array.from(new Set((modules ?? []).filter((module): module is ModuleKey => validModules.has(module))));
}

function ensureProtectedAdmins(team: CrmState["team"]) {
  const protectedAdmins = [protectedAdminMemberForEmail("admin@admin.com"), protectedAdminMemberForEmail("vinay@saveplanet.com.au")].filter((member): member is CrmState["team"][number] => Boolean(member));
  const nextTeam = [...team];
  protectedAdmins.forEach((protectedAdmin) => {
    const existingIndex = nextTeam.findIndex((member) => member.uid === protectedAdmin.uid || (isProtectedAdminEmail(member.email) && member.email?.trim().toLowerCase() === protectedAdmin.email));
    if (existingIndex < 0) {
      nextTeam.unshift(protectedAdmin);
      return;
    }
    const existing = nextTeam[existingIndex];
    nextTeam[existingIndex] = {
      ...existing,
      uid: existing.uid || protectedAdmin.uid,
      email: protectedAdmin.email,
      name: existing.name || protectedAdmin.name,
      role: "Admin",
      modules: fullAccessModules,
      active: true,
      accessUpdatedAt: existing.accessUpdatedAt ?? protectedAdmin.accessUpdatedAt,
    };
  });
  return nextTeam;
}

export function useCrmStore() {
  const [state, setBaseState] = useState<CrmState>(initialCrmState);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSavedState = useRef<string>("");
  const stateRef = useRef(state);

  const setState: Dispatch<SetStateAction<CrmState>> = useCallback((value) => {
    setBaseState((currentState) => {
      const nextState = typeof value === "function" ? (value as (previousState: CrmState) => CrmState)(currentState) : value;
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function loadRemoteState() {
      try {
        clearLegacyCrmCache();
        const ref = doc(getFirebaseDb(), ...crmDocumentPath);
        const savedRemoteState = await readRemoteState();
        if (!active) return;
        if (savedRemoteState) {
          const remoteState = savedRemoteState;
          lastSavedState.current = JSON.stringify(remoteState);
          setBaseState(remoteState);
          stateRef.current = remoteState;
        } else {
          const nextState = normalizeState(initialCrmState);
          await writeRemoteState(nextState);
          lastSavedState.current = JSON.stringify(nextState);
          setBaseState(nextState);
          stateRef.current = nextState;
        }
        unsubscribe = onSnapshot(ref, async (remoteSnapshot) => {
          if (!active || !remoteSnapshot.exists()) return;
          const remoteState = await stateFromWorkspaceSnapshot(remoteSnapshot.data());
          if (!active) return;
          const mergedState = mergeLocalCollections(remoteState, normalizeState(stateRef.current));
          const serializedState = JSON.stringify(mergedState);
          if (serializedState === JSON.stringify(stateRef.current)) return;
          lastSavedState.current = serializedState;
          setBaseState(mergedState);
          stateRef.current = mergedState;
          setSyncState("firebase");
          setSyncError(null);
        }, (error) => {
          if (!active) return;
          setSyncState("local");
          setSyncError(error.message || "Firebase live sync failed");
        });
        setSyncState("firebase");
        setSyncError(null);
      } catch (error) {
        if (!active) return;
        setSyncState("local");
        setSyncError(error instanceof Error ? error.message : "Firebase sync failed");
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    void loadRemoteState();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serializedState = JSON.stringify(state);

    if (syncState !== "firebase") return;
    if (serializedState === lastSavedState.current) return;
    const timeout = window.setTimeout(() => {
      setSyncState("saving");
      saveMergedState(state)
        .then((savedState) => {
          lastSavedState.current = JSON.stringify(savedState);
          setBaseState(savedState);
          stateRef.current = savedState;
          setSyncState("firebase");
          setSyncError(null);
        })
        .catch((error) => {
          setSyncState("local");
          setSyncError(error instanceof Error ? error.message : "Firebase save failed");
        });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [ready, state, syncState]);

  return { state, setState, ready, syncState, syncError };
}

function clearLegacyCrmCache() {
  if (typeof window === "undefined") return;
  legacyCrmCacheKeys.forEach((key) => window.localStorage.removeItem(key));
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key && legacyCrmCachePrefixes.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}

function mergeLocalCollections(remoteState: CrmState, localState: CrmState | null, options: { includeLocalDeletes?: boolean } = {}) {
  if (!localState) return remoteState;
  const includeLocalDeletes = options.includeLocalDeletes ?? false;
  // Browser caches can be stale across devices, so only trust local tombstones when seeding a missing workspace.
  const deletedTeamMemberKeys = includeLocalDeletes
    ? mergeDeletedTeamMemberKeys(remoteState, localState)
    : removeLiveMemberKeysFromDeletedKeys(remoteState.deletedTeamMemberKeys ?? [], remoteState.team);
  const deletedCustomerIds = mergeDeletedIds(remoteState.deletedCustomerIds, includeLocalDeletes ? localState.deletedCustomerIds : undefined, localState.customers);
  const deletedProductIds = mergeDeletedIds(remoteState.deletedProductIds, includeLocalDeletes ? localState.deletedProductIds : undefined, localState.products);
  const deletedLeadIds = mergeDeletedIds(remoteState.deletedLeadIds, includeLocalDeletes ? localState.deletedLeadIds : undefined, localState.leads);
  const deletedQuoteIds = mergeDeletedIds(remoteState.deletedQuoteIds, includeLocalDeletes ? localState.deletedQuoteIds : undefined, localState.quotes);
  const deletedProposalPackageIds = mergeDeletedIds(remoteState.deletedProposalPackageIds, includeLocalDeletes ? localState.deletedProposalPackageIds : undefined, localState.proposalPackages);
  const deletedInvoiceIds = mergeDeletedIds(remoteState.deletedInvoiceIds, includeLocalDeletes ? localState.deletedInvoiceIds : undefined, localState.invoices);
  return {
    ...remoteState,
    deletedTeamMemberKeys,
    deletedCustomerIds,
    deletedProductIds,
    deletedLeadIds,
    deletedQuoteIds,
    deletedProposalPackageIds,
    deletedInvoiceIds,
    team: mergeByUpdatedAccess(remoteState.team, localState.team, deletedTeamMemberKeys),
    leads: mergeLeadsByLatestUpdate(remoteState.leads, localState.leads).filter((lead) => !deletedLeadIds.includes(lead.id)),
    products: mergeProductsByLatestUpdate(remoteState.products, localState.products).filter((product) => !deletedProductIds.includes(product.id)),
    customers: mergeByLatestUpdate(remoteState.customers, localState.customers).filter((customer) => !deletedCustomerIds.includes(customer.id)),
    quotes: mergeQuotesByLatestProposalActivity(remoteState.quotes, localState.quotes).filter((quote) => !deletedQuoteIds.includes(quote.id)),
    proposalPackages: mergeProposalPackagesByLatestActivity(remoteState.proposalPackages, localState.proposalPackages).filter((proposalPackage) => !deletedProposalPackageIds.includes(proposalPackage.id) && !deletedQuoteIds.includes(proposalPackage.quoteId)),
    invoices: mergeInvoicesWithDeletedIds(remoteState.invoices, localState.invoices, deletedInvoiceIds),
  };
}

function initialCrmStateModuleLabels() {
  return {
    dashboard: true,
    leads: true,
    customers: true,
    products: true,
    quotes: true,
    invoices: true,
    access: true,
    reports: true,
    pipelines: true,
    calendar: true,
    settings: true,
  } satisfies Record<ModuleKey, true>;
}

function mergeByUpdatedAccess(remoteTeam: CrmState["team"], localTeam: CrmState["team"], deletedTeamMemberKeys: string[] = []) {
  const deletedKeys = new Set(deletedTeamMemberKeys);
  const mergedByKey = new Map<string, CrmState["team"][number]>();
  for (const member of [...remoteTeam, ...localTeam]) {
    if (accessMemberKeys(member).some((memberKey) => deletedKeys.has(memberKey)) && !isProtectedAdmin(member)) continue;
    const memberKeys = accessMemberKeys(member);
    const existing = memberKeys.map((key) => mergedByKey.get(key)).find((item): item is CrmState["team"][number] => Boolean(item));
    if (!existing || timestamp(member.accessUpdatedAt) >= timestamp(existing.accessUpdatedAt)) {
      if (existing) {
        accessMemberKeys(existing).forEach((key) => mergedByKey.delete(key));
      }
      const nextMember = existing ? { ...existing, ...member, id: existing.id || member.id, uid: member.uid || existing.uid } : member;
      accessMemberKeys(nextMember).forEach((key) => mergedByKey.set(key, nextMember));
    }
  }
  return ensureProtectedAdmins(Array.from(new Set(mergedByKey.values())));
}

function accessMemberKeys(member: CrmState["team"][number]) {
  return [member.email?.trim().toLowerCase(), member.uid, member.id].filter((key): key is string => Boolean(key));
}

function mergeDeletedTeamMemberKeys(remoteState: CrmState, localState: CrmState) {
  const protectedKeys = new Set([...remoteState.team, ...localState.team].filter(isProtectedAdmin).flatMap(accessMemberKeys));
  return removeLiveMemberKeysFromDeletedKeys(
    Array.from(new Set([...(remoteState.deletedTeamMemberKeys ?? []), ...(localState.deletedTeamMemberKeys ?? [])])).filter((key) => !protectedKeys.has(key)),
    localState.team,
  );
}

function removeLiveMemberKeysFromDeletedKeys(deletedKeys: string[], team: CrmState["team"]) {
  const liveKeys = new Set(team.filter((member) => !isDeprecatedTeamMember(member)).flatMap(accessMemberKeys));
  return deletedKeys.filter((key) => !liveKeys.has(key));
}

function isProtectedAdmin(member: CrmState["team"][number]) {
  return isProtectedAdminMember(member);
}

function isDeprecatedTeamMember(member: CrmState["team"][number]) {
  return !isProtectedAdmin(member) && isDeprecatedTeamName(member.name);
}

function isDeprecatedTeamName(name?: string) {
  const normalized = name?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return normalized === "aarav admin" || normalized === "arav admin";
}

function mergeByLatestUpdate<T extends { id: string; updatedAt?: string }>(remoteItems: T[], localItems: T[]) {
  const items = new Map<string, T>();
  for (const item of remoteItems) {
    items.set(item.id, item);
  }
  for (const localItem of localItems) {
    const remoteItem = items.get(localItem.id);
    if (!remoteItem || timestamp(localItem.updatedAt) > timestamp(remoteItem.updatedAt)) {
      items.set(localItem.id, localItem);
    }
  }
  return Array.from(items.values());
}

function mergeLeadsByLatestUpdate(remoteItems: Lead[], localItems: Lead[]) {
  const items = new Map<string, Lead>();
  const usedIds = new Set<string>();

  for (const remoteItem of remoteItems) {
    const lead = normalizeLeadTimestamp(remoteItem);
    items.set(lead.id, lead);
    usedIds.add(lead.id);
  }

  for (const localItem of localItems) {
    const localLead = normalizeLeadTimestamp(localItem);
    const remoteLead = items.get(localLead.id);
    if (!remoteLead) {
      items.set(localLead.id, localLead);
      usedIds.add(localLead.id);
      continue;
    }

    if (sameLeadRecord(remoteLead, localLead)) {
      if (timestamp(localLead.updatedAt) > timestamp(remoteLead.updatedAt)) {
        items.set(localLead.id, localLead);
      }
      continue;
    }

    const conflictId = uniqueConflictId(localLead.id, usedIds);
    items.set(conflictId, {
      ...localLead,
      id: conflictId,
      updatedAt: new Date().toISOString(),
    });
  }

  return Array.from(items.values());
}

function normalizeLeadTimestamp(lead: Lead) {
  return { ...lead, updatedAt: lead.updatedAt ?? leadUpdatedAt(lead) };
}

function sameLeadRecord(left: Lead, right: Lead) {
  return leadFingerprint(left) === leadFingerprint(right);
}

function leadFingerprint(lead: Lead) {
  return [lead.title, lead.company, lead.contact, lead.email, lead.phone]
    .map((value) => (value || "").trim().toLowerCase())
    .join("|");
}

function uniqueConflictId(baseId: string, usedIds: Set<string>) {
  const cleanBase = baseId.replace(/-DUP-\d+$/i, "");
  let index = 2;
  let nextId = `${cleanBase}-DUP-${index}`;
  while (usedIds.has(nextId)) {
    index += 1;
    nextId = `${cleanBase}-DUP-${index}`;
  }
  usedIds.add(nextId);
  return nextId;
}

function mergeProductsByLatestUpdate(remoteItems: CrmState["products"], localItems: CrmState["products"]) {
  const isReplacementCategory = (category: string) => seedProductReplacementCategories.has(category as ProductCategory);
  const replacementProducts = initialCrmState.products.filter((product) => isReplacementCategory(product.category));
  const remoteProducts = remoteItems.filter((product) => !isReplacementCategory(product.category));
  const localProducts = localItems.filter((product) => !isReplacementCategory(product.category));
  return [...replacementProducts, ...mergeByLatestUpdate(remoteProducts, localProducts)];
}

function mergeDeletedIds<T extends { id: string }>(remoteIds: string[] | undefined, localIds: string[] | undefined, liveItems: T[] = []) {
  const liveIds = new Set(liveItems.map((item) => item.id));
  return Array.from(new Set([...(remoteIds ?? []), ...(localIds ?? [])])).filter((id) => !liveIds.has(id));
}

function mergeInvoicesWithDeletedIds(remoteItems: CrmState["invoices"], localItems: CrmState["invoices"], deletedInvoiceIds: string[]) {
  const deletedIds = new Set(deletedInvoiceIds);
  const items = new Map<string, CrmState["invoices"][number]>();
  for (const item of remoteItems) {
    if (!deletedIds.has(item.id)) items.set(item.id, item);
  }
  for (const localItem of localItems) {
    if (!deletedIds.has(localItem.id)) items.set(localItem.id, localItem);
  }
  return Array.from(items.values());
}

function mergeQuotesByLatestProposalActivity(remoteItems: QuoteRecord[], localItems: QuoteRecord[]) {
  const items = new Map<string, QuoteRecord>();
  for (const item of remoteItems) {
    items.set(item.id, item);
  }
  for (const localItem of localItems) {
    const remoteItem = items.get(localItem.id);
    if (!remoteItem || quoteActivityTimestamp(localItem) > quoteActivityTimestamp(remoteItem)) {
      items.set(localItem.id, localItem);
    }
  }
  return Array.from(items.values());
}

function latestQuote(quotes: Array<QuoteRecord | undefined>) {
  return quotes
    .filter((quote): quote is QuoteRecord => Boolean(quote))
    .sort((left, right) => quoteActivityTimestamp(right) - quoteActivityTimestamp(left))[0];
}

function mergeProposalPackagesByLatestActivity(remoteItems: ProposalPackage[], localItems: ProposalPackage[]) {
  const items = new Map<string, ProposalPackage>();
  for (const item of remoteItems) {
    items.set(item.id, item);
  }
  for (const localItem of localItems) {
    const remoteItem = items.get(localItem.id);
    if (!remoteItem || proposalPackageActivityTimestamp(localItem) > proposalPackageActivityTimestamp(remoteItem)) {
      items.set(localItem.id, localItem);
    }
  }
  return Array.from(items.values());
}

function quoteActivityTimestamp(quote: QuoteRecord) {
  return Math.max(
    timestamp(quote.customerSignedAt),
    timestamp(quote.proposalChangeRequestedAt),
    timestamp(quote.proposalOpenedAt),
    timestamp(quote.proposalSentAt),
    timestamp(quote.proposalUpdatedAt),
    timestamp(quote.activityDate),
  );
}

function proposalPackageActivityTimestamp(proposalPackage: ProposalPackage) {
  return Math.max(
    timestamp(proposalPackage.signedAt),
    timestamp(proposalPackage.changeRequestedAt),
    timestamp(proposalPackage.openedAt),
    timestamp(proposalPackage.sentAt),
    timestamp(proposalPackage.lastActivityAt),
  );
}

function leadUpdatedAt(lead: Lead) {
  return new Date(Math.max(
    timestamp(lead.updatedAt),
    ...((lead.activities ?? []).map((activity) => timestamp(activity.createdAt))),
    ...((lead.notes ?? []).map((note) => timestamp(note.createdAt))),
    ...((lead.mails ?? []).map((mail) => timestamp(mail.createdAt))),
    0,
  ) || Date.now()).toISOString();
}

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function saveMergedState(state: CrmState) {
  const remoteState = await readRemoteState() ?? initialCrmState;
  const deletedTeamMemberKeys = removeLiveMemberKeysFromDeletedKeys(
    Array.from(new Set([...(remoteState.deletedTeamMemberKeys ?? []), ...(state.deletedTeamMemberKeys ?? [])])),
    state.team,
  );
  const deletedCustomerIds = mergeDeletedIds(remoteState.deletedCustomerIds, state.deletedCustomerIds, state.customers);
  const deletedProductIds = mergeDeletedIds(remoteState.deletedProductIds, state.deletedProductIds, state.products);
  const deletedLeadIds = mergeDeletedIds(remoteState.deletedLeadIds, state.deletedLeadIds, state.leads);
  const deletedQuoteIds = mergeDeletedIds(remoteState.deletedQuoteIds, state.deletedQuoteIds, state.quotes);
  const deletedProposalPackageIds = mergeDeletedIds(remoteState.deletedProposalPackageIds, state.deletedProposalPackageIds, state.proposalPackages);
  const deletedInvoiceIds = mergeDeletedIds(remoteState.deletedInvoiceIds, state.deletedInvoiceIds, state.invoices);
  const mergedState = {
    ...state,
    deletedTeamMemberKeys,
    deletedCustomerIds,
    deletedProductIds,
    deletedLeadIds,
    deletedQuoteIds,
    deletedProposalPackageIds,
    deletedInvoiceIds,
    team: mergeByUpdatedAccess(remoteState.team, state.team, deletedTeamMemberKeys),
    leads: mergeLeadsByLatestUpdate(remoteState.leads, state.leads).filter((lead) => !deletedLeadIds.includes(lead.id)),
    products: (state.products.length === 0 && remoteState.products.length > 0 ? remoteState.products : mergeProductsByLatestUpdate(remoteState.products, state.products)).map(withDefaultProductImage).filter((product) => !deletedProductIds.includes(product.id)),
    customers: mergeByLatestUpdate(remoteState.customers, state.customers).filter((customer) => !deletedCustomerIds.includes(customer.id)),
    quotes: (state.quotes.length === 0 && remoteState.quotes.length > 0 ? remoteState.quotes : mergeQuotesByLatestProposalActivity(remoteState.quotes, state.quotes)).filter((quote) => !deletedQuoteIds.includes(quote.id)),
    proposalPackages: (state.proposalPackages.length === 0 && remoteState.proposalPackages.length > 0 ? remoteState.proposalPackages : mergeProposalPackagesByLatestActivity(remoteState.proposalPackages, state.proposalPackages)).filter((proposalPackage) => !deletedProposalPackageIds.includes(proposalPackage.id) && !deletedQuoteIds.includes(proposalPackage.quoteId)),
    invoices: mergeInvoicesWithDeletedIds(remoteState.invoices, state.invoices, deletedInvoiceIds),
  };
  await writeRemoteState(mergedState);
  return mergedState;
}

async function readRemoteState() {
  const snapshot = await getDoc(doc(getFirebaseDb(), ...crmDocumentPath));
  if (!snapshot.exists()) return null;
  return stateFromWorkspaceSnapshot(snapshot.data());
}

async function stateFromWorkspaceSnapshot(data: Record<string, unknown>) {
  if (data.chunked === true) {
    return readChunkedState();
  }
  return normalizeState(data as CrmState);
}

async function readChunkedState() {
  const snapshot = await getDocs(collection(getFirebaseDb(), ...crmChunksPath));
  const chunks = snapshot.docs
    .filter((item) => item.id.startsWith("chunk-"))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => String(item.data().value ?? ""));
  if (!chunks.length) return initialCrmState;
  return normalizeState(JSON.parse(chunks.join("")) as CrmState);
}

async function writeRemoteState(state: CrmState) {
  const serialized = JSON.stringify(state);
  const chunks = serialized.match(new RegExp(`.{1,${stateChunkSize}}`, "g")) ?? [serialized];
  const db = getFirebaseDb();
  const chunksRef = collection(db, ...crmChunksPath);
  const existingChunks = await getDocs(chunksRef);
  const batch = writeBatch(db);

  chunks.forEach((value, index) => {
    batch.set(doc(chunksRef, chunkId(index)), { value });
  });
  existingChunks.docs.forEach((existing) => {
    if (existing.id.startsWith("chunk-") && Number(existing.id.replace("chunk-", "")) >= chunks.length) {
      batch.delete(existing.ref);
    }
  });
  batch.set(doc(db, ...crmDocumentPath), {
    chunked: true,
    chunkCount: chunks.length,
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();
}

function chunkId(index: number) {
  return `chunk-${String(index).padStart(4, "0")}`;
}
