"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, Trash2 } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Product, QuoteLineItem, QuoteRecord, currency } from "@/lib/crm-data";
import { useCrmStore } from "@/lib/use-crm-store";

const schemes = ["STC HP", "STC SOLAR + BATTERY", "VEU APP - VIC Appliances", "VEU HP - VIC Water Heating", "VEU RESI", "VEU SH - VIC Space Heating/Cooling", "Off Scheme"];
const priceTiers = ["Contractor Price", "Retail Price", "Custom Price"];
const installTiers = ["Tier 1 (Metro / Standard)", "Tier 2 (Regional)", "Tier 3 (Complex Install)", "Custom"];
const baselineOptions = ["GAS Ducted Heater NO Air Con", "Gas heater + existing air con", "Electric resistance heater", "No existing system"];
const fallbackProductCategories = ["All", "Aircon", "Heat Pump", "Solar", "Solar Battery", "Inverter"];

export default function QuotesPage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const customers = state.customers;
  const [productCategory, setProductCategory] = useState("All");
  const [productBrand, setProductBrand] = useState("All");
  const [productSearch, setProductSearch] = useState("");
  const productCategories = useMemo(() => unique([...fallbackProductCategories, ...state.products.map((product) => product.category)]), [state.products]);
  const categoryCatalog = useMemo(() => state.products.filter((product) => productCategory === "All" || product.category === productCategory), [productCategory, state.products]);
  const brandOptions = useMemo(() => ["All", ...unique(categoryCatalog.map((item) => item.brandName))], [categoryCatalog]);
  const activeBrand = brandOptions.includes(productBrand) ? productBrand : "All";
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return categoryCatalog.filter((product) => {
      const matchesBrand = activeBrand === "All" || product.brandName === activeBrand;
      const matchesSearch = !term || [product.brandName, product.model, product.productName, product.productType, product.productConfiguration, product.productClass].join(" ").toLowerCase().includes(term);
      return matchesBrand && matchesSearch;
    });
  }, [activeBrand, categoryCatalog, productSearch]);
  const quoteProducts = filteredProducts;
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? "");
  const [description, setDescription] = useState(customers[0]?.name ?? "");
  const [scheme, setScheme] = useState("VEU SH - VIC Space Heating/Cooling");
  const [activityDate, setActivityDate] = useState("2026-05-02");
  const [priceTier, setPriceTier] = useState(priceTiers[0]);
  const [installTier, setInstallTier] = useState(installTiers[0]);
  const [baseline, setBaseline] = useState(baselineOptions[0]);
  const [outdoorModel, setOutdoorModel] = useState("");
  const [headModel, setHeadModel] = useState("");
  const [headArea, setHeadArea] = useState("Bedroom 1");
  const [headAreaM2, setHeadAreaM2] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [productPrice, setProductPrice] = useState(0);
  const [installPrice, setInstallPrice] = useState(0);
  const [certificates, setCertificates] = useState(0);
  const [certificateRate, setCertificateRate] = useState(73.6);
  const [minimumContributionAdjustment, setMinimumContributionAdjustment] = useState(0);
  const [gstRate, setGstRate] = useState(10);
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [addons, setAddons] = useState<QuoteLineItem[]>([]);
  const [addonName, setAddonName] = useState("");
  const [addonQty, setAddonQty] = useState(1);
  const [addonPrice, setAddonPrice] = useState(0);
  const [message, setMessage] = useState("");
  const customer = customers.find((item) => item.id === selectedCustomerId);
  const calculations = calculateQuote(items, addons, certificateRate, minimumContributionAdjustment, gstRate);
  const selectedOutdoorModel = quoteProducts.some((product) => product.id === outdoorModel) ? outdoorModel : (quoteProducts[0]?.id ?? "");
  const selectedHeadModel = quoteProducts.some((product) => product.id === headModel) ? headModel : (quoteProducts[0]?.id ?? "");

  function selectCustomer(customerId: string) {
    const nextCustomer = customers.find((item) => item.id === customerId);
    setSelectedCustomerId(customerId);
    setDescription(nextCustomer?.name || nextCustomer?.businessName || "");
  }

  function addOutdoor() {
    const product = quoteProducts.find((item) => item.id === selectedOutdoorModel);
    if (!product) {
      setMessage("Import or select a product first.");
      return;
    }
    setItems((current) => [lineFromProduct(product, "Outdoor Unit", baseline, 0, 1, product.price, 0, 0, "Outdoor unit"), ...current.filter((item) => item.role !== "Outdoor Unit")]);
  }

  function addHead() {
    if (items.filter((item) => item.role === "Indoor Head").length >= 4) {
      setMessage("Maximum 4 indoor heads allowed.");
      return;
    }
    const product = quoteProducts.find((item) => item.id === selectedHeadModel);
    if (!product) {
      setMessage("Import or select a product first.");
      return;
    }
    setItems((current) => [...current, lineFromProduct(product, "Indoor Head", headArea, headAreaM2, quantity, productPrice || product.price, installPrice, certificates, "Indoor head")]);
    setMessage(`${product.model} added as indoor head.`);
  }

  function addService() {
    if (!addonName) return;
    setAddons((current) => [
      ...current,
      {
        id: `A-${current.length + 1}`,
        role: "Accessory",
        model: addonName,
        brand: "Custom",
        area: "Additional service",
        quantity: addonQty,
        productPrice: addonPrice,
        installPrice: 0,
        certificates: 0,
        notes: "",
      },
    ]);
    setAddonName("");
    setAddonQty(1);
    setAddonPrice(0);
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function removeAddon(itemId: string) {
    setAddons((current) => current.filter((item) => item.id !== itemId));
  }

  function saveQuote(status: QuoteRecord["status"], openProposal = false) {
    if (!customer) {
      setMessage("Select a customer first.");
      return;
    }
    const quote: QuoteRecord = {
      id: `Q-${1000 + state.quotes.length + 1}`,
      customerId: customer.id,
      description,
      scheme,
      activityDate,
      priceTier,
      installationCostTier: installTier,
      items,
      additionalServices: addons,
      certificateRate,
      minimumContributionAdjustment,
      gstRate,
      status,
    };
    setState({ ...state, quotes: [quote, ...state.quotes] });
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(quote));
    setMessage(status === "Draft" ? "Draft proposal saved." : "Quote saved.");
    if (openProposal) {
      router.push(`/quotes/${quote.id}/proposal`);
    }
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Quote maker" title="Aircon proposal calculator" />
      <div className="space-y-6 p-4 md:p-8">
        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Main Record" />
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Customer</span>
              <select value={selectedCustomerId} onChange={(event) => selectCustomer(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.id.replace("C-", "")}] {item.name || item.businessName}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Select label="Scheme" value={scheme} options={schemes} onChange={setScheme} />
            <Input label="Activity Date" type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} />
            <Select label="Price Tier" value={priceTier} options={priceTiers} onChange={setPriceTier} />
            <Select label="Installation Cost Tier" value={installTier} options={installTiers} onChange={setInstallTier} />
          </div>
        </section>

        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Products" />
          <div className="grid gap-6 p-5 xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Select label="Category" value={productCategory} options={productCategories} onChange={setProductCategory} />
              <Select label="Brand" value={activeBrand} options={brandOptions} onChange={setProductBrand} />
              <Input label="Search product" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Brand, model, class..." />
              <Select label="Product Type" value={productById(quoteProducts, selectedHeadModel)?.productType ?? productById(quoteProducts, selectedOutdoorModel)?.productType ?? "Select product"} options={unique(quoteProducts.map((item) => item.productType ?? ""))} onChange={() => undefined} />
              <Select label="Product Configuration" value={productById(quoteProducts, selectedHeadModel)?.productConfiguration ?? productById(quoteProducts, selectedOutdoorModel)?.productConfiguration ?? "Select product"} options={unique(quoteProducts.map((item) => item.productConfiguration ?? ""))} onChange={() => undefined} />
              <Select label="Outdoor Unit (always outside)" value={selectedOutdoorModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setOutdoorModel} />
              <button onClick={addOutdoor} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add selected as outdoor unit</button>
              <Select label="Indoor Head (up to 4)" value={selectedHeadModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setHeadModel} />
              <Select label="Original Equipment" value={baseline} options={baselineOptions} onChange={setBaseline} />
              <Input label="Area" value={headArea} onChange={(event) => setHeadArea(event.target.value)} />
              <NumberInput label="Area (m2)" value={headAreaM2} onChange={setHeadAreaM2} />
              <NumberInput label="Upgrade Quantity" value={quantity} onChange={setQuantity} />
              <NumberInput label="Product Price (per unit), $" value={productPrice} onChange={setProductPrice} />
              <NumberInput label="Install Cost, $" value={installPrice} onChange={setInstallPrice} />
              <NumberInput label="Certificates" value={certificates} onChange={setCertificates} />
              <button onClick={addHead} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add indoor head</button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#e5edf7]">
              <table className="min-w-[850px] w-full text-sm">
                <thead className="bg-[#f6f8fc] text-left text-xs uppercase text-[#657267]">
                  <tr>
                    <Th>Role</Th>
                    <Th>Product</Th>
                    <Th>Original Equipment / Area</Th>
                    <Th>Qty</Th>
                    <Th>Product Cost</Th>
                    <Th>Install Cost</Th>
                    <Th>Certs</Th>
                    <Th>Remove</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-[#e5edf7]">
                      <Td>{item.role}</Td>
                      <Td>{item.brand} {item.model}</Td>
                      <Td>{item.area}</Td>
                      <Td>{item.quantity}</Td>
                      <Td>{currency(item.productPrice * item.quantity)}</Td>
                      <Td>{currency(item.installPrice * item.quantity)}</Td>
                      <Td>{item.certificates}</Td>
                      <td className="p-2"><IconButton onClick={() => removeItem(item.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Additional Services and Access Equipment" />
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_140px_160px_auto]">
            <Input label="Add-On" value={addonName} onChange={(event) => setAddonName(event.target.value)} />
            <NumberInput label="Quantity" value={addonQty} onChange={setAddonQty} />
            <NumberInput label="Price" value={addonPrice} onChange={setAddonPrice} />
            <button onClick={addService} className="mt-6 h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add item</button>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-[#f6f8fc] text-left text-xs uppercase text-[#657267]">
                <tr><Th>Add-On</Th><Th>Qty</Th><Th>Price</Th><Th>Total</Th><Th>Remove</Th></tr>
              </thead>
              <tbody>
                {addons.map((item) => (
                  <tr key={item.id} className="border-t border-[#e5edf7]">
                    <Td>{item.model}</Td><Td>{item.quantity}</Td><Td>{currency(item.productPrice)}</Td><Td>{currency(item.productPrice * item.quantity)}</Td>
                    <td className="p-2"><IconButton onClick={() => removeAddon(item.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Questions" />
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <Select label="Is the building at least 2 years old?" value="Yes" options={["Yes", "No", "New Install - No decommissioning required"]} onChange={() => undefined} />
            <Input label="Inclusions And Exclusions" placeholder="Optional" />
            <Select label="Form of benefit provided?" value="Point of sale discount" options={["Point of sale discount", "Cashback", "Invoice credit"]} onChange={() => undefined} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
            <SectionTitle title="Calculation Results" />
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <NumberInput label="Certificate Rate" value={certificateRate} onChange={setCertificateRate} />
              <NumberInput label="Minimum Contribution Adjustment" value={minimumContributionAdjustment} onChange={setMinimumContributionAdjustment} />
              <NumberInput label="GST Rate %" value={gstRate} onChange={setGstRate} />
            </div>
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
              <Result label="VEECs Created" value={`${calculations.certificates.toFixed(2)} @ ${certificateRate.toFixed(2)}`} />
              <Result label="Certificate discount, $" value={currency(calculations.certificateDiscount)} />
              <Result label="Total product cost, $" value={currency(calculations.productCost)} />
              <Result label="Total installation cost, $" value={currency(calculations.installCost)} />
              <Result label="Minimum contribution adjustment, $" value={currency(minimumContributionAdjustment)} />
              <Result label="Total cost, $" value={currency(calculations.totalCost)} />
              <Result label="Total net cost (ex. GST), $" value={currency(calculations.netExGst)} />
              <Result label="Total net cost (incl. GST), $" value={currency(calculations.netIncGst)} strong />
            </div>
          </div>
          <div className="rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Final actions</h2>
            {message ? <p className="mt-3 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
            <div className="mt-4 grid gap-2">
              <button onClick={() => saveQuote("Saved")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white"><Save size={16} /> Save</button>
              <button onClick={() => saveQuote("Saved")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold text-[#003CBB]"><Save size={16} /> Save as New</button>
              <button onClick={() => saveQuote("Draft", true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-4 text-sm font-semibold"><FileText size={16} /> Draft Proposal</button>
            </div>
          </div>
        </section>
      </div>
    </CrmShell>
  );
}

function lineFromProduct(product: Product, role: QuoteLineItem["role"], area: string, areaM2: number, quantity: number, productPrice: number, installPrice: number, certificates: number, notes: string): QuoteLineItem {
  return {
    id: `${role.replace(/\s/g, "-")}-${product.id}-${area.replace(/\s/g, "-")}`,
    role,
    productId: product.id,
    model: product.model ?? product.productName,
    brand: product.brandName,
    area,
    areaM2,
    recommendedHeatingOutput: recommendedHeatingOutput(areaM2),
    quantity,
    productPrice,
    installPrice,
    certificates,
    notes,
  };
}

function recommendedHeatingOutput(areaM2: number) {
  if (areaM2 <= 20) return "2.5 to 3 kW";
  if (areaM2 <= 40) return "3 to 5 kW";
  if (areaM2 <= 60) return "5 to 8 kW";
  return "+8 kW";
}

function calculateQuote(items: QuoteLineItem[], addons: QuoteLineItem[], certificateRate: number, minimumContributionAdjustment: number, gstRate: number) {
  const allItems = [...items, ...addons];
  const certificates = allItems.reduce((sum, item) => sum + item.certificates * item.quantity, 0);
  const certificateDiscount = certificates * certificateRate;
  const productCost = allItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  const installCost = allItems.reduce((sum, item) => sum + item.installPrice * item.quantity, 0);
  const totalCost = productCost + installCost + minimumContributionAdjustment;
  const netExGst = Math.max(0, totalCost - certificateDiscount);
  const netIncGst = netExGst * (1 + gstRate / 100);
  return { certificates, certificateDiscount, productCost, installCost, totalCost, netExGst, netIncGst };
}

function productById(products: Product[], id: string) {
  return products.find((product) => product.id === id);
}

function productLabel(product?: Product) {
  return product ? `${product.brandName} ${product.model ?? product.productName}` : "";
}

function unique(values: string[]) {
  const cleaned = Array.from(new Set(values.filter(Boolean)));
  return cleaned.length ? cleaned : ["Select product"];
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="border-b border-[#e5edf7] bg-[#f6f8fc] px-5 py-3 font-semibold">{title}</h2>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <input {...inputProps} className="h-11 w-full rounded-lg border border-[#d7dfd0] px-3 outline-none" />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Input label={label} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function Select({ label, value, options, onChange, labelFor }: { label: string; value: string; options: string[]; onChange: (value: string) => void; labelFor?: (value: string) => string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
        {options.map((option) => <option key={option} value={option}>{labelFor ? labelFor(option) : option}</option>)}
      </select>
    </label>
  );
}

function Result({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e5edf7] p-3">
      <p className="text-sm font-semibold">{label}</p>
      <p className={`mt-2 ${strong ? "text-lg font-bold" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3">{children}</td>;
}

function IconButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white"><Trash2 size={14} /></button>;
}
