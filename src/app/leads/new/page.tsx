"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Lead } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

export default function NewLeadPage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const [nextAction, setNextAction] = useState("");
  const pipeline = state.pipelines[0];
  const members = state.team.filter((member) => member.active && member.modules.includes("leads"));
  const adminMember = state.team.find((member) => member.id === "admin") ?? state.team.find((member) => member.role === "Admin") ?? members[0];

  function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextNumber =
      state.leads.reduce((highest, lead) => Math.max(highest, Number(lead.id.replace("L-", "")) || 1000), 1000) + 1;
    const lead: Lead = {
      id: `L-${nextNumber}`,
      title: String(form.get("title") || "New lead"),
      company: String(form.get("company") || "New company"),
      contact: String(form.get("contact") || "Primary contact"),
      email: String(form.get("email") || "client@example.com"),
      phone: String(form.get("phone") || "+91 90000 00000"),
      source: String(form.get("source") || "Manual"),
      pipelineId: String(form.get("pipelineId") || pipeline.id),
      stageId: String(form.get("stageId") || pipeline.stages[0].id),
      amount: Number(form.get("amount")) || 0,
      probability: Number(form.get("probability")) || 25,
      assignedTo: adminMember?.id ?? "admin",
      priority: String(form.get("priority") || "Warm") as Lead["priority"],
      nextAction: nextAction || "Follow up",
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
      <form onSubmit={createLead} className="m-4 grid max-w-5xl gap-4 rounded-lg border border-[#dce3d5] bg-white p-5 shadow-sm md:m-8 md:grid-cols-2">
        <Input name="title" label="Lead title" required />
        <Input name="company" label="Company" required />
        <Input name="contact" label="Contact person" />
        <Input name="email" label="Email" type="email" />
        <Input name="phone" label="Phone" />
        <Input name="source" label="Source" />
        <Input name="amount" label="Amount" type="number" />
        <Input name="probability" label="Probability" type="number" defaultValue="25" />
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Pipeline</span>
          <select name="pipelineId" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            {state.pipelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Stage</span>
          <select name="stageId" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
            {pipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#657267]">Assign to</span>
          <input value={adminMember?.name ?? "Admin"} readOnly className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-[#f6f8fc] px-3 outline-none" />
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
