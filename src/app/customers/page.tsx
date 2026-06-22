"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil, Save, Search, Trash2, Upload, UserPlus, X } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Customer, Lead, TeamMember } from "@/lib/crm-data";
import { canAccessLead, canManageLeads, memberMatchesAssignment, useCurrentTeamMember } from "@/lib/use-current-team-member";
import { useCrmStore } from "@/lib/use-crm-store";

const customerTemplateHeaders = [
  "Type",
  "Parent",
  "Business Name",
  "Description",
  "Building / Village / Park Name",
  "Unit Type",
  "Unit Number",
  "Level Type",
  "Level Number",
  "Street Number",
  "Street Name",
  "Street Type",
  "Street Suffix",
  "Suburb",
  "State",
  "Postcode",
  "Rating",
  "Sales Source",
  "Lead Generator",
  "Sales Agent",
  "Agent",
  "Second Sales Agent",
  "ABN",
  "Industry Type",
  "Payment Terms Value",
  "Payment Terms Unit",
  "Credit Limit",
  "Contact Type",
  "First Name",
  "Last Name",
  "Position",
  "Email",
  "Phone Number",
  "Mobile Number",
  "Product They Wanted",
];
const customerPageSize = 25;

export default function CustomersPage() {
  const { state, saveStateNow, syncState } = useCrmStore();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [currentCustomerPage, setCurrentCustomerPage] = useState(1);
  const [newCustomerType, setNewCustomerType] = useState<Customer["customerType"]>("Business");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const { member: currentMember, ready: memberReady } = useCurrentTeamMember(state.team);
  const canManageCustomers = canManageLeads(currentMember);
  const isSavingCustomer = savingCustomer || syncState === "saving";
  const assigneeOptions = useMemo(() => {
    const activeMembers = canManageCustomers
      ? state.team.filter((member) => member.active).map((member) => member.name).filter(Boolean)
      : currentMember?.name
        ? [currentMember.name]
        : [];
    const uniqueMembers = Array.from(new Set(activeMembers));
    return uniqueMembers.length ? uniqueMembers : ["vinay dhanekula"];
  }, [canManageCustomers, currentMember, state.team]);

  const customers = useMemo(() => {
    const term = search.toLowerCase();
    if (!memberReady) return [];
    return state.customers
      .filter((customer) => canAccessCustomer(currentMember, customer, state.leads) && customerSearchText(customer).toLowerCase().includes(term))
      .sort((left, right) => customerSortTime(right) - customerSortTime(left));
  }, [currentMember, memberReady, search, state.customers, state.leads]);
  const editingCustomer = useMemo(() => state.customers.find((customer) => customer.id === editingCustomerId) ?? null, [editingCustomerId, state.customers]);
  const totalCustomerPages = Math.max(1, Math.ceil(customers.length / customerPageSize));
  const safeCustomerPage = Math.min(currentCustomerPage, totalCustomerPages);
  const visibleCustomers = useMemo(() => {
    const start = (safeCustomerPage - 1) * customerPageSize;
    return customers.slice(start, start + customerPageSize);
  }, [customers, safeCustomerPage]);
  const firstCustomerNumber = customers.length ? (safeCustomerPage - 1) * customerPageSize + 1 : 0;
  const lastCustomerNumber = Math.min(safeCustomerPage * customerPageSize, customers.length);

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingCustomer) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const customer = withCurrentOwner(customerFromForm(form, nextCustomerId(state.customers, state.deletedCustomerIds)), currentMember, canManageCustomers);
    setSavingCustomer(true);
    setMessage("Please wait, saving customer...");
    try {
      await saveStateNow((currentState) => ({
        ...currentState,
        deletedCustomerIds: (currentState.deletedCustomerIds ?? []).filter((id) => id !== customer.id),
        customers: [customer, ...currentState.customers.filter((existingCustomer) => existingCustomer.id !== customer.id)],
      }));
      formElement.reset();
      setNewCustomerType("Business");
      setCurrentCustomerPage(1);
      setMessage(`${customer.name || customer.businessName || "Customer"} added.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Could not save customer: ${error.message}` : "Could not save customer to Firebase. Please try again.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function saveCustomerEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCustomer || isSavingCustomer) return;
    const form = new FormData(event.currentTarget);
    const updatedCustomer = withCurrentOwner(customerFromForm(form, editingCustomer.id), currentMember, canManageCustomers);
    setSavingCustomer(true);
    setMessage("Please wait, saving customer...");
    try {
      await saveStateNow((currentState) => {
        return {
          ...currentState,
          customers: currentState.customers.map((customer) =>
            customer.id === editingCustomer.id
              ? {
                  ...customer,
                  ...updatedCustomer,
                  id: customer.id,
                  leadId: customer.leadId,
                }
              : customer,
          ),
        };
      });
      setCurrentCustomerPage(1);
      setEditingCustomerId(null);
      setMessage(`${updatedCustomer.name || updatedCustomer.businessName || "Customer"} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Could not save customer: ${error.message}` : "Could not save customer to Firebase. Please try again.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function deleteCustomer(customerId: string) {
    if (isSavingCustomer) return;
    setSavingCustomer(true);
    setMessage("Please wait, deleting customer...");
    try {
      await saveStateNow((currentState) => ({
        ...currentState,
        deletedCustomerIds: Array.from(new Set([...(currentState.deletedCustomerIds ?? []), customerId])),
        customers: currentState.customers.filter((customer) => customer.id !== customerId),
      }));
      setMessage("Customer deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? `Could not delete customer: ${error.message}` : "Could not delete customer from Firebase. Please try again.");
    } finally {
      setSavingCustomer(false);
    }
  }

  function downloadTemplate() {
    downloadCsv("customer-upload-template.csv", [customerTemplateHeaders]);
  }

  async function uploadCustomers(event: React.ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file) return;
    if (isSavingCustomer) return;
    setSavingCustomer(true);
    setMessage("Please wait, importing customers...");
    try {
      const rows = parseCsv(await file.text());
      const [headers, ...body] = rows;
      const usedCustomerIds = new Set([...state.customers.map((customer) => customer.id), ...(state.deletedCustomerIds ?? [])]);
      const imported = body
        .filter((row) => row.some(Boolean))
        .map((row) => ({ ...customerFromCsv(headers, row, nextCustomerId(usedCustomerIds)), updatedAt: new Date().toISOString() }));
      const importedIds = new Set(imported.map((customer) => customer.id));
      await saveStateNow((currentState) => ({
        ...currentState,
        deletedCustomerIds: (currentState.deletedCustomerIds ?? []).filter((id) => !importedIds.has(id)),
        customers: [...imported, ...currentState.customers.filter((customer) => !importedIds.has(customer.id))],
      }));
      setCurrentCustomerPage(1);
      setMessage(`${imported.length} customers imported.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Could not import customers: ${error.message}` : "Could not import customers to Firebase. Please try again.");
    } finally {
      inputElement.value = "";
      setSavingCustomer(false);
    }
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Customer database" title="Customers" />
      <div className="space-y-6 p-4 md:p-8">
        <form id="new-customer" onSubmit={addCustomer} className="scroll-mt-24 rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf7] p-4">
            <div className="flex items-center gap-2">
              <UserPlus size={18} />
              <h2 className="font-semibold">New customer</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-3 text-sm font-semibold text-[#003CBB]">
                <Download size={16} />
                Template
              </button>
              <label className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white ${isSavingCustomer ? "cursor-not-allowed bg-[#7f96cf]" : "cursor-pointer bg-[#003CBB]"}`}>
                <Upload size={16} />
                Bulk upload
                <input type="file" accept=".csv" onChange={uploadCustomers} disabled={isSavingCustomer} className="hidden" />
              </label>
            </div>
          </div>

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
            <Select name="salesAgent" label="Assigned to" options={assigneeOptions} />
            <Input name="agent" label="Agent" />
            <Input name="secondSalesAgent" label="Second Sales Agent" />
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

          {message ? <p className="mx-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
          <div className="p-4">
            <button disabled={isSavingCustomer} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#7f96cf]">
              <Save size={16} />
              {isSavingCustomer ? "Please wait, saving..." : "Save"}
            </button>
          </div>
        </form>

        <section id="all-customers" className="scroll-mt-24 rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf7] p-4">
            <h2 className="font-semibold">Added customers</h2>
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-[#657267]" size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentCustomerPage(1);
                }}
                placeholder="Search customers"
                className="h-10 w-72 rounded-lg border border-[#d9e2f2] bg-white pl-10 pr-3 text-sm outline-none"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse text-sm">
              <thead className="bg-[#f6f8fc] text-left text-xs uppercase tracking-[0.08em] text-[#657267]">
                <tr>
                  <Th>ID</Th>
                  <Th>Type</Th>
                  <Th>Customer</Th>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Wanted Product</Th>
                  <Th>Assigned to</Th>
                  <Th>Lead</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[#e5edf7]">
                    <Td>{customer.id}</Td>
                    <td className="whitespace-nowrap px-3 py-3">{customer.customerType ?? "Business"}</td>
                    <td className="min-w-56 px-3 py-3">
                      <p className="font-semibold text-[#0f172a]">{customer.businessName || customer.name || "Unnamed customer"}</p>
                      {customer.address ? <p className="mt-1 max-w-72 truncate text-xs text-[#657267]">{customer.address}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{customer.name || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{customer.email || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{customer.phone || customer.mobile || "-"}</td>
                    <td className="min-w-48 px-3 py-3">{customer.wantedProduct || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{customer.salesAgent || "vinay dhanekula"}</td>
                    <td className="px-3 py-2">
                      {customer.leadId ? (
                        <Link href={`/leads/${customer.leadId}`} className="font-semibold text-[#003CBB]">
                          Open lead
                        </Link>
                      ) : (
                        <span className="text-[#657267]">Manual</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button disabled={isSavingCustomer} onClick={() => setEditingCustomerId(customer.id)} className="grid size-8 place-items-center rounded-lg border border-[#c7d3e8] bg-white text-[#003CBB] disabled:cursor-not-allowed disabled:opacity-50" title="Edit customer">
                          <Pencil size={14} />
                        </button>
                        <button disabled={isSavingCustomer} onClick={() => void deleteCustomer(customer.id)} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white disabled:cursor-not-allowed disabled:bg-rose-300" title="Delete customer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 ? (
                  <tr className="border-t border-[#e5edf7]">
                    <td colSpan={10} className="p-8 text-center text-[#657267]">No customers match this search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5edf7] p-4 text-sm">
            <p className="text-[#657267]">
              Showing <span className="font-semibold text-[#0f172a]">{firstCustomerNumber}</span> to <span className="font-semibold text-[#0f172a]">{lastCustomerNumber}</span> of <span className="font-semibold text-[#0f172a]">{customers.length}</span> customers
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={safeCustomerPage <= 1}
                onClick={() => setCurrentCustomerPage((page) => Math.max(1, page - 1))}
                className="h-9 rounded-lg border border-[#c7d3e8] bg-white px-3 font-semibold text-[#003CBB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <label className="flex items-center gap-2 text-[#657267]">
                Page
                <select
                  value={safeCustomerPage}
                  onChange={(event) => setCurrentCustomerPage(Number(event.target.value))}
                  className="h-9 rounded-lg border border-[#d9e2f2] bg-white px-2 font-semibold text-[#0f172a] outline-none"
                >
                  {Array.from({ length: totalCustomerPages }, (_, index) => index + 1).map((page) => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </select>
                of {totalCustomerPages}
              </label>
              <button
                type="button"
                disabled={safeCustomerPage >= totalCustomerPages}
                onClick={() => setCurrentCustomerPage((page) => Math.min(totalCustomerPages, page + 1))}
                className="h-9 rounded-lg border border-[#c7d3e8] bg-white px-3 font-semibold text-[#003CBB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
      {editingCustomer ? (
        <CustomerEditDrawer
          customer={editingCustomer}
          assigneeOptions={assigneeOptions}
          products={state.products.map((product) => product.productName)}
          onClose={() => setEditingCustomerId(null)}
          onSubmit={saveCustomerEdit}
          saving={isSavingCustomer}
        />
      ) : null}
    </CrmShell>
  );
}

function customerFromForm(form: FormData, id: string): Customer {
  const firstName = String(form.get("firstName") || "");
  const lastName = String(form.get("lastName") || "");
  const name = `${firstName} ${lastName}`.trim() || String(form.get("businessName") || "");
  const address = [form.get("unitNumber"), form.get("streetNumber"), form.get("streetName"), form.get("streetType"), form.get("suburb"), form.get("stateName"), form.get("postcode")]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    id,
    customerType: String(form.get("customerType") || "Business") as Customer["customerType"],
    parent: String(form.get("parent") || ""),
    businessName: String(form.get("businessName") || ""),
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
    salesAgent: String(form.get("salesAgent") || "vinay dhanekula"),
    agent: String(form.get("agent") || ""),
    secondSalesAgent: String(form.get("secondSalesAgent") || ""),
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
    wantedProduct: String(form.get("wantedProduct") || ""),
  };
}

function canAccessCustomer(member: TeamMember | null | undefined, customer: Customer, leads: Lead[]) {
  if (!member) return false;
  if (canManageLeads(member)) return true;
  const linkedLead = customer.leadId ? leads.find((lead) => lead.id === customer.leadId) : undefined;
  if (linkedLead && canAccessLead(member, linkedLead)) return true;
  return [customer.salesAgent, customer.secondSalesAgent, customer.agent]
    .filter(Boolean)
    .some((value) => memberMatchesAssignment(member, value));
}

function withCurrentOwner(customer: Customer, currentMember: TeamMember | null | undefined, canManageCustomers: boolean): Customer {
  if (canManageCustomers || !currentMember) {
    return { ...customer, updatedAt: new Date().toISOString() };
  }
  return {
    ...customer,
    salesAgent: currentMember.name,
    agent: customer.agent || currentMember.email || currentMember.id,
    updatedAt: new Date().toISOString(),
  };
}

function customerFromCsv(headers: string[], row: string[], id: string): Customer {
  const get = (name: string) => row[headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(name))] ?? "";
  const firstName = get("First Name");
  const lastName = get("Last Name");
  const businessName = get("Business Name");
  const address = [get("Unit Number"), get("Street Number"), get("Street Name"), get("Street Type"), get("Suburb"), get("State"), get("Postcode")]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    customerType: (get("Type") || "Business") as Customer["customerType"],
    parent: get("Parent"),
    businessName,
    description: get("Description"),
    buildingName: get("Building / Village / Park Name"),
    unitType: get("Unit Type"),
    unitNumber: get("Unit Number"),
    levelType: get("Level Type"),
    levelNumber: get("Level Number"),
    streetNumber: get("Street Number"),
    streetName: get("Street Name"),
    streetType: get("Street Type"),
    streetSuffix: get("Street Suffix"),
    suburb: get("Suburb"),
    stateName: get("State"),
    postcode: get("Postcode"),
    rating: get("Rating"),
    salesSource: get("Sales Source"),
    leadGenerator: get("Lead Generator"),
    salesAgent: get("Sales Agent") || "vinay dhanekula",
    agent: get("Agent"),
    secondSalesAgent: get("Second Sales Agent"),
    abn: get("ABN"),
    industryType: get("Industry Type"),
    paymentTermsValue: get("Payment Terms Value"),
    paymentTermsUnit: get("Payment Terms Unit"),
    creditLimit: get("Credit Limit"),
    contactType: get("Contact Type") || "Primary",
    firstName,
    lastName,
    position: get("Position"),
    email: get("Email"),
    phone: get("Phone Number"),
    mobile: get("Mobile Number"),
    name: `${firstName} ${lastName}`.trim() || businessName,
    address,
    wantedProduct: get("Product They Wanted"),
  };
}

function nextCustomerId(customers: Customer[] | Set<string>, deletedCustomerIds: string[] = []): string {
  const existingIds = customers instanceof Set
    ? customers
    : new Set([...customers.map((customer) => customer.id), ...deletedCustomerIds]);
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  const id = `C-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`;
  if (existingIds.has(id)) return nextCustomerId(existingIds);
  existingIds.add(id);
  return id;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#e5edf7] p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function CustomerEditDrawer({
  customer,
  assigneeOptions,
  products,
  onClose,
  onSubmit,
  saving,
}: {
  customer: Customer;
  assigneeOptions: string[];
  products: string[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/30">
      <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5edf7] p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#657267]">Edit customer</p>
            <h2 className="mt-1 text-2xl font-bold text-[#0f172a]">{customer.businessName || customer.name || customer.id}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg border border-[#c7d3e8] bg-white text-[#0f172a]" title="Close editor">
            <X size={18} />
          </button>
        </div>

        <form key={customer.id} onSubmit={onSubmit} className="flex-1 overflow-y-auto">
          <FormSection title="Customer Details and Installation Address">
            <Select name="customerType" label="Type" options={["Business", "Residential", "Parent"]} defaultValue={customer.customerType ?? "Business"} />
            <Input name="parent" label="Parent / Group Name" defaultValue={customer.parent ?? ""} />
            <Input name="businessName" label="Business Name" defaultValue={customer.businessName ?? ""} />
            <Input name="description" label="Description" defaultValue={customer.description ?? ""} />
            <Input name="buildingName" label="Building / Village / Park Name" defaultValue={customer.buildingName ?? ""} />
            <Input name="unitType" label="Unit Type" defaultValue={customer.unitType ?? ""} />
            <Input name="unitNumber" label="Unit Number" defaultValue={customer.unitNumber ?? ""} />
            <Input name="levelType" label="Level Type" defaultValue={customer.levelType ?? ""} />
            <Input name="levelNumber" label="Level Number" defaultValue={customer.levelNumber ?? ""} />
            <Input name="streetNumber" label="Street Number" defaultValue={customer.streetNumber ?? ""} />
            <Input name="streetName" label="Street Name" defaultValue={customer.streetName ?? ""} />
            <Input name="streetType" label="Street Type" defaultValue={customer.streetType ?? ""} />
            <Input name="streetSuffix" label="Street Suffix" defaultValue={customer.streetSuffix ?? ""} />
            <Input name="suburb" label="Suburb" defaultValue={customer.suburb ?? ""} />
            <Input name="stateName" label="State" defaultValue={customer.stateName ?? ""} />
            <Input name="postcode" label="Postcode" defaultValue={customer.postcode ?? ""} />
          </FormSection>

          <FormSection title="Contacts">
            <Select name="contactType" label="Type" options={["Primary", "Billing", "Site", "Decision maker"]} defaultValue={customer.contactType ?? "Primary"} />
            <Input name="firstName" label="First Name" defaultValue={customer.firstName ?? ""} />
            <Input name="lastName" label="Last Name" defaultValue={customer.lastName ?? ""} />
            <Input name="position" label="Position" defaultValue={customer.position ?? ""} />
            <Input name="email" label="E-mail" type="email" defaultValue={customer.email ?? ""} />
            <Input name="phone" label="Phone Number" defaultValue={customer.phone ?? ""} />
            <Input name="mobile" label="Mobile Number" defaultValue={customer.mobile ?? ""} />
          </FormSection>

          <FormSection title="Sales Info and Status">
            <Select name="rating" label="Rating" options={["Not Rated", "1", "2", "3", "4", "5"]} defaultValue={customer.rating ?? "Not Rated"} />
            <Input name="salesSource" label="Sales Source" defaultValue={customer.salesSource ?? ""} />
            <Input name="leadGenerator" label="Lead Generator" defaultValue={customer.leadGenerator ?? ""} />
            <Select name="salesAgent" label="Assigned to" options={assigneeOptions} defaultValue={customer.salesAgent ?? "vinay dhanekula"} />
            <Input name="agent" label="Agent" defaultValue={customer.agent ?? ""} />
            <Input name="secondSalesAgent" label="Second Sales Agent" defaultValue={customer.secondSalesAgent ?? ""} />
          </FormSection>

          <FormSection title="Additional Information">
            <Input name="abn" label="ABN" defaultValue={customer.abn ?? ""} />
            <Input name="industryType" label="Industry Type" defaultValue={customer.industryType ?? ""} />
            <Input name="paymentTermsValue" label="Payment Terms" defaultValue={customer.paymentTermsValue ?? ""} />
            <Select name="paymentTermsUnit" label="Payment Unit" options={["days", "weeks", "months"]} defaultValue={customer.paymentTermsUnit ?? "days"} />
            <Input name="creditLimit" label="Credit Limit" defaultValue={customer.creditLimit ?? ""} />
            <Input name="wantedProduct" label="Product they wanted" list="edit-product-options" defaultValue={customer.wantedProduct ?? ""} />
            <datalist id="edit-product-options">
              {products.map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>
          </FormSection>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#e5edf7] bg-white p-4">
            <button type="button" disabled={saving} onClick={onClose} className="h-11 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-50">
              Cancel
            </button>
            <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#7f96cf]">
              <Save size={16} />
              {saving ? "Please wait, saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
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
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const selectProps = value === undefined ? { defaultValue } : { value };
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select name={name} {...selectProps} onChange={(event) => onChange?.(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap border-r border-[#d9e2f2] px-3 py-3 font-semibold last:border-r-0">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#003CBB]">{children}</td>;
}

function customerSearchText(customer: Customer) {
  return [
    customer.name,
    customer.email,
    customer.phone,
    customer.mobile,
    customer.address,
    customer.businessName,
    customer.wantedProduct,
    customer.salesAgent,
    customer.abn,
  ].join(" ");
}

function customerSortTime(customer: Customer) {
  const time = Date.parse(customer.updatedAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
