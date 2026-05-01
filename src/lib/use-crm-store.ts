"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { CrmState, ModuleKey, initialCrmState } from "./crm-data";
import { getFirebaseDb } from "./firebase";

const storageKey = "saveplanet-crm-state-v2";
const crmDocumentPath = ["crmWorkspaces", "default"] as const;

type SyncState = "loading" | "firebase" | "local" | "saving";

function normalizeState(state: CrmState): CrmState {
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
    products: state.products ?? initialCrmState.products,
    quotes: state.quotes ?? initialCrmState.quotes,
    invoices: state.invoices ?? initialCrmState.invoices,
    appointments: state.appointments ?? initialCrmState.appointments,
    settings: {
      ...initialCrmState.settings,
      ...(state.settings ?? {}),
      loginImageUrl: state.settings?.loginImageUrl ?? initialCrmState.settings.loginImageUrl,
      logoUrl: state.settings?.logoUrl ?? initialCrmState.settings.logoUrl,
      mailjet: {
        ...initialCrmState.settings.mailjet,
        ...(state.settings?.mailjet ?? {}),
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
        if (snapshot.exists()) {
          const remoteState = normalizeState(snapshot.data() as CrmState);
          lastSavedState.current = JSON.stringify(remoteState);
          setState(remoteState);
        } else {
          await setDoc(doc(getFirebaseDb(), ...crmDocumentPath), initialCrmState);
          lastSavedState.current = JSON.stringify(initialCrmState);
          setState(initialCrmState);
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
      setDoc(doc(getFirebaseDb(), ...crmDocumentPath), state)
        .then(() => {
          lastSavedState.current = serializedState;
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
