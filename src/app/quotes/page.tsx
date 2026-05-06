"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Save, Trash2 } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { Product, QuoteLineItem, QuoteRecord, currency } from "@/lib/crm-data";
import { displayBrandForCategory, isAllowedBrandForCategory } from "@/lib/product-brand-rules";
import { syncProposalCollections } from "@/lib/proposal-packages";
import { useCrmStore } from "@/lib/use-crm-store";

const schemes = ["STC HP", "STC SOLAR + BATTERY", "VEU APP - VIC Appliances", "VEU HP - VIC Water Heating", "VEU RESI", "VEU SH - VIC Space Heating/Cooling", "Off Scheme"];
const schemesByCategory: Record<string, string[]> = {
  Aircon: ["VEU SH - VIC Space Heating/Cooling", "Off Scheme"],
  "Heat Pump": ["VEU HP - VIC Water Heating", "STC HP", "Off Scheme"],
  Solar: ["STC SOLAR + BATTERY", "Off Scheme"],
  Inverter: ["STC SOLAR + BATTERY", "Off Scheme"],
  "Solar Battery": ["STC SOLAR + BATTERY", "Off Scheme"],
};
const priceTiers = ["Contractor Price", "Retail Price", "Custom Price"];
const installTiers = ["Tier 1 (Metro / Standard)", "Tier 2 (Regional)", "Tier 3 (Complex Install)", "Custom"];
const baselineOptions = ["GAS Ducted Heater NO Air Con", "Gas heater + existing air con", "Electric resistance heater", "No existing system"];
const fallbackProductCategories = ["All", "Aircon", "Heat Pump", "Solar", "Solar Battery", "Inverter"];

export default function QuotesPage() {
  const { state, setState } = useCrmStore();
  const router = useRouter();
  const customers = state.customers;
  const [productCategory, setProductCategory] = useState("Aircon");
  const [productBrand, setProductBrand] = useState("All");
  const [productType, setProductType] = useState("All");
  const [productConfiguration, setProductConfiguration] = useState("All");
  const [productSearch, setProductSearch] = useState("");
  const [scheme, setScheme] = useState("VEU SH - VIC Space Heating/Cooling");
  const productCategories = useMemo(() => unique([...fallbackProductCategories, ...state.products.map((product) => product.category)]), [state.products]);
  const categoryCatalog = useMemo(() => {
    return state.products.filter((product) => {
      if (productCategory === "All") return true;
      return product.category === productCategory && isAllowedBrandForCategory(productCategory, product.brandName);
    });
  }, [productCategory, state.products]);
  const schemeOptions = schemesByCategory[productCategory] ?? schemes;
  const activeScheme = schemeOptions.includes(scheme) ? scheme : schemeOptions[0];
  const brandOptions = useMemo(() => ["All", ...unique(categoryCatalog.map((item) => displayBrandForCategory(item.category, item.brandName)))], [categoryCatalog]);
  const activeBrand = brandOptions.includes(productBrand) ? productBrand : "All";
  const brandCatalog = useMemo(() => categoryCatalog.filter((product) => activeBrand === "All" || displayBrandForCategory(product.category, product.brandName) === activeBrand), [activeBrand, categoryCatalog]);
  const productTypeOptions = useMemo(() => ["All", ...unique(brandCatalog.map((item) => item.productType ?? ""))], [brandCatalog]);
  const activeProductType = productTypeOptions.includes(productType) ? productType : "All";
  const typeCatalog = useMemo(() => brandCatalog.filter((product) => activeProductType === "All" || product.productType === activeProductType), [activeProductType, brandCatalog]);
  const productConfigurationOptions = useMemo(() => ["All", ...unique(typeCatalog.map((item) => item.productConfiguration ?? ""))], [typeCatalog]);
  const activeProductConfiguration = productConfigurationOptions.includes(productConfiguration) ? productConfiguration : "All";
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return typeCatalog.filter((product) => {
      const matchesConfiguration = activeProductConfiguration === "All" || product.productConfiguration === activeProductConfiguration;
      const matchesSearch = !term || [product.brandName, product.model, product.productName, product.productType, product.productConfiguration, product.productClass].join(" ").toLowerCase().includes(term);
      return matchesConfiguration && matchesSearch;
    });
  }, [activeProductConfiguration, productSearch, typeCatalog]);
  const quoteProducts = filteredProducts;
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? "");
  const [description, setDescription] = useState(customers[0]?.name ?? "");
  const [activityDate, setActivityDate] = useState("2026-05-02");
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
  const [rebate, setRebate] = useState(0);
  const [solarVicLoan, setSolarVicLoan] = useState(0);
  const [depositPercent, setDepositPercent] = useState(50);
  const [annualEnergyProductionKwh, setAnnualEnergyProductionKwh] = useState(0);
  const [discountedPaybackYears, setDiscountedPaybackYears] = useState(0);
  const [annualBillSavings, setAnnualBillSavings] = useState(0);
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [addons, setAddons] = useState<QuoteLineItem[]>([]);
  const [addonName, setAddonName] = useState("");
  const [addonQty, setAddonQty] = useState(1);
  const [addonPrice, setAddonPrice] = useState(0);
  const [buildingAgeAnswer, setBuildingAgeAnswer] = useState("Yes");
  const [inclusions, setInclusions] = useState("");
  const [benefitForm, setBenefitForm] = useState("Point of sale discount");
  const [message, setMessage] = useState("");
  const [currentQuoteId, setCurrentQuoteId] = useState("");
  const activeSelectedCustomerId = customers.some((item) => item.id === selectedCustomerId) ? selectedCustomerId : (customers[0]?.id ?? "");
  const customer = customers.find((item) => item.id === activeSelectedCustomerId);
  const calculations = calculateQuote(items, addons, {
    certificateRate,
    minimumContributionAdjustment,
    gstRate,
    rebate,
    solarVicLoan,
    depositPercent,
  });
  const isAirconCategory = productCategory === "Aircon";
  const selectedOutdoorModel = quoteProducts.some((product) => product.id === outdoorModel) ? outdoorModel : (quoteProducts[0]?.id ?? "");
  const selectedHeadModel = quoteProducts.some((product) => product.id === headModel) ? headModel : (quoteProducts[0]?.id ?? "");
  const selectedProductModel = quoteProducts.some((product) => product.id === headModel) ? headModel : (quoteProducts[0]?.id ?? "");
  const isSolarCategory = productCategory === "Solar" || productCategory === "Inverter" || productCategory === "Solar Battery";
  const isHeatPumpCategory = productCategory === "Heat Pump";
  const solarPanels = state.products.filter((product) => product.category === "Solar");
  const solarInverters = state.products.filter((product) => product.category === "Inverter");
  const solarBatteries = state.products.filter((product) => product.category === "Solar Battery");
  const heatPumpProducts = state.products.filter((product) => product.category === "Heat Pump");
  const [solarPanelProduct, setSolarPanelProduct] = useState(solarPanels[0]?.id ?? "");
  const [solarPanelQty, setSolarPanelQty] = useState(0);
  const [solarPanelPrice, setSolarPanelPrice] = useState(0);
  const [solarInverterProduct, setSolarInverterProduct] = useState(solarInverters[0]?.id ?? "");
  const [solarInverterQty, setSolarInverterQty] = useState(0);
  const [solarInverterPrice, setSolarInverterPrice] = useState(0);
  const [solarBatteryProduct, setSolarBatteryProduct] = useState(solarBatteries[0]?.id ?? "");
  const [solarBatteryQty, setSolarBatteryQty] = useState(0);
  const [solarBatteryPrice, setSolarBatteryPrice] = useState(0);
  const [solarInstall, setSolarInstall] = useState(0);
  const [solarGstOn, setSolarGstOn] = useState("yes");
  const [solarStcCount, setSolarStcCount] = useState(0);
  const [solarStcPrice, setSolarStcPrice] = useState(40);
  const [solarVeuCount, setSolarVeuCount] = useState(0);
  const [solarVeuPrice, setSolarVeuPrice] = useState(75);
  const [solarAdditionalDiscount, setSolarAdditionalDiscount] = useState(0);
  const [heatPumpProduct, setHeatPumpProduct] = useState(heatPumpProducts[0]?.id ?? "");
  const [heatPumpQty, setHeatPumpQty] = useState(0);
  const [heatPumpPrice, setHeatPumpPrice] = useState(0);
  const [heatPumpInstall, setHeatPumpInstall] = useState(0);
  const [heatPumpGstOn, setHeatPumpGstOn] = useState("yes");
  const [heatPumpVeuCount, setHeatPumpVeuCount] = useState(0);
  const [heatPumpVeuRate, setHeatPumpVeuRate] = useState(75);
  const [heatPumpStcCount, setHeatPumpStcCount] = useState(0);
  const [heatPumpStcRate, setHeatPumpStcRate] = useState(40);
  const activeSolarPanelProduct = solarPanels.some((product) => product.id === solarPanelProduct) ? solarPanelProduct : (solarPanels[0]?.id ?? "");
  const activeSolarInverterProduct = solarInverters.some((product) => product.id === solarInverterProduct) ? solarInverterProduct : (solarInverters[0]?.id ?? "");
  const activeSolarBatteryProduct = solarBatteries.some((product) => product.id === solarBatteryProduct) ? solarBatteryProduct : (solarBatteries[0]?.id ?? "");
  const activeHeatPumpProduct = heatPumpProducts.some((product) => product.id === heatPumpProduct) ? heatPumpProduct : (heatPumpProducts[0]?.id ?? "");

  function changeProductCategory(value: string) {
    setProductCategory(value);
    setProductBrand("All");
    setProductType("All");
    setProductConfiguration("All");
    setScheme((schemesByCategory[value] ?? schemes)[0]);
    setOutdoorModel("");
    setHeadModel("");
  }

  function setSelectedProductPrice(productId: string, setter: (value: number) => void) {
    const product = state.products.find((item) => item.id === productId);
    setter(product?.price ?? 0);
  }

  function changeProductBrand(value: string) {
    setProductBrand(value);
    setProductType("All");
    setProductConfiguration("All");
    setOutdoorModel("");
    setHeadModel("");
  }

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
    setItems((current) => [
      lineFromProduct(product, "Outdoor Unit", baseline, 0, 1, 0, 0, 0, "Outdoor unit included in combined system price"),
      ...current.filter((item) => item.role !== "Outdoor Unit"),
    ]);
    setMessage(`${product.model ?? product.productName} added as outdoor unit.`);
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
    setItems((current) => [...current, lineFromProduct(product, "Indoor Head", headArea, headAreaM2, quantity, productPrice || product.price, installPrice, certificates, "Indoor + outdoor combined system price")]);
    setMessage(`${product.model ?? product.productName} added with combined indoor/outdoor system price.`);
  }

  function addProductLine() {
    const product = quoteProducts.find((item) => item.id === selectedProductModel);
    if (!product) {
      setMessage("Import or select a product first.");
      return;
    }
    setItems((current) => [...current, lineFromProduct(product, "Product", product.category, 0, quantity, productPrice || product.price, installPrice, certificates, `${product.category} product line`)]);
    setMessage(`${product.model ?? product.productName} added as a product line.`);
  }

  function buildSolarSystem() {
    const nextItems: QuoteLineItem[] = [];
    const panel = state.products.find((item) => item.id === activeSolarPanelProduct);
    const inverter = state.products.find((item) => item.id === activeSolarInverterProduct);
    const battery = state.products.find((item) => item.id === activeSolarBatteryProduct);
    if (panel && solarPanelQty > 0) nextItems.push(lineFromProduct(panel, "Product", "Solar Panels", 0, solarPanelQty, solarPanelPrice || panel.price, 0, 0, "Solar panel product"));
    if (inverter && solarInverterQty > 0) nextItems.push(lineFromProduct(inverter, "Product", "Inverter", 0, solarInverterQty, solarInverterPrice || inverter.price, 0, 0, "Inverter product"));
    if (battery && solarBatteryQty > 0) nextItems.push(lineFromProduct(battery, "Product", "Battery", 0, solarBatteryQty, solarBatteryPrice || battery.price, 0, 0, "Battery product"));
    if (solarInstall > 0) nextItems.push(customLine("Install", "Installation", "Solar installation", 1, 0, solarInstall, 0, "Installation cost"));
    if (!nextItems.length) {
      setMessage("Select at least one solar product before generating items.");
      return;
    }
    const totalCertificates = solarStcCount + solarVeuCount;
    const totalCertificateValue = solarStcCount * solarStcPrice + solarVeuCount * solarVeuPrice;
    setCertificateRate(totalCertificates ? totalCertificateValue / totalCertificates : certificateRate);
    setRebate(Number(rebate) + solarAdditionalDiscount);
    setGstRate(solarGstOn === "yes" ? 10 : 0);
    setItems(nextItems.map((item, index) => index === 0 ? { ...item, certificates: totalCertificates } : item));
    setMessage("Solar panel, inverter, battery, installation, and rebate fields copied into quote items.");
  }

  function buildHeatPumpSystem() {
    const product = state.products.find((item) => item.id === activeHeatPumpProduct);
    if (!product || heatPumpQty <= 0) {
      setMessage("Select a heat pump product and quantity first.");
      return;
    }
    const totalCertificates = heatPumpVeuCount + heatPumpStcCount;
    const totalCertificateValue = heatPumpVeuCount * heatPumpVeuRate + heatPumpStcCount * heatPumpStcRate;
    setCertificateRate(totalCertificates ? totalCertificateValue / totalCertificates : certificateRate);
    setGstRate(heatPumpGstOn === "yes" ? 10 : 0);
    setItems([
      lineFromProduct(product, "Product", "Heat Pump", 0, heatPumpQty, heatPumpPrice || product.price, heatPumpInstall, totalCertificates, "Hot-water heat pump with VEU/STC rebate fields"),
    ]);
    setMessage("Heat pump product, installation, and rebate fields copied into quote items.");
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

  function applyVictoriaRebates() {
    const automatic = calculateVictoriaRebates(productCategory, items, addons, {
      certificateRate,
      minimumContributionAdjustment,
      gstRate,
      depositPercent,
    });
    setRebate(automatic.rebate);
    setSolarVicLoan(automatic.solarVicLoan);
    setMessage(automatic.message);
  }

  function buildQuote(status: QuoteRecord["status"], quoteId: string): QuoteRecord {
    return {
      id: quoteId,
      customerId: customer?.id ?? "",
      productCategory: productCategory === "All" ? firstQuoteCategory(items, state.products) : productCategory as QuoteRecord["productCategory"],
      description: description || customer?.name || customer?.businessName || "",
      scheme: activeScheme,
      activityDate,
      priceTier: priceTiers[0],
      installationCostTier: installTiers[0],
      items,
      additionalServices: addons,
      certificateRate,
      minimumContributionAdjustment,
      gstRate,
      rebate,
      solarVicLoan,
      depositPercent,
      annualEnergyProductionKwh,
      discountedPaybackYears,
      annualBillSavings,
      status,
    };
  }

  function saveQuote(status: QuoteRecord["status"], openProposal = false, forceNew = false) {
    if (!customer) {
      setMessage("Select a customer first.");
      return;
    }
    const existingQuote = !forceNew && currentQuoteId ? state.quotes.find((quote) => quote.id === currentQuoteId) : undefined;
    const quoteId = existingQuote?.id ?? nextQuoteId(state.quotes);
    const quote = buildQuote(status, quoteId);
    setState(syncProposalCollections(state, quote, customer));
    window.localStorage.setItem(`saveplanet-quote-${quote.id}`, JSON.stringify(quote));
    setCurrentQuoteId(quote.id);
    setMessage(status === "Draft" ? "Draft proposal created." : existingQuote ? "Quote updated." : forceNew ? "New quote saved." : "Quote saved.");
    if (openProposal) {
      router.push(`/quotes/${quote.id}/proposal`);
    }
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Quote maker" title="Proposal calculator" />
      <div className="space-y-6 p-4 md:p-8">
        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Main Record" />
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[#657267]">Customer</span>
              <select value={activeSelectedCustomerId} onChange={(event) => selectCustomer(event.target.value)} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.id.replace("C-", "")}] {item.name || item.businessName}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Select label="Scheme" value={activeScheme} options={schemeOptions} onChange={setScheme} />
            <Input label="Activity Date" type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} />
          </div>
        </section>

        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <SectionTitle title="Products" />
          <div className="grid gap-6 p-5 xl:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Select label="Category" value={productCategory} options={productCategories} onChange={changeProductCategory} />
              <Select label="Brand" value={activeBrand} options={brandOptions} onChange={changeProductBrand} />
              <Input label="Search product" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Brand, model, class..." />
              {isSolarCategory ? (
                <>
                  <ModuleCard title="Solar Panels" badge="Required">
                    <Select label="Panel Product" value={activeSolarPanelProduct} options={solarPanels.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarPanels, value))} onChange={(value) => { setSolarPanelProduct(value); setSelectedProductPrice(value, setSolarPanelPrice); }} />
                    <NumberInput label="Quantity" value={solarPanelQty} onChange={setSolarPanelQty} />
                    <NumberInput label="Price per unit (AUD)" value={solarPanelPrice} onChange={setSolarPanelPrice} />
                  </ModuleCard>
                  <ModuleCard title="Inverter" badge="Required">
                    <Select label="Inverter Product" value={activeSolarInverterProduct} options={solarInverters.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarInverters, value))} onChange={(value) => { setSolarInverterProduct(value); setSelectedProductPrice(value, setSolarInverterPrice); }} />
                    <NumberInput label="Quantity" value={solarInverterQty} onChange={setSolarInverterQty} />
                    <NumberInput label="Price per unit (AUD)" value={solarInverterPrice} onChange={setSolarInverterPrice} />
                  </ModuleCard>
                  <ModuleCard title="Battery" badge="Optional">
                    <Select label="Battery Product" value={activeSolarBatteryProduct} options={solarBatteries.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarBatteries, value))} onChange={(value) => { setSolarBatteryProduct(value); setSelectedProductPrice(value, setSolarBatteryPrice); }} />
                    <NumberInput label="Quantity" value={solarBatteryQty} onChange={setSolarBatteryQty} />
                    <NumberInput label="Price per unit (AUD)" value={solarBatteryPrice} onChange={setSolarBatteryPrice} />
                  </ModuleCard>
                  <ModuleCard title="Installation" badge="GST">
                    <NumberInput label="Installation Cost (AUD)" value={solarInstall} onChange={setSolarInstall} />
                    <Select label="Apply GST (10%)" value={solarGstOn} options={["yes", "no"]} labelFor={(value) => value === "yes" ? "Yes - include GST" : "No"} onChange={setSolarGstOn} />
                  </ModuleCard>
                  <ModuleCard title="Rebates" badge="Auto-deducted">
                    <NumberInput label="STC Count" value={solarStcCount} onChange={setSolarStcCount} />
                    <NumberInput label="STC Price (AUD per certificate)" value={solarStcPrice} onChange={setSolarStcPrice} />
                    <NumberInput label="VEU Count (battery only)" value={solarVeuCount} onChange={setSolarVeuCount} />
                    <NumberInput label="VEU Price (AUD per certificate)" value={solarVeuPrice} onChange={setSolarVeuPrice} />
                    <NumberInput label="Solar Victoria Rebate (AUD)" value={rebate} onChange={setRebate} />
                    <NumberInput label="Solar Victoria Loan (AUD)" value={solarVicLoan} onChange={setSolarVicLoan} />
                    <NumberInput label="Additional Discount (AUD)" value={solarAdditionalDiscount} onChange={setSolarAdditionalDiscount} />
                  </ModuleCard>
                  <button onClick={buildSolarSystem} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Generate solar quote items</button>
                </>
              ) : isHeatPumpCategory ? (
                <>
                  <ModuleCard title="Product" badge="Heat Pump">
                    <Select label="Product" value={activeHeatPumpProduct} options={heatPumpProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(heatPumpProducts, value))} onChange={(value) => { setHeatPumpProduct(value); setSelectedProductPrice(value, setHeatPumpPrice); }} />
                    <NumberInput label="Quantity" value={heatPumpQty} onChange={setHeatPumpQty} />
                    <NumberInput label="Price per unit (AUD)" value={heatPumpPrice} onChange={setHeatPumpPrice} />
                    <NumberInput label="Installation Cost (AUD)" value={heatPumpInstall} onChange={setHeatPumpInstall} />
                    <Select label="Apply GST (10%)" value={heatPumpGstOn} options={["yes", "no"]} labelFor={(value) => value === "yes" ? "Yes - include GST" : "No"} onChange={setHeatPumpGstOn} />
                  </ModuleCard>
                  <ModuleCard title="Rebates" badge="VEU + STC">
                    <NumberInput label="VEU Count" value={heatPumpVeuCount} onChange={setHeatPumpVeuCount} />
                    <NumberInput label="VEU Rate (AUD)" value={heatPumpVeuRate} onChange={setHeatPumpVeuRate} />
                    <NumberInput label="STC Count" value={heatPumpStcCount} onChange={setHeatPumpStcCount} />
                    <NumberInput label="STC Rate (AUD)" value={heatPumpStcRate} onChange={setHeatPumpStcRate} />
                    <NumberInput label="Solar Victoria Rebate (AUD)" value={rebate} onChange={setRebate} />
                  </ModuleCard>
                  <button onClick={buildHeatPumpSystem} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Generate heat pump quote items</button>
                </>
              ) : isAirconCategory ? (
                <>
                  <Select label="Outdoor Unit (always outside)" value={selectedOutdoorModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setOutdoorModel} />
                  <div className="pb-2">
                    <button onClick={addOutdoor} className="h-10 w-full rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add selected as outdoor unit</button>
                  </div>
                  <Select label="Product Type" value={activeProductType} options={productTypeOptions} onChange={setProductType} />
                  <Select label="Product Configuration" value={activeProductConfiguration} options={productConfigurationOptions} onChange={setProductConfiguration} />
                  <Select label="Indoor Head (up to 4)" value={selectedHeadModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setHeadModel} />
                  <Select label="Original Equipment" value={baseline} options={baselineOptions} onChange={setBaseline} />
                  <Input label="Area" value={headArea} onChange={(event) => setHeadArea(event.target.value)} />
                  <NumberInput label="Area (m2)" value={headAreaM2} onChange={setHeadAreaM2} />
                  <NumberInput label="Upgrade Quantity" value={quantity} onChange={setQuantity} />
                  <NumberInput label="Combined indoor + outdoor price (per unit), $" value={productPrice} onChange={setProductPrice} />
                  <NumberInput label="Install Cost, $" value={installPrice} onChange={setInstallPrice} />
                  <NumberInput label="Certificates" value={certificates} onChange={setCertificates} />
                  <button onClick={addHead} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add combined system line</button>
                </>
              ) : (
                <>
                  <Select label="Product" value={selectedProductModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setHeadModel} />
                  <NumberInput label="Quantity" value={quantity} onChange={setQuantity} />
                  <NumberInput label="Product Price (per unit), $" value={productPrice} onChange={setProductPrice} />
                  <NumberInput label="Install Cost, $" value={installPrice} onChange={setInstallPrice} />
                  <NumberInput label="Certificates" value={certificates} onChange={setCertificates} />
                  <button onClick={addProductLine} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add product line</button>
                </>
              )}
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
            <Select label="Is the building at least 2 years old?" value={buildingAgeAnswer} options={["Yes", "No", "New Install - No decommissioning required"]} onChange={setBuildingAgeAnswer} />
            <Input label="Inclusions And Exclusions" value={inclusions} onChange={(event) => setInclusions(event.target.value)} placeholder="Optional" />
            <Select label="Form of benefit provided?" value={benefitForm} options={["Point of sale discount", "Cashback", "Invoice credit"]} onChange={setBenefitForm} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
            <SectionTitle title="Calculation Results" />
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <NumberInput label="Certificate Rate" value={certificateRate} onChange={setCertificateRate} />
              <NumberInput label="Minimum Contribution Adjustment" value={minimumContributionAdjustment} onChange={setMinimumContributionAdjustment} />
              <NumberInput label="GST Rate %" value={gstRate} onChange={setGstRate} />
              <NumberInput label="Victorian Rebate" value={rebate} onChange={setRebate} />
              <NumberInput label="Solar VIC Interest Free Loan" value={solarVicLoan} onChange={setSolarVicLoan} />
              <NumberInput label="Deposit %" value={depositPercent} onChange={setDepositPercent} />
              <NumberInput label="Annual Energy Production (kWh)" value={annualEnergyProductionKwh} onChange={setAnnualEnergyProductionKwh} />
              <NumberInput label="Discounted Payback (years)" value={discountedPaybackYears} onChange={setDiscountedPaybackYears} />
              <NumberInput label="Annual Bill Savings" value={annualBillSavings} onChange={setAnnualBillSavings} />
            </div>
            <div className="px-5 pb-4">
              <button onClick={applyVictoriaRebates} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#eef4ff] px-4 text-sm font-semibold text-[#003CBB]">
                <Calculator size={16} /> Auto calculate Victorian rebates
              </button>
              <p className="mt-2 text-xs leading-5 text-[#657267]">
                Uses official Solar Victoria rules: rebate is 50% of the purchase price after STC/VEEC discounts. Solar PV is capped at $1,400 with a matching interest-free loan. Hot water is capped at $1,000, or $1,400 when the selected product brand is locally made eligible.
              </p>
            </div>
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
              <Result label="Certificates Created" value={`${calculations.certificates.toFixed(2)} @ ${certificateRate.toFixed(2)}`} />
              <Result label="System total (incl. GST)" value={currency(calculations.systemTotalIncGst)} />
              <Result label="GST" value={currency(calculations.gstAmount)} />
              <Result label="Certificate discount" value={`-${currency(calculations.certificateDiscount)}`} />
              <Result label="Victorian rebate" value={`-${currency(rebate)}`} />
              <Result label="Interest-free loan" value={`-${currency(solarVicLoan)}`} />
              <Result label="Total deductions" value={`-${currency(calculations.totalDeductions)}`} />
              <Result label="Final price (incl. GST)" value={currency(calculations.finalPriceIncGst)} strong />
              <Result label="Deposit" value={currency(calculations.depositAmount)} />
              <Result label="Balance due" value={currency(calculations.balanceDue)} />
              <Result label="Annual Energy Production" value={`${annualEnergyProductionKwh.toLocaleString()} kWh`} />
              <Result label="Discounted Payback" value={`${discountedPaybackYears || 0} year(s)`} />
              <Result label="Annual Bill Savings" value={currency(annualBillSavings)} />
            </div>
          </div>
          <div className="rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Final actions</h2>
            {message ? <p className="mt-3 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
            <div className="mt-4 grid gap-2">
              <button onClick={() => saveQuote("Saved", true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white"><Save size={16} /> Save</button>
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

function customLine(role: QuoteLineItem["role"], brand: string, model: string, quantity: number, productPrice: number, installPrice: number, certificates: number, notes: string): QuoteLineItem {
  return {
    id: `${role}-${brand}-${model}-${Date.now()}`,
    role,
    model,
    brand,
    area: brand,
    areaM2: 0,
    recommendedHeatingOutput: "",
    quantity,
    productPrice,
    installPrice,
    certificates,
    notes,
  };
}

function firstQuoteCategory(items: QuoteLineItem[], products: Product[]) {
  const productId = items.find((item) => item.productId)?.productId;
  return products.find((product) => product.id === productId)?.category ?? "Aircon";
}

function nextQuoteId(quotes: QuoteRecord[]) {
  const highest = quotes.reduce((max, quote) => {
    const numericId = Number(quote.id.replace(/\D/g, ""));
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 1000);
  return `Q-${highest + 1}`;
}

function recommendedHeatingOutput(areaM2: number) {
  if (areaM2 <= 20) return "2.5 to 3 kW";
  if (areaM2 <= 40) return "3 to 5 kW";
  if (areaM2 <= 60) return "5 to 8 kW";
  return "+8 kW";
}

function calculateQuote(
  items: QuoteLineItem[],
  addons: QuoteLineItem[],
  options: {
    certificateRate: number;
    minimumContributionAdjustment: number;
    gstRate: number;
    rebate: number;
    solarVicLoan: number;
    depositPercent: number;
  },
) {
  const allItems = [...items, ...addons];
  const certificates = allItems.reduce((sum, item) => sum + item.certificates * item.quantity, 0);
  const certificateDiscount = certificates * options.certificateRate;
  const productCost = allItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  const installCost = allItems.reduce((sum, item) => sum + item.installPrice * item.quantity, 0);
  const totalCost = productCost + installCost + options.minimumContributionAdjustment;
  const systemTotalIncGst = totalCost * (1 + options.gstRate / 100);
  const gstAmount = systemTotalIncGst - totalCost;
  const totalDeductions = certificateDiscount + options.rebate + options.solarVicLoan;
  const finalPriceIncGst = Math.max(0, systemTotalIncGst - totalDeductions);
  const depositAmount = finalPriceIncGst * (options.depositPercent / 100);
  const balanceDue = Math.max(0, finalPriceIncGst - depositAmount);
  const netExGst = Math.max(0, finalPriceIncGst / (1 + options.gstRate / 100));
  const netIncGst = finalPriceIncGst;
  return { certificates, certificateDiscount, productCost, installCost, totalCost, systemTotalIncGst, gstAmount, totalDeductions, finalPriceIncGst, depositAmount, balanceDue, netExGst, netIncGst };
}

function calculateVictoriaRebates(
  category: string,
  items: QuoteLineItem[],
  addons: QuoteLineItem[],
  options: {
    certificateRate: number;
    minimumContributionAdjustment: number;
    gstRate: number;
    depositPercent: number;
  },
) {
  const base = calculateQuote(items, addons, {
    ...options,
    rebate: 0,
    solarVicLoan: 0,
  });
  const purchasePriceAfterOtherDiscounts = Math.max(0, base.systemTotalIncGst - base.certificateDiscount);
  const officialHalfRate = purchasePriceAfterOtherDiscounts * 0.5;
  const result = {
    rebate: 0,
    solarVicLoan: 0,
    message: "Victorian rebate fields recalculated.",
  };

  if (category === "Solar" || category === "Inverter") {
    const pvRebate = Math.min(1400, officialHalfRate);
    result.rebate = roundMoney(pvRebate);
    result.solarVicLoan = roundMoney(pvRebate);
    result.message = "Official Solar Victoria PV rebate applied: 50% of purchase price after STC/VEEC discounts, capped at $1,400. PV interest-free loan matched to the rebate amount.";
    return result;
  }

  if (category === "Heat Pump") {
    const locallyMadeCap = hasLocallyMadeHotWaterProduct(items) ? 1400 : 1000;
    result.rebate = roundMoney(Math.min(locallyMadeCap, officialHalfRate));
    result.message = `Official Solar Victoria hot water rebate applied: 50% of purchase price after STC/VEEC discounts, capped at ${currency(locallyMadeCap)}${locallyMadeCap === 1400 ? " for a locally made eligible product." : "."}`;
    return result;
  }

  if (category === "Solar Battery") {
    result.message = "Solar Victoria battery incentive is not auto-applied here because the interest-free battery loan is closed. Enter any separate eligible battery discount manually.";
    return result;
  }

  if (category === "Aircon") {
    result.message = "Aircon rebate is handled through the VEU certificate discount. Enter approved VEEC certificates and rate, then this calculator applies the discount automatically.";
    return result;
  }

  return result;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function hasLocallyMadeHotWaterProduct(items: QuoteLineItem[]) {
  const locallyMadeBrands = ["Dux", "Earthworker", "Everhot", "Reclaim", "Rheem", "Rinnai", "Sanden", "Solahart", "Thermann", "Wilson"];
  return items.some((item) => locallyMadeBrands.some((brand) => item.brand.toLowerCase().includes(brand.toLowerCase())));
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

function ModuleCard({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#d9e2f2] bg-[#f8fbff] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#0f172a]">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#003CBB] shadow-sm">{badge}</span>
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
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
