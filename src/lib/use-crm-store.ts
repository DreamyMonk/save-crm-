"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { CrmState, ModuleKey, initialCrmState } from "./crm-data";
import { getFirebaseDb } from "./firebase";

const storageKey = "saveplanet-crm-state-v2";
const crmDocumentPath = ["crmWorkspaces", "default"] as const;

type SyncState = "loading" | "firebase" | "local" | "saving";

function normalizeState(state: CrmState): CrmState {
  const legacyEmailKey = "mail" + "jet";
  const legacyEmailSettings = (state.settings as unknown as Record<string, CrmState["settings"]["resend"] | undefined> | undefined)?.[legacyEmailKey];
  return {
    ...initialCrmState,
    ...state,
    team: (state.team ?? initialCrmState.team).map((member) => ({
      ...member,
      modules: normalizeMemberModules(member.modules, member.role),
    })),
    leads: (state.leads ?? initialCrmState.leads).map((lead) => ({
      ...lead,
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
      },
      twilio: {
        ...initialCrmState.settings.twilio,
        ...(state.settings?.twilio ?? {}),
      },
    },
  };
}

function normalizeMemberModules(modules: CrmState["team"][number]["modules"], role: string) {
  if (role !== "Admin") {
    return modules;
  }
  const adminModules: ModuleKey[] = ["customers", "products", "quotes"];
  return adminModules.reduce((currentModules, module) => (currentModules.includes(module) ? currentModules : [...currentModules, module]), modules);
}

export function useCrmStore() {
  const [state, setState] = useState<CrmState>(() => {
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

  useEffect(() => {
    let active = true;

    async function loadRemoteState() {
      try {
        const snapshot = await getDoc(doc(getFirebaseDb(), ...crmDocumentPath));
        if (!active) return;
        const localState = readLocalState();
        if (snapshot.exists()) {
          const remoteState = mergeLocalCollections(normalizeState(snapshot.data() as CrmState), localState);
          lastSavedState.current = JSON.stringify(remoteState);
          setState(remoteState);
        } else {
          const nextState = localState ?? initialCrmState;
          await setDoc(doc(getFirebaseDb(), ...crmDocumentPath), nextState);
          lastSavedState.current = JSON.stringify(nextState);
          setState(nextState);
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
  return {
    ...remoteState,
    products: mergeById(remoteState.products, localState.products),
    customers: mergeById(remoteState.customers, localState.customers),
    quotes: mergeById(remoteState.quotes, localState.quotes),
  };
}

function mergeById<T extends { id: string }>(remoteItems: T[], localItems: T[]) {
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  return [...remoteItems, ...localItems.filter((item) => !remoteIds.has(item.id))];
}

async function saveMergedState(state: CrmState) {
  const ref = doc(getFirebaseDb(), ...crmDocumentPath);
  const snapshot = await getDoc(ref);
  const remoteState = snapshot.exists() ? normalizeState(snapshot.data() as CrmState) : initialCrmState;
  const mergedState = {
    ...state,
    products: state.products.length === 0 && remoteState.products.length > 0 ? remoteState.products : state.products,
    quotes: state.quotes.length === 0 && remoteState.quotes.length > 0 ? remoteState.quotes : state.quotes,
  };
  await setDoc(ref, mergedState);
  return mergedState;
}
