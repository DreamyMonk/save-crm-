"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ClipboardList, FileText, Pencil, PhoneCall, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { ButtonLink, CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CommunicationPreferences, CustomField, Lead, LeadActivity, LeadSalesPhase, LeadSource, currency, defaultCommunicationPreferences } from "@/lib/crm-data";
import { htmlToPlainText } from "@/lib/text";
import { canAccessLead, canManageLeads, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, setState } = useCrmStore();
  const [customerStatus, setCustomerStatus] = useState("");
  const [activityType, setActivityType] = useState<LeadActivity["type"]>("Call");
  const [activitySummary, setActivitySummary] = useState("");
  const [activityOutcome, setActivityOutcome] = useState("");
  const lead = state.leads.find((item) => item.id === params.id);
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const canManageAssignments = canManageLeads(currentMember);

  if (!lead) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Lead detail" title="Lead not found" actions={<ButtonLink href="/leads">Back to leads</ButtonLink>} />
      </CrmShell>
    );
  }

  if (!memberReady) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Lead detail" title="Checking lead access" actions={<ButtonLink href="/leads">Back to leads</ButtonLink>} />
      </CrmShell>
    );
  }

  if (memberReady && !canAccessLead(currentMember, lead)) {
    return (
      <CrmShell>
        <PageHeader eyebrow="Lead detail" title="No lead access" actions={<ButtonLink href="/leads">Back to leads</ButtonLink>} />
      </CrmShell>
    );
  }

  const pipeline = state.pipelines.find((item) => item.id === lead.pipelineId);
  const members = canManageAssignments
    ? state.team.filter(isLeadAssignableMember)
    : currentMember && isLeadAssignableMember(currentMember)
      ? [currentMember]
      : [];
  const owner = state.team.find((member) => member.id === lead.assignedTo)?.name ?? "Unassigned";
  const linkedCustomer = state.customers.find((customer) => customer.leadId === lead.id || customer.email.toLowerCase() === lead.email.toLowerCase());
  const linkedQuote = linkedCustomer ? state.quotes.find((quote) => quote.customerId === linkedCustomer.id) : undefined;
  const proposalHref = linkedQuote ? `/quotes/${linkedQuote.id}/proposal` : "/quotes";
  const currentLead = lead;
  const leadId = lead.id;

  function update(field: keyof Lead, value: string | number) {
    updateLead({ [field]: value });
  }

  function updateAssignment(memberId: string, field: "assignedTo" | "substituteAssignedTo") {
    if (!canManageAssignments) return;
    const member = state.team.find((item) => item.id === memberId);
    updateLead({
      [field]: memberId,
      activities: [
        {
          id: `A-${leadId}-${(currentLead.activities ?? []).length + 1}`,
          type: "Note",
          summary: `${field === "assignedTo" ? "Primary" : "Substitute"} sales person set to ${member?.name ?? "None"}.`,
          outcome: "Allocation updated from lead profile.",
          createdAt: new Date().toISOString(),
          createdBy: "Admin",
        },
        ...(currentLead.activities ?? []),
      ],
    });
  }

  function updateLead(updates: Partial<Lead>) {
    const updatedAt = new Date().toISOString();
    setState({
      ...state,
      leads: state.leads.map((item) => (item.id === leadId ? { ...item, ...updates, updatedAt } : item)),
    });
  }

  function updatePreference(field: keyof CommunicationPreferences, value: boolean) {
    updateLead({
      communicationPreferences: {
        ...(currentLead.communicationPreferences ?? defaultCommunicationPreferences()),
        [field]: value,
      },
    });
  }

  function addCustomField() {
    const field: CustomField = { id: `CF-${leadId}-${(currentLead.customFields ?? []).length + 1}`, label: "Custom field", value: "" };
    updateLead({ customFields: [...(currentLead.customFields ?? []), field] });
  }

  function updateCustomField(fieldId: string, updates: Partial<CustomField>) {
    updateLead({
      customFields: (currentLead.customFields ?? []).map((field) => (field.id === fieldId ? { ...field, ...updates } : field)),
    });
  }

  function removeCustomField(fieldId: string) {
    updateLead({ customFields: (currentLead.customFields ?? []).filter((field) => field.id !== fieldId) });
  }

  function addLeadToCustomers() {
    const alreadySaved = state.customers.some((customer) => customer.leadId === currentLead.id || customer.email.toLowerCase() === currentLead.email.toLowerCase());
    if (alreadySaved) {
      setCustomerStatus("Customer already exists in database.");
      return;
    }

    const wantedProduct =
      currentLead.customFields?.find((field) => field.label.toLowerCase().includes("product"))?.value ||
      currentLead.title;
    const updatedAt = new Date().toISOString();

    setState((currentState) => {
      const customerId = nextCustomerId(currentState.customers);
      return {
        ...currentState,
        deletedCustomerIds: (currentState.deletedCustomerIds ?? []).filter((id) => id !== customerId),
        customers: [
          ...currentState.customers,
          {
            id: customerId,
            updatedAt,
            customerType: "Business",
            businessName: currentLead.company,
            contactType: "Primary",
            salesAgent: currentState.team.find((member) => member.id === currentLead.assignedTo)?.name ?? "vinay dhanekula",
            secondSalesAgent: currentState.team.find((member) => member.id === currentLead.substituteAssignedTo)?.name ?? "",
            firstName: currentLead.contact.split(" ")[0] ?? currentLead.contact,
            lastName: currentLead.contact.split(" ").slice(1).join(" "),
            name: currentLead.contact,
            email: currentLead.email,
            phone: currentLead.phone,
            address: currentLead.company,
            wantedProduct,
            leadId: currentLead.id,
          },
        ],
        leads: currentState.leads.map((item) =>
          item.id === currentLead.id
            ? {
                ...item,
                updatedAt,
                notes: [
                  ...item.notes,
                  {
                    id: `N-${leadId}-${item.notes.length + 1}`,
                    body: "Added to customer database.",
                    createdAt: "Now",
                  },
                ],
              }
            : item,
        ),
      };
    });
    setCustomerStatus("Added to customer database.");
  }

  function addActivity() {
    if (!activitySummary.trim()) return;
    const createdAt = new Date().toISOString();
    const activity: LeadActivity = {
      id: `A-${leadId}-${(currentLead.activities ?? []).length + 1}`,
      type: activityType,
      summary: activitySummary,
      outcome: activityOutcome || "Progress updated.",
      createdAt,
      createdBy: owner,
    };
    const isCall = activityType === "Call";
    updateLead({
      activities: [activity, ...(currentLead.activities ?? [])],
      callCount: (currentLead.callCount ?? 0) + (isCall ? 1 : 0),
      lastContactedAt: createdAt,
      notes: [
        {
          id: `N-${leadId}-${currentLead.notes.length + 1}`,
          body: `${activity.type}: ${activity.summary} - ${activity.outcome}`,
          createdAt,
        },
        ...currentLead.notes,
      ],
    });
    setActivitySummary("");
    setActivityOutcome("");
  }

  return (
    <CrmShell>
      <PageHeader
        eyebrow={lead.id}
        title={lead.title}
        actions={
          <>
            <ButtonLink href={`/calendar/new?lead=${lead.id}`} variant="light"><CalendarDays size={16} /> Schedule</ButtonLink>
            <ButtonLink href={proposalHref} variant="light"><FileText size={16} /> V2 Proposal</ButtonLink>
            <button onClick={addLeadToCustomers} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#d7dfd0] bg-white px-4 text-sm font-semibold text-[#0f172a] shadow-sm">
              <UserPlus size={16} /> Add customer
            </button>
            <ButtonLink href={`/leads/${lead.id}/tasks`} variant="light"><ClipboardList size={16} /> Tasks/notes</ButtonLink>
          </>
        }
      />
      <div className="grid gap-6 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
          <div className="border-b border-[#edf2e9] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#657267]">{lead.company} · {lead.contact}</p>
                <p className="mt-2 text-2xl font-semibold">{currency(lead.amount)}</p>
              </div>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7dfd0] px-3 text-sm font-semibold">
                <Pencil size={16} /> Edit mode
              </button>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Lead title" value={lead.title} onChange={(value) => update("title", value)} />
            <Field label="Company" value={lead.company} onChange={(value) => update("company", value)} />
            <Field label="Contact" value={lead.contact} onChange={(value) => update("contact", value)} />
            <Field label="Email" value={lead.email} onChange={(value) => update("email", value)} />
            <Field label="Phone" value={lead.phone} onChange={(value) => update("phone", value)} />
            <Field label="Source" value={lead.source} onChange={(value) => update("source", value)} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Lead source</span>
              <select value={lead.leadSource ?? lead.source} onChange={(event) => updateLead({ leadSource: event.target.value as LeadSource, source: event.target.value })} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {(["Manual", "Meta Ads", "Google Ads", "Website", "Referral", "Walk-in", "Campaign"] as LeadSource[]).map((source) => <option key={source}>{source}</option>)}
              </select>
            </label>
            <Field label="Amount" value={lead.amount} type="number" onChange={(value) => update("amount", Number(value))} />
            <Field label="Ticket size" value={lead.ticketSize ?? lead.amount} type="number" onChange={(value) => update("ticketSize", Number(value))} />
            <Field label="Product needed" value={lead.productInterest ?? lead.title} onChange={(value) => update("productInterest", value)} />
            <Field label="Probability" value={lead.probability} type="number" onChange={(value) => update("probability", Number(value))} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Sales phase</span>
              <select value={lead.salesPhase ?? "Enquiry"} onChange={(event) => updateLead({ salesPhase: event.target.value as LeadSalesPhase })} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {(["Enquiry", "First call", "Business pitch", "Proposal pending", "Proposal sent", "Signed won", "Lost"] as LeadSalesPhase[]).map((phase) => <option key={phase}>{phase}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Stage</span>
              <select value={lead.stageId} onChange={(event) => update("stageId", event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {pipeline?.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Assigned to</span>
              <select value={lead.assignedTo} disabled={!canManageAssignments} onChange={(event) => updateAssignment(event.target.value, "assignedTo")} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]">
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Substitute sales person</span>
              <select value={lead.substituteAssignedTo ?? ""} disabled={!canManageAssignments} onChange={(event) => updateAssignment(event.target.value, "substituteAssignedTo")} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]">
                <option value="">None</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-[#657267]">Next action</span>
              <RichTextEditor value={lead.nextAction} onChange={(value) => update("nextAction", value)} minHeight={170} />
            </label>
            <div className="inline-flex h-10 w-max items-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} /> Auto-saved in browser
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Lead owner" lines={[owner, pipeline?.name ?? "No pipeline", lead.priority, `Calls: ${lead.callCount ?? 0}`]} />
          {customerStatus ? <Panel title="Customer database" lines={[customerStatus]} /> : null}
          <section className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <PhoneCall size={17} />
              <h2 className="font-semibold">Agent activity</h2>
            </div>
            <div className="mt-3 grid gap-2">
              <select value={activityType} onChange={(event) => setActivityType(event.target.value as LeadActivity["type"])} className="h-10 rounded-lg border border-[#d7dfd0] px-3 text-sm outline-none">
                {(["Call", "Follow-up", "Meeting", "Pitch", "Proposal", "Note"] as LeadActivity["type"][]).map((type) => <option key={type}>{type}</option>)}
              </select>
              <input value={activitySummary} onChange={(event) => setActivitySummary(event.target.value)} placeholder="What happened?" className="h-10 rounded-lg border border-[#d7dfd0] px-3 text-sm outline-none" />
              <input value={activityOutcome} onChange={(event) => setActivityOutcome(event.target.value)} placeholder="Outcome / next progress" className="h-10 rounded-lg border border-[#d7dfd0] px-3 text-sm outline-none" />
              <button onClick={addActivity} className="h-10 rounded-lg bg-[#003CBB] px-3 text-sm font-semibold text-white">Add activity</button>
            </div>
            <div className="mt-4 space-y-3">
              {(lead.activities ?? []).slice(0, 8).map((activity) => (
                <div key={activity.id} className="rounded-lg border border-[#edf2e9] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{activity.type}</p>
                    <span className="text-xs text-[#657267]">{formatActivityDate(activity.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[#0f172a]">{activity.summary}</p>
                  <p className="mt-1 text-xs text-[#657267]">{activity.outcome}</p>
                </div>
              ))}
            </div>
          </section>
          <CommunicationPanel
            preferences={lead.communicationPreferences ?? defaultCommunicationPreferences()}
            updatePreference={updatePreference}
          />
          <section className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Custom fields</h2>
              <button onClick={addCustomField} className="grid size-8 place-items-center rounded-lg bg-[#003CBB]" title="Add custom field">
                <Plus size={15} />
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {(lead.customFields ?? []).map((field) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                  <input value={field.label} onChange={(event) => updateCustomField(field.id, { label: event.target.value })} className="h-9 rounded-lg border border-[#d7dfd0] px-2 text-sm outline-none" />
                  <input value={field.value} onChange={(event) => updateCustomField(field.id, { value: event.target.value })} className="h-9 rounded-lg border border-[#d7dfd0] px-2 text-sm outline-none" />
                  <button onClick={() => removeCustomField(field.id)} className="grid size-9 place-items-center rounded-lg border border-[#d7dfd0]" title="Remove field">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <Panel title="Open tasks" lines={lead.tasks.filter((task) => task.status === "Open").map((task) => `${task.title} · ${task.due}`)} />
          <Link href="/leads" className="block rounded-lg border border-[#d7dfd0] bg-white p-4 text-sm font-semibold">Back to Kanban</Link>
        </aside>
      </div>
    </CrmShell>
  );
}

function isLeadAssignableMember(member: { active: boolean; name: string; role: string; modules: string[] }) {
  const role = member.role.toLowerCase();
  const name = member.name.trim().toLowerCase().replace(/\s+/g, " ");
  if (name === "aarav admin" || name === "arav admin") return false;
  return member.active && (role.includes("sales") || role.includes("lead") || role.includes("admin") || member.modules.includes("leads") || member.modules.includes("dashboard"));
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function nextCustomerId(customers: { id: string }[]) {
  const highest = customers.reduce((currentHighest, customer) => {
    const match = /^C-(\d+)$/.exec(customer.id);
    if (!match) return currentHighest;
    return Math.max(currentHighest, Number(match[1]));
  }, 1000);
  return `C-${highest + 1}`;
}

function Field({ label, value, type = "text", onChange }: { label: string; value: string | number; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}

function CommunicationPanel({
  preferences,
  updatePreference,
}: {
  preferences: CommunicationPreferences;
  updatePreference: (field: keyof CommunicationPreferences, value: boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-[#dce3d5] bg-white shadow-sm">
      <label className="flex items-center justify-between border-b border-[#edf2e9] p-4 text-sm font-medium">
        <span>DND All Channels</span>
        <input type="checkbox" checked={preferences.dndAllChannels} onChange={(event) => updatePreference("dndAllChannels", event.target.checked)} />
      </label>
      <div className="px-4 py-3 text-center text-xs font-semibold text-[#003CBB]">OR</div>
      <div className="space-y-3 border-t border-[#edf2e9] p-4 text-sm">
        <Channel label="Email" checked={preferences.email} onChange={(value) => updatePreference("email", value)} />
        <Channel label="Text Messages" checked={preferences.textMessages} onChange={(value) => updatePreference("textMessages", value)} />
        <Channel label="Calls & voicemail" checked={preferences.callsAndVoicemail} onChange={(value) => updatePreference("callsAndVoicemail", value)} />
        <Channel label="Inbound Calls and SMS" checked={preferences.inboundCallsAndSms} onChange={(value) => updatePreference("inboundCallsAndSms", value)} />
      </div>
    </section>
  );
}

function Channel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Panel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-[#dce3d5] bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-[#4f5e55]">
        {lines.length ? lines.map((line) => <p key={line}>{htmlToPlainText(line)}</p>) : <p>No records yet.</p>}
      </div>
    </div>
  );
}
