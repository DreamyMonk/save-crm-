"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Lead, LeadSource, ProductCategory } from "@/lib/crm-data";
import { canManageLeads, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

const productCategories: ProductCategory[] = ["Aircon", "Solar", "Inverter", "Heat Pump", "Solar Battery"];

export default function NewLeadPage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const [nextAction, setNextAction] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState(state.pipelines[0]?.id ?? "");
  const selectedPipeline = state.pipelines.find((item) => item.id === selectedPipelineId) ?? state.pipelines[0];
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const canManageAssignments = canManageLeads(currentMember);
  const members = canManageAssignments
    ? state.team.filter((member) => member.active && member.modules.includes("leads"))
    : currentMember && currentMember.modules.includes("leads")
      ? [currentMember]
      : [];
  const adminMember = canManageAssignments ? state.team.find((member) => member.id === "admin") ?? state.team.find((member) => member.role === "Admin") ?? members[0] : currentMember;

  function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pipelineId = String(form.get("pipelineId") || selectedPipeline?.id || state.pipelines[0]?.id || "");
    const targetPipeline = state.pipelines.find((item) => item.id === pipelineId) ?? state.pipelines[0];
    const productCategory = String(form.get("productCategory") || "Solar") as ProductCategory;
    const nextNumber =
      state.leads.reduce((highest, lead) => Math.max(highest, Number(lead.id.replace("L-", "")) || 1000), 1000) + 1;
    const lead: Lead = {
      id: `L-${nextNumber}`,
      title: String(form.get("title") || `${productCategory} lead`),
      company: String(form.get("company") || "New company"),
      contact: String(form.get("contact") || "Primary contact"),
      email: String(form.get("email") || "client@example.com"),
      phone: String(form.get("phone") || "+91 90000 00000"),
      source: String(form.get("leadSource") || "Manual"),
      leadSource: String(form.get("leadSource") || "Manual") as LeadSource,
      salesPhase: "Enquiry",
      pipelineId,
      stageId: targetPipeline?.stages[0]?.id ?? "",
      amount: Number(form.get("amount")) || 0,
      ticketSize: Number(form.get("amount")) || 0,
      productInterest: String(form.get("productInterest") || form.get("title") || productCategory),
      productCategory,
      probability: Number(form.get("probability")) || 25,
      assignedTo: String(form.get("assignedTo") || adminMember?.id || "admin"),
      substituteAssignedTo: String(form.get("substituteAssignedTo") || ""),
      priority: String(form.get("priority") || "Warm") as Lead["priority"],
      nextAction: nextAction || "Follow up",
      callCount: 0,
      activities: [
        {
          id: `A-L-${nextNumber}-1`,
          type: "Note",
          summary: "Lead created in CRM.",
          outcome: "Awaiting allocation follow-up.",
          createdAt: new Date().toISOString(),
          createdBy: "CRM",
        },
      ],
      tasks: [],
      notes: [],
      mails: [],
    };
    setState({ ...state, leads: [lead, ...state.leads] });
    router.push(`/leads/${lead.id}`);
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Leads" title="Create new lead" />
      {!memberReady ? (
        <div className="p-4 text-sm font-semibold text-[#657267] md:p-8">Checking lead access.</div>
      ) : (
      <form onSubmit={createLead} className="m-4 grid max-w-5xl gap-4 rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8 md:grid-cols-2">
        <Input name="title" label="Lead title" required />
        <Input name="company" label="Company" required />
        <Input name="contact" label="Contact person" />
        <Input name="email" label="Email" type="email" />
        <Input name="phone" label="Phone" />
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Lead source</span>
          <select name="leadSource" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            {(["Manual", "Meta Ads", "Google Ads", "Website", "Referral", "Walk-in", "Campaign"] as LeadSource[]).map((source) => <option key={source}>{source}</option>)}
          </select>
        </label>
        <Input name="productInterest" label="Product needed" />
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Product category</span>
          <select name="productCategory" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            {productCategories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <Input name="amount" label="Amount" type="number" />
        <Input name="probability" label="Probability" type="number" defaultValue="25" />
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Pipeline</span>
          <select name="pipelineId" value={selectedPipeline?.id ?? ""} onChange={(event) => setSelectedPipelineId(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            {state.pipelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Assign to</span>
          <select name="assignedTo" defaultValue={adminMember?.id ?? "admin"} disabled={!canManageAssignments} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]">
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Substitute sales person</span>
          <select name="substituteAssignedTo" disabled={!canManageAssignments} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]">
            <option value="">None</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Priority</span>
          <select name="priority" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            <option>Hot</option>
            <option>Warm</option>
            <option>Cold</option>
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-[#657267]">Next action</span>
          <RichTextEditor value={nextAction} onChange={setNextAction} minHeight={170} />
        </label>
        <button className="h-11 rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white md:w-max">Create lead</button>
      </form>
      )}
    </CrmShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input {...props} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}
