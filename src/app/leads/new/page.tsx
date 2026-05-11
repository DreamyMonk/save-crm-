"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Save, UserPlus } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Customer, Lead, LeadSource, ProductCategory } from "@/lib/crm-data";
import { canManageLeads, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

const productCategories: ProductCategory[] = ["Aircon", "Solar", "Inverter", "Heat Pump", "Solar Battery"];
const leadSources: LeadSource[] = ["Manual", "Meta Ads", "Google Ads", "Website", "Referral", "Walk-in", "Campaign"];

export default function NewLeadPage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const [nextAction, setNextAction] = useState("");
  const [newCustomerType, setNewCustomerType] = useState<Customer["customerType"]>("Business");
  const [selectedPipelineId, setSelectedPipelineId] = useState(state.pipelines[0]?.id ?? "");
  const selectedPipeline = state.pipelines.find((item) => item.id === selectedPipelineId) ?? state.pipelines[0];
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const canManageAssignments = canManageLeads(currentMember);
  const members = useMemo(() => {
    if (canManageAssignments) return state.team.filter((member) => member.active && member.modules.includes("leads"));
    return currentMember && currentMember.modules.includes("leads") ? [currentMember] : [];
  }, [canManageAssignments, currentMember, state.team]);
  const defaultAssignee = canManageAssignments ? state.team.find((member) => member.id === "admin") ?? state.team.find((member) => member.role === "Admin") ?? members[0] : currentMember;

  function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pipelineId = String(form.get("pipelineId") || selectedPipeline?.id || state.pipelines[0]?.id || "");
    const targetPipeline = state.pipelines.find((item) => item.id === pipelineId) ?? state.pipelines[0];
    const productCategory = String(form.get("productCategory") || "Solar") as ProductCategory;
    const assignedTo = String(form.get("assignedTo") || defaultAssignee?.id || "admin");
    const substituteAssignedTo = String(form.get("substituteAssignedTo") || "");
    const assignedMember = state.team.find((member) => member.id === assignedTo);
    const substituteMember = state.team.find((member) => member.id === substituteAssignedTo);
    const leadId = nextLeadId(state.leads);
    const customerId = nextCustomerId(state.customers);
    const customer = {
      ...customerFromForm(form, customerId, assignedMember?.name, substituteMember?.name),
      leadId,
      updatedAt: new Date().toISOString(),
    };
    const customerName = customer.name || customer.businessName || "Primary contact";
    const companyName = customer.businessName || customer.name || "New customer";
    const productInterest = customer.wantedProduct || String(form.get("productInterest") || productCategory);
    const leadTitle = String(form.get("title") || `${productCategory} lead - ${companyName}`);
    const amount = Number(form.get("amount")) || 0;
    const createdAt = new Date().toISOString();
    const lead: Lead = {
      id: leadId,
      title: leadTitle,
      company: companyName,
      contact: customerName,
      email: customer.email || "client@example.com",
      phone: customer.phone || customer.mobile || "+91 90000 00000",
      source: String(form.get("leadSource") || "Manual"),
      leadSource: String(form.get("leadSource") || "Manual") as LeadSource,
      salesPhase: "Enquiry",
      pipelineId,
      stageId: targetPipeline?.stages[0]?.id ?? "",
      amount,
      ticketSize: amount,
      productInterest,
      productCategory,
      probability: Number(form.get("probability")) || 25,
      assignedTo,
      substituteAssignedTo,
      priority: String(form.get("priority") || "Warm") as Lead["priority"],
      nextAction: nextAction || "Follow up",
      callCount: 0,
      activities: [
        {
          id: `A-${leadId}-1`,
          type: "Note",
          summary: "Lead and customer created together.",
          outcome: "Added to the first Kanban stage for the selected pipeline.",
          createdAt,
          createdBy: currentMember?.name ?? "CRM",
        },
      ],
      tasks: [],
      notes: [],
      mails: [],
    };

    setState((currentState) => ({
      ...currentState,
      deletedCustomerIds: (currentState.deletedCustomerIds ?? []).filter((id) => id !== customer.id),
      customers: [customer, ...currentState.customers],
      leads: [lead, ...currentState.leads],
    }));
    router.push(`/leads/${lead.id}`);
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Leads" title="Add lead" />
      {!memberReady ? (
        <div className="p-4 text-sm font-semibold text-[#657267] md:p-8">Checking lead access.</div>
      ) : (
        <form onSubmit={createLead} className="m-4 scroll-mt-24 rounded-lg border border-[#d9e2f2] bg-white shadow-sm md:m-8">
          <div className="flex items-center gap-2 border-b border-[#e5edf7] p-4">
            <UserPlus size={18} />
            <h2 className="font-semibold">Lead and customer details</h2>
          </div>

          <FormSection title="Lead and Kanban">
            <Input name="title" label="Lead title" />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Product category</span>
              <select name="productCategory" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {productCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <Input name="productInterest" label="Product needed" list="product-options" />
            <Input name="amount" label="Amount" type="number" />
            <Input name="probability" label="Probability" type="number" defaultValue="25" />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Lead source</span>
              <select name="leadSource" className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {leadSources.map((source) => <option key={source}>{source}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Pipeline</span>
              <select name="pipelineId" value={selectedPipeline?.id ?? ""} onChange={(event) => setSelectedPipelineId(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
                {state.pipelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Assigned sales agent</span>
              <select name="assignedTo" defaultValue={defaultAssignee?.id ?? "admin"} disabled={!canManageAssignments} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none disabled:bg-[#f4f6f2]">
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Second sales agent</span>
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
          </FormSection>

          <FormSection title="Customer Details and Installation Address">
            <Select name="customerType" label="Type" options={["Business", "Residential", "Parent"]} value={newCustomerType} onChange={(value) => setNewCustomerType(value as Customer["customerType"])} />
            {newCustomerType === "Parent" ? <Input name="parent" label="Parent / Group Name" /> : null}
            {newCustomerType !== "Residential" ? <Input name="businessName" label="Business Name" placeholder="Enter business name" /> : null}
            <Input name="description" label="Description" />
            <Input name="buildingName" label="Building / Village / Park Name" />
            <Input name="unitType" label="Unit Type" />
            <Input name="unitNumber" label="Unit Number" />
            <Input name="levelType" label="Level Type" />
            <Input name="levelNumber" label="Level Number" />
            <Input name="streetNumber" label="Street Number" />
            <Input name="streetName" label="Street Name" />
            <Input name="streetType" label="Street Type" />
            <Input name="streetSuffix" label="Street Suffix" />
            <Input name="suburb" label="Suburb" />
            <Input name="stateName" label="State" />
            <Input name="postcode" label="Postcode" />
          </FormSection>

          <FormSection title="Contacts">
            <Select name="contactType" label="Type" options={["Primary", "Billing", "Site", "Decision maker"]} />
            <Input name="firstName" label="First Name" />
            <Input name="lastName" label="Last Name" />
            <Input name="position" label="Position" />
            <Input name="email" label="E-mail" type="email" />
            <Input name="phone" label="Phone Number" />
            <Input name="mobile" label="Mobile Number" />
          </FormSection>

          <FormSection title="Sales Info and Status">
            <Select name="rating" label="Rating" options={["Not Rated", "1", "2", "3", "4", "5"]} />
            <Input name="salesSource" label="Sales Source" />
            <Input name="leadGenerator" label="Lead Generator" />
            <Input name="agent" label="Agent" />
          </FormSection>

          <FormSection title="Additional Information">
            {newCustomerType !== "Residential" ? (
              <>
                <Input name="abn" label="ABN" />
                <Input name="industryType" label="Industry Type" />
                <Input name="paymentTermsValue" label="Payment Terms" />
                <Select name="paymentTermsUnit" label="Payment Unit" options={["days", "weeks", "months"]} />
                <Input name="creditLimit" label="Credit Limit" />
              </>
            ) : (
              <>
                <input type="hidden" name="paymentTermsUnit" value="days" />
                <Input name="paymentTermsValue" label="Payment Terms" placeholder="Optional" />
              </>
            )}
            <Input name="wantedProduct" label="Product they wanted" list="product-options" />
            <datalist id="product-options">
              {state.products.map((product) => (
                <option key={product.id} value={product.productName} />
              ))}
            </datalist>
          </FormSection>

          <section className="border-b border-[#e5edf7] p-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Next action</span>
              <RichTextEditor value={nextAction} onChange={setNextAction} minHeight={170} />
            </label>
          </section>

          <div className="p-4">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} />
              Save lead
            </button>
          </div>
        </form>
      )}
    </CrmShell>
  );
}

function customerFromForm(form: FormData, id: string, assignedAgent?: string, secondAgent?: string): Customer {
  const firstName = String(form.get("firstName") || "");
  const lastName = String(form.get("lastName") || "");
  const businessName = String(form.get("businessName") || "");
  const name = `${firstName} ${lastName}`.trim() || businessName;
  const address = [form.get("unitNumber"), form.get("streetNumber"), form.get("streetName"), form.get("streetType"), form.get("suburb"), form.get("stateName"), form.get("postcode")]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    id,
    customerType: String(form.get("customerType") || "Business") as Customer["customerType"],
    parent: String(form.get("parent") || ""),
    businessName,
    description: String(form.get("description") || ""),
    buildingName: String(form.get("buildingName") || ""),
    unitType: String(form.get("unitType") || ""),
    unitNumber: String(form.get("unitNumber") || ""),
    levelType: String(form.get("levelType") || ""),
    levelNumber: String(form.get("levelNumber") || ""),
    streetNumber: String(form.get("streetNumber") || ""),
    streetName: String(form.get("streetName") || ""),
    streetType: String(form.get("streetType") || ""),
    streetSuffix: String(form.get("streetSuffix") || ""),
    suburb: String(form.get("suburb") || ""),
    stateName: String(form.get("stateName") || ""),
    postcode: String(form.get("postcode") || ""),
    rating: String(form.get("rating") || "Not Rated"),
    salesSource: String(form.get("salesSource") || ""),
    leadGenerator: String(form.get("leadGenerator") || ""),
    salesAgent: assignedAgent || "Aarav Admin",
    agent: String(form.get("agent") || ""),
    secondSalesAgent: secondAgent || "",
    abn: String(form.get("abn") || ""),
    industryType: String(form.get("industryType") || ""),
    paymentTermsValue: String(form.get("paymentTermsValue") || ""),
    paymentTermsUnit: String(form.get("paymentTermsUnit") || "days"),
    creditLimit: String(form.get("creditLimit") || ""),
    contactType: String(form.get("contactType") || "Primary"),
    firstName,
    lastName,
    position: String(form.get("position") || ""),
    mobile: String(form.get("mobile") || ""),
    name,
    email: String(form.get("email") || ""),
    phone: String(form.get("phone") || ""),
    address,
    wantedProduct: String(form.get("wantedProduct") || form.get("productInterest") || ""),
  };
}

function nextLeadId(leads: Lead[]) {
  const nextNumber = leads.reduce((highest, lead) => Math.max(highest, Number(lead.id.replace("L-", "")) || 1000), 1000) + 1;
  return `L-${nextNumber}`;
}

function nextCustomerId(customers: Customer[]) {
  const nextNumber = customers.reduce((highest, customer) => {
    const match = /^C-(\d+)$/.exec(customer.id);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]));
  }, 1000) + 1;
  return `C-${nextNumber}`;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#e5edf7] p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
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

function Select({
  label,
  options,
  value,
  onChange,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select {...props} value={value} onChange={(event) => onChange?.(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
