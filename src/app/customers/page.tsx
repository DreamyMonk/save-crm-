"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Save, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Customer } from "@/lib/crm-data";
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

export default function CustomersPage() {
  const { state, setState } = useCrmStore();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [newCustomerType, setNewCustomerType] = useState<Customer["customerType"]>("Business");
  const assigneeOptions = useMemo(() => {
    const activeMembers = state.team.filter((member) => member.active).map((member) => member.name).filter(Boolean);
    return activeMembers.length ? activeMembers : ["Aarav Admin"];
  }, [state.team]);

  const customers = useMemo(() => {
    const term = search.toLowerCase();
    return state.customers.filter((customer) => customerSearchText(customer).toLowerCase().includes(term));
  }, [search, state.customers]);

  function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = customerFromForm(form, `C-${1000 + state.customers.length + 1}`);
    setState({ ...state, customers: [...state.customers, customer] });
    event.currentTarget.reset();
    setNewCustomerType("Business");
    setMessage(`${customer.name || customer.businessName || "Customer"} added.`);
  }

  function updateCustomer(customerId: string, updates: Partial<Customer>) {
    setState({
      ...state,
      customers: state.customers.map((customer) => (customer.id === customerId ? { ...customer, ...updates } : customer)),
    });
  }

  function deleteCustomer(customerId: string) {
    setState({ ...state, customers: state.customers.filter((customer) => customer.id !== customerId) });
    setMessage("Customer deleted.");
  }

  function downloadTemplate() {
    downloadCsv("customer-upload-template.csv", [customerTemplateHeaders]);
  }

  async function uploadCustomers(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = parseCsv(await file.text());
    const [headers, ...body] = rows;
    const imported = body
      .filter((row) => row.some(Boolean))
      .map((row, index) => customerFromCsv(headers, row, `C-${1000 + state.customers.length + index + 1}`));
    setState({ ...state, customers: [...state.customers, ...imported] });
    setMessage(`${imported.length} customers imported.`);
    event.currentTarget.value = "";
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
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#003CBB] px-3 text-sm font-semibold text-white">
                <Upload size={16} />
                Bulk upload
                <input type="file" accept=".csv" onChange={uploadCustomers} className="hidden" />
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
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
              <Save size={16} />
              Save
            </button>
          </div>
        </form>

        <section id="all-customers" className="scroll-mt-24 rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf7] p-4">
            <h2 className="font-semibold">Added customers</h2>
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-[#657267]" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" className="h-10 w-72 rounded-lg border border-[#d9e2f2] bg-white pl-10 pr-3 text-sm outline-none" />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1900px] w-full border-collapse text-sm">
              <thead className="bg-[#f6f8fc] text-left text-xs uppercase tracking-[0.08em] text-[#657267]">
                <tr>
                  <Th>ID</Th>
                  <Th>Type</Th>
                  <Th>Business Name</Th>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Mobile</Th>
                  <Th>Address</Th>
                  <Th>Suburb</Th>
                  <Th>State</Th>
                  <Th>Postcode</Th>
                  <Th>Wanted Product</Th>
                  <Th>Assigned to</Th>
                  <Th>ABN</Th>
                  <Th>Lead</Th>
                  <Th>Delete</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[#e5edf7]">
                    <Td>{customer.id}</Td>
                    <EditableCell value={customer.customerType ?? "Business"} onChange={(value) => updateCustomer(customer.id, { customerType: value as Customer["customerType"] })} />
                    <EditableCell value={customer.businessName ?? ""} onChange={(value) => updateCustomer(customer.id, { businessName: value, address: value })} />
                    <EditableCell value={customer.name} onChange={(value) => updateCustomer(customer.id, { name: value })} />
                    <EditableCell value={customer.email} onChange={(value) => updateCustomer(customer.id, { email: value })} />
                    <EditableCell value={customer.phone} onChange={(value) => updateCustomer(customer.id, { phone: value })} />
                    <EditableCell value={customer.mobile ?? ""} onChange={(value) => updateCustomer(customer.id, { mobile: value })} />
                    <EditableCell value={customer.address} onChange={(value) => updateCustomer(customer.id, { address: value })} />
                    <EditableCell value={customer.suburb ?? ""} onChange={(value) => updateCustomer(customer.id, { suburb: value })} />
                    <EditableCell value={customer.stateName ?? ""} onChange={(value) => updateCustomer(customer.id, { stateName: value })} />
                    <EditableCell value={customer.postcode ?? ""} onChange={(value) => updateCustomer(customer.id, { postcode: value })} />
                    <EditableCell value={customer.wantedProduct} onChange={(value) => updateCustomer(customer.id, { wantedProduct: value })} />
                    <EditableCell value={customer.salesAgent ?? "Aarav Admin"} onChange={(value) => updateCustomer(customer.id, { salesAgent: value })} />
                    <EditableCell value={customer.abn ?? ""} onChange={(value) => updateCustomer(customer.id, { abn: value })} />
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
                      <button onClick={() => deleteCustomer(customer.id)} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white" title="Delete customer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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
    salesAgent: String(form.get("salesAgent") || "Aarav Admin"),
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
    salesAgent: get("Sales Agent") || "Aarav Admin",
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

function Select({ label, name, options, value, onChange }: { label: string; name: string; options: string[]; value?: string; onChange?: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select name={name} value={value} onChange={(event) => onChange?.(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
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

function EditableCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <td className="min-w-40 px-2 py-2">
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none focus:border-[#003CBB] focus:bg-white" />
    </td>
  );
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
