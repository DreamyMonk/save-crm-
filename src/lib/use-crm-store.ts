"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { CrmState, Lead, LeadSalesPhase, LeadSource, ModuleKey, ProposalPackage, QuoteRecord, initialCrmState } from "./crm-data";
import { getFirebaseDb } from "./firebase";

const storageKey = "saveplanet-crm-state-v2";
const crmDocumentPath = ["crmWorkspaces", "default"] as const;

type SyncState = "loading" | "firebase" | "local" | "saving";

function normalizeState(state: CrmState): CrmState {
  const legacyEmailKey = "mail" + "jet";
  const legacyEmailSettings = (state.settings as unknown as Record<string, CrmState["settings"]["resend"] | undefined> | undefined)?.[legacyEmailKey];
  const normalizedTeam = ensureHardcodedAdmin(
    (state.team ?? initialCrmState.team).map((member) => ({
      ...member,
      modules: normalizeMemberModules(member.modules),
    })),
  );
  const deletedTeamMemberKeys = Array.from(new Set(state.deletedTeamMemberKeys ?? []));
  return {
    ...initialCrmState,
    ...state,
    pipelines: normalizePipelines(state.pipelines ?? initialCrmState.pipelines),
    team: normalizedTeam.filter((member) => isProtectedAdmin(member) || !deletedTeamMemberKeys.includes(accessMemberKey(member))),
    deletedTeamMemberKeys,
    leads: (state.leads ?? initialCrmState.leads).map((lead) => ({
      ...lead,
      leadSource: normalizeLeadSource(lead.leadSource ?? lead.source),
      salesPhase: normalizeSalesPhase(lead.salesPhase, lead.stageId),
      ticketSize: lead.ticketSize ?? lead.amount,
      productInterest: lead.productInterest ?? lead.customFields?.find((field) => field.label.toLowerCase().includes("product"))?.value ?? lead.title,
      substituteAssignedTo: lead.substituteAssignedTo ?? "",
      callCount: lead.callCount ?? lead.activities?.filter((activity) => activity.type === "Call").length ?? 0,
      lastContactedAt: lead.lastContactedAt ?? lead.activities?.[0]?.createdAt,
      activities: lead.activities ?? [],
      customFields: lead.customFields ?? [],
      proposal: lead.proposal,
      communicationPreferences: lead.communicationPreferences ?? {
        dndAllChannels: true,
        email: false,
        textMessages: false,
        callsAndVoicemail: false,
        inboundCallsAndSms: false,
      },
    })),
    customers: (state.customers ?? initialCrmState.customers).map((customer) => ({
      ...customer,
      customerType: customer.customerType ?? "Business",
      businessName: customer.businessName ?? customer.address ?? "",
      contactType: customer.contactType ?? "Primary",
      salesAgent: customer.salesAgent ?? "Aarav Admin",
    })),
    products: mergeById(state.products ?? [], initialCrmState.products),
    quotes: state.quotes ?? initialCrmState.quotes,
    proposalPackages: normalizeProposalPackages(state),
    invoices: state.invoices ?? initialCrmState.invoices,
    appointments: state.appointments ?? initialCrmState.appointments,
    settings: {
      ...initialCrmState.settings,
      ...(state.settings ?? {}),
      loginImageUrl: state.settings?.loginImageUrl ?? initialCrmState.settings.loginImageUrl,
      logoUrl: state.settings?.logoUrl ?? initialCrmState.settings.logoUrl,
      resend: {
        ...initialCrmState.settings.resend,
        ...(state.settings?.resend ?? legacyEmailSettings ?? {}),
        fromEmail: "noreply@saveplanet.au",
        enabled: true,
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
  const quotes = state.quotes ?? initialCrmState.quotes;
  const existingPackages = state.proposalPackages ?? [];
  const packageByQuote = new Map(existingPackages.map((proposalPackage) => [proposalPackage.quoteId, proposalPackage]));
  return quotes.map((quote) => packageFromQuote(quote, packageByQuote.get(quote.id), state));
}

function packageFromQuote(quote: QuoteRecord, existingPackage: ProposalPackage | undefined, state: CrmState): ProposalPackage {
  const customer = (state.customers ?? initialCrmState.customers).find((item) => item.id === quote.customerId);
  const status = quote.customerSignedAt
    ? "Signed"
    : quote.proposalChangeRequestHtml
      ? "Changes requested"
      : quote.proposalOpenedAt
        ? "Opened"
        : quote.proposalSentAt
          ? "Sent"
          : "Draft";

  return {
    id: existingPackage?.id ?? `PP-${quote.id}`,
    quoteId: quote.id,
    invoiceId: existingPackage?.invoiceId,
    customerId: quote.customerId,
    leadId: customer?.leadId,
    productCategory: quote.productCategory,
    templateType: templateTypeForCategory(quote.productCategory),
    publicToken: existingPackage?.publicToken ?? quote.id,
    status,
    assignedAgent: customer?.salesAgent || existingPackage?.assignedAgent || "Aarav Admin",
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

function templateTypeForCategory(category: QuoteRecord["productCategory"]): ProposalPackage["templateType"] {
  if (category === "Aircon") return "aircon";
  if (category === "Heat Pump") return "heatpump";
  return "solar";
}

function normalizeMemberModules(modules: CrmState["team"][number]["modules"]) {
  const validModules = new Set(Object.keys(initialCrmStateModuleLabels()) as ModuleKey[]);
  return Array.from(new Set((modules ?? []).filter((module): module is ModuleKey => validModules.has(module))));
}

function ensureHardcodedAdmin(team: CrmState["team"]) {
  const adminModules = Object.keys(initialCrmStateModuleLabels()) as ModuleKey[];
  const existingIndex = team.findIndex((member) => member.uid === "hardcoded-admin" || member.email?.trim().toLowerCase() === "admin@admin.com");
  const hardcodedAdmin = {
    id: existingIndex >= 0 ? team[existingIndex].id : "admin",
    uid: "hardcoded-admin",
    email: "admin@admin.com",
    name: existingIndex >= 0 ? team[existingIndex].name : "Aarav Admin",
    role: "Admin",
    modules: adminModules,
    active: true,
    accessUpdatedAt: existingIndex >= 0 ? team[existingIndex].accessUpdatedAt : new Date().toISOString(),
  };
  if (existingIndex < 0) return [hardcodedAdmin, ...team];
  return team.map((member, index) => (index === existingIndex ? { ...member, ...hardcodedAdmin } : member));
}

export function useCrmStore() {
  const [state, setBaseState] = useState<CrmState>(() => {
    if (typeof window === "undefined") {
      return initialCrmState;
    }
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      return initialCrmState;
    }
    try {
      return normalizeState(JSON.parse(saved) as CrmState);
    } catch {
      return initialCrmState;
    }
  });
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSavedState = useRef<string>("");
  const stateRef = useRef(state);

  const setState: Dispatch<SetStateAction<CrmState>> = useCallback((value) => {
    setBaseState((currentState) => {
      const nextState = typeof value === "function" ? (value as (previousState: CrmState) => CrmState)(currentState) : value;
      stateRef.current = nextState;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(nextState));
      }
      return nextState;
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;

    async function loadRemoteState() {
      try {
        const snapshot = await getDoc(doc(getFirebaseDb(), ...crmDocumentPath));
        if (!active) return;
        const localState = mergeLocalCollections(normalizeState(stateRef.current), readLocalState());
        if (snapshot.exists()) {
          const savedRemoteState = normalizeState(snapshot.data() as CrmState);
          const remoteState = mergeLocalCollections(savedRemoteState, localState);
          if (JSON.stringify(remoteState) !== JSON.stringify(savedRemoteState)) {
            await setDoc(doc(getFirebaseDb(), ...crmDocumentPath), remoteState);
          }
          lastSavedState.current = JSON.stringify(remoteState);
          setBaseState(remoteState);
          stateRef.current = remoteState;
        } else {
          const nextState = localState;
          await setDoc(doc(getFirebaseDb(), ...crmDocumentPath), nextState);
          lastSavedState.current = JSON.stringify(nextState);
          setBaseState(nextState);
          stateRef.current = nextState;
        }
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
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serializedState = JSON.stringify(state);
    window.localStorage.setItem(storageKey, serializedState);

    if (syncState !== "firebase") return;
    if (serializedState === lastSavedState.current) return;
    const timeout = window.setTimeout(() => {
      setSyncState("saving");
      saveMergedState(state)
        .then((savedState) => {
          lastSavedState.current = JSON.stringify(savedState);
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

function readLocalState() {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    return normalizeState(JSON.parse(saved) as CrmState);
  } catch {
    return null;
  }
}

function mergeLocalCollections(remoteState: CrmState, localState: CrmState | null) {
  if (!localState) return remoteState;
  const deletedTeamMemberKeys = mergeDeletedTeamMemberKeys(remoteState, localState);
  return {
    ...remoteState,
    deletedTeamMemberKeys,
    team: mergeByUpdatedAccess(remoteState.team, localState.team, deletedTeamMemberKeys),
    products: mergeById(remoteState.products, localState.products),
    customers: mergeByLatestUpdate(remoteState.customers, localState.customers),
    quotes: mergeById(remoteState.quotes, localState.quotes),
    proposalPackages: mergeById(remoteState.proposalPackages, localState.proposalPackages),
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
    const key = accessMemberKey(member);
    if (deletedKeys.has(key) && !isProtectedAdmin(member)) continue;
    const existing = mergedByKey.get(key);
    if (!existing || timestamp(member.accessUpdatedAt) >= timestamp(existing.accessUpdatedAt)) {
      mergedByKey.set(key, member);
    }
  }
  return ensureHardcodedAdmin(Array.from(mergedByKey.values()));
}

function accessMemberKey(member: CrmState["team"][number]) {
  return member.uid || member.email?.trim().toLowerCase() || member.id;
}

function mergeDeletedTeamMemberKeys(remoteState: CrmState, localState: CrmState) {
  const protectedKeys = new Set([...remoteState.team, ...localState.team].filter(isProtectedAdmin).map(accessMemberKey));
  return Array.from(new Set([...(remoteState.deletedTeamMemberKeys ?? []), ...(localState.deletedTeamMemberKeys ?? [])])).filter((key) => !protectedKeys.has(key));
}

function isProtectedAdmin(member: CrmState["team"][number]) {
  return member.uid === "hardcoded-admin" || member.email?.trim().toLowerCase() === "admin@admin.com";
}

function mergeById<T extends { id: string }>(remoteItems: T[], localItems: T[]) {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  return [...remoteItems, ...localItems.filter((item) => !remoteIds.has(item.id))];
}

function mergeByLatestUpdate<T extends { id: string; updatedAt?: string }>(remoteItems: T[], localItems: T[]) {
  const items = new Map<string, T>();
  for (const item of remoteItems) {
    items.set(item.id, item);
  }
  for (const localItem of localItems) {
    const remoteItem = items.get(localItem.id);
    if (!remoteItem || timestamp(localItem.updatedAt) >= timestamp(remoteItem.updatedAt)) {
      items.set(localItem.id, localItem);
    }
  }
  return Array.from(items.values());
}

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function saveMergedState(state: CrmState) {
  const ref = doc(getFirebaseDb(), ...crmDocumentPath);
  const snapshot = await getDoc(ref);
  const remoteState = snapshot.exists() ? normalizeState(snapshot.data() as CrmState) : initialCrmState;
  const mergedState = {
    ...state,
    deletedTeamMemberKeys: Array.from(new Set([...(remoteState.deletedTeamMemberKeys ?? []), ...(state.deletedTeamMemberKeys ?? [])])),
    team: mergeByUpdatedAccess(remoteState.team, state.team, Array.from(new Set([...(remoteState.deletedTeamMemberKeys ?? []), ...(state.deletedTeamMemberKeys ?? [])]))),
    products: state.products.length === 0 && remoteState.products.length > 0 ? remoteState.products : state.products,
    customers: mergeByLatestUpdate(remoteState.customers, state.customers),
    quotes: state.quotes.length === 0 && remoteState.quotes.length > 0 ? remoteState.quotes : state.quotes,
    proposalPackages: state.proposalPackages.length === 0 && remoteState.proposalPackages.length > 0 ? remoteState.proposalPackages : state.proposalPackages,
  };
  await setDoc(ref, mergedState);
  return mergedState;
}
