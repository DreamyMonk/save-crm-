"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
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
const quoteTabs = [
  {
    label: "Air Conditioner",
    category: "Aircon",
    categories: ["Aircon"],
    templateName: "Air Con Proposal",
    templatePath: "/saveplanet-aircon-proposal-template.html",
  },
  {
    label: "Solar",
    category: "Solar",
    categories: ["Solar", "Inverter", "Solar Battery"],
    templateName: "Solar / Battery Proposal",
    templatePath: "/saveplanet-solar-proposal-template.html",
  },
  {
    label: "Hot Water",
    category: "Heat Pump",
    categories: ["Heat Pump"],
    templateName: "Hot Water Upgrade Proposal",
    templatePath: "/saveplanet-hot-water-proposal-template.html",
  },
];

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
  const minimumContributionAdjustment = 0;
  const gstRate = 10;
  const [rebate, setRebate] = useState(0);
  const [solarVicLoan, setSolarVicLoan] = useState(0);
  const depositPercent = 50;
  const annualEnergyProductionKwh = 0;
  const discountedPaybackYears = 0;
  const annualBillSavings = 0;
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [addons, setAddons] = useState<QuoteLineItem[]>([]);
  const [addonName, setAddonName] = useState("");
  const [addonQty, setAddonQty] = useState(1);
  const [addonPrice, setAddonPrice] = useState(0);
  const [message, setMessage] = useState("");
  const [currentQuoteId, setCurrentQuoteId] = useState("");
  const activeSelectedCustomerId = customers.some((item) => item.id === selectedCustomerId) ? selectedCustomerId : (customers[0]?.id ?? "");
  const customer = customers.find((item) => item.id === activeSelectedCustomerId);
  const isAirconCategory = productCategory === "Aircon";
  const selectedOutdoorModel = quoteProducts.some((product) => product.id === outdoorModel) ? outdoorModel : (quoteProducts[0]?.id ?? "");
  const selectedHeadModel = quoteProducts.some((product) => product.id === headModel) ? headModel : (quoteProducts[0]?.id ?? "");
  const selectedProductModel = quoteProducts.some((product) => product.id === headModel) ? headModel : (quoteProducts[0]?.id ?? "");
  const isSolarCategory = productCategory === "Solar" || productCategory === "Inverter" || productCategory === "Solar Battery";
  const isHeatPumpCategory = productCategory === "Heat Pump";
  const solarFilteredProducts = useMemo(() => filterProductsForQuote(state.products, ["Solar", "Inverter", "Solar Battery"], activeBrand, activeProductType, activeProductConfiguration, productSearch), [activeBrand, activeProductConfiguration, activeProductType, productSearch, state.products]);
  const heatPumpProducts = useMemo(() => filterProductsForQuote(state.products, ["Heat Pump"], activeBrand, activeProductType, activeProductConfiguration, productSearch), [activeBrand, activeProductConfiguration, activeProductType, productSearch, state.products]);
  const solarPanels = solarFilteredProducts.filter((product) => product.category === "Solar");
  const solarInverters = solarFilteredProducts.filter((product) => product.category === "Inverter");
  const solarBatteries = solarFilteredProducts.filter((product) => product.category === "Solar Battery");
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
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
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
  const activeQuoteTab = quoteTabs.find((tab) => tab.categories.includes(productCategory)) ?? quoteTabs[0];
  const quoteDraft = buildQuoteDraft();
  const calculations = calculateQuote(quoteDraft.items, addons, {
    certificateRate: quoteDraft.certificateRate,
    minimumContributionAdjustment,
    gstRate: quoteDraft.gstRate,
    rebate: quoteDraft.rebate,
    solarVicLoan: quoteDraft.solarVicLoan,
    depositPercent,
  });
  const deductionRows = buildDeductionRows(quoteDraft, calculations);

  function changeProductCategory(value: string) {
    setProductCategory(value);
    setProductBrand("All");
    setProductType("All");
    setProductConfiguration("All");
    setScheme((schemesByCategory[value] ?? schemes)[0]);
    setOutdoorModel("");
    setHeadModel("");
  }

  function switchQuoteTab(category: string) {
    const nextTab = quoteTabs.find((tab) => tab.category === category);
    changeProductCategory(category);
    setMessage(nextTab ? `${nextTab.label} fields loaded with ${nextTab.templateName}.` : "Quote fields loaded.");
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

  function buildQuoteDraft() {
    if (isSolarCategory) {
      const nextItems: QuoteLineItem[] = [];
      const panel = state.products.find((item) => item.id === activeSolarPanelProduct);
      const inverter = state.products.find((item) => item.id === activeSolarInverterProduct);
      const battery = state.products.find((item) => item.id === activeSolarBatteryProduct);
      if (panel && solarPanelQty > 0) nextItems.push(lineFromProduct(panel, "Product", "Solar Panels", 0, solarPanelQty, solarPanelPrice || panel.price, 0, 0, "Solar panel product"));
      if (inverter && solarInverterQty > 0) nextItems.push(lineFromProduct(inverter, "Product", "Inverter", 0, solarInverterQty, solarInverterPrice || inverter.price, 0, 0, "Inverter product"));
      if (battery && solarBatteryQty > 0) nextItems.push(lineFromProduct(battery, "Product", "Battery", 0, solarBatteryQty, solarBatteryPrice || battery.price, 0, 0, "Battery product"));
      if (solarInstall > 0) nextItems.push(customLine("Install", "Installation", "Solar installation", 1, 0, solarInstall, 0, "Installation cost"));
      const stcDiscount = solarStcCount * solarStcPrice;
      const veuDiscount = solarVeuCount * solarVeuPrice;
      const totalCertificates = solarStcCount + solarVeuCount;
      const totalCertificateValue = stcDiscount + veuDiscount;
      return {
        items: nextItems.map((item, index) => index === 0 ? { ...item, certificates: totalCertificates } : item),
        certificateRate: totalCertificates ? totalCertificateValue / totalCertificates : certificateRate,
        gstRate: solarGstOn === "yes" ? 10 : 0,
        rebate: Number(rebate) + additionalDiscount,
        solarVicLoan,
        deductions: {
          stcDiscount,
          veuDiscount,
          solarVictoriaRebate: Number(rebate),
          solarVictoriaLoan: solarVicLoan,
          additionalDiscount,
          airconVeuDiscount: 0,
        },
      };
    }

    if (isHeatPumpCategory) {
      const product = state.products.find((item) => item.id === activeHeatPumpProduct);
      const stcDiscount = heatPumpStcCount * heatPumpStcRate;
      const veuDiscount = heatPumpVeuCount * heatPumpVeuRate;
      const totalCertificates = heatPumpVeuCount + heatPumpStcCount;
      const totalCertificateValue = veuDiscount + stcDiscount;
      return {
        items: product && heatPumpQty > 0
          ? [lineFromProduct(product, "Product", "Heat Pump", 0, heatPumpQty, heatPumpPrice || product.price, heatPumpInstall, totalCertificates, "Hot-water heat pump with VEU/STC rebate fields")]
          : [],
        certificateRate: totalCertificates ? totalCertificateValue / totalCertificates : certificateRate,
        gstRate: heatPumpGstOn === "yes" ? 10 : 0,
        rebate: Number(rebate) + additionalDiscount,
        solarVicLoan: 0,
        deductions: {
          stcDiscount,
          veuDiscount,
          solarVictoriaRebate: Number(rebate),
          solarVictoriaLoan: 0,
          additionalDiscount,
          airconVeuDiscount: 0,
        },
      };
    }

    return {
      items,
      certificateRate,
      gstRate,
      rebate: additionalDiscount,
      solarVicLoan,
      deductions: {
        stcDiscount: 0,
        veuDiscount: 0,
        solarVictoriaRebate: 0,
        solarVictoriaLoan: 0,
        additionalDiscount,
        airconVeuDiscount: items.reduce((sum, item) => sum + item.certificates * item.quantity, 0) * certificateRate,
      },
    };
  }

  function buildDeductionRows(draft: ReturnType<typeof buildQuoteDraft>, currentCalculations: ReturnType<typeof calculateQuote>) {
    if (isSolarCategory) {
      return visibleDeductionRows([
        { label: "STC rebate", value: draft.deductions.stcDiscount },
        { label: "VEU rebate", value: draft.deductions.veuDiscount },
        { label: "Solar Victoria rebate", value: draft.deductions.solarVictoriaRebate },
        { label: "Solar Victoria loan", value: draft.deductions.solarVictoriaLoan },
        { label: "Additional rebate", value: draft.deductions.additionalDiscount },
      ]);
    }
    if (isHeatPumpCategory) {
      return visibleDeductionRows([
        { label: "VEU rebate", value: draft.deductions.veuDiscount },
        { label: "STC rebate", value: draft.deductions.stcDiscount },
        { label: "Solar Victoria rebate", value: draft.deductions.solarVictoriaRebate },
        { label: "Additional rebate", value: draft.deductions.additionalDiscount },
      ]);
    }
    return visibleDeductionRows([
      { label: "VEU rebate", value: draft.deductions.airconVeuDiscount || currentCalculations.certificateDiscount },
      { label: "Additional rebate", value: draft.deductions.additionalDiscount },
    ]);
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

  function removeAddon(itemId: string) {
    setAddons((current) => current.filter((item) => item.id !== itemId));
  }

  function buildQuote(status: QuoteRecord["status"], quoteId: string, draft = quoteDraft): QuoteRecord {
    return {
      id: quoteId,
      customerId: customer?.id ?? "",
      productCategory: productCategory === "All" ? firstQuoteCategory(items, state.products) : productCategory as QuoteRecord["productCategory"],
      description: description || customer?.name || customer?.businessName || "",
      scheme: activeScheme,
      activityDate,
      priceTier: priceTiers[0],
      installationCostTier: installTiers[0],
      items: draft.items,
      additionalServices: addons,
      certificateRate: draft.certificateRate,
      minimumContributionAdjustment,
      gstRate: draft.gstRate,
      rebate: draft.rebate,
      solarVicLoan: draft.solarVicLoan,
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
    const draft = buildQuoteDraft();
    if ((isSolarCategory || isHeatPumpCategory) && !draft.items.length) {
      setMessage(`Select at least one ${isSolarCategory ? "solar" : "heat pump"} product before generating the invoice.`);
      return;
    }
    const existingQuote = !forceNew && currentQuoteId ? state.quotes.find((quote) => quote.id === currentQuoteId) : undefined;
    const quoteId = existingQuote?.id ?? nextQuoteId(state.quotes);
    const quote = buildQuote(status, quoteId, draft);
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
      <PageHeader eyebrow="Quote maker v2" title={`${productCategory} Quote`} />
      <div className="p-4 md:p-8">
        <div className="mb-5 rounded-lg border border-[#d9e2f2] bg-white p-2 shadow-sm">
          <div className="grid gap-2 md:grid-cols-3">
            {quoteTabs.map((tab) => {
              const active = tab.categories.includes(productCategory);
              return (
                <button
                  key={tab.category}
                  type="button"
                  onClick={() => switchQuoteTab(tab.category)}
                  className={`rounded-lg px-4 py-3 text-left transition ${active ? "bg-[#003CBB] text-white" : "bg-[#f6f8fc] text-[#0f172a] hover:bg-[#eef4ff]"}`}
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className={`mt-1 block text-xs ${active ? "text-white/70" : "text-[#657267]"}`}>{tab.templateName}</span>
                </button>
              );
            })}
          </div>
        </div>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <ModuleCard title="Quote Details" badge="Required">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <Select label="Category" value={productCategory} options={productCategories.filter((item) => item !== "All")} onChange={changeProductCategory} />
                <Select label="Scheme" value={activeScheme} options={schemeOptions} onChange={setScheme} />
                <Input label="Activity Date" type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} />
              </div>
              <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </ModuleCard>

            <ModuleCard title="Product Filter" badge="Catalog">
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Brand" value={activeBrand} options={brandOptions} onChange={changeProductBrand} />
                <Select label="Product Type" value={activeProductType} options={productTypeOptions} onChange={setProductType} />
                <Input label="Search Product" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Brand, model, class..." />
              </div>
            </ModuleCard>

              {isSolarCategory ? (
                <>
                  <ModuleCard title="Solar Panels" badge="Required">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select label="Panel Product" value={activeSolarPanelProduct} options={solarPanels.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarPanels, value))} onChange={(value) => { setSolarPanelProduct(value); setSelectedProductPrice(value, setSolarPanelPrice); }} />
                      <NumberInput label="Quantity" value={solarPanelQty} onChange={setSolarPanelQty} />
                      <NumberInput label="Price per unit (AUD)" value={solarPanelPrice} onChange={setSolarPanelPrice} />
                    </div>
                  </ModuleCard>
                  <ModuleCard title="Inverter" badge="Required">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select label="Inverter Product" value={activeSolarInverterProduct} options={solarInverters.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarInverters, value))} onChange={(value) => { setSolarInverterProduct(value); setSelectedProductPrice(value, setSolarInverterPrice); }} />
                      <NumberInput label="Quantity" value={solarInverterQty} onChange={setSolarInverterQty} />
                      <NumberInput label="Price per unit (AUD)" value={solarInverterPrice} onChange={setSolarInverterPrice} />
                    </div>
                  </ModuleCard>
                  <ModuleCard title="Battery" badge="Optional">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select label="Battery Product" value={activeSolarBatteryProduct} options={solarBatteries.map((item) => item.id)} labelFor={(value) => productLabel(productById(solarBatteries, value))} onChange={(value) => { setSolarBatteryProduct(value); setSelectedProductPrice(value, setSolarBatteryPrice); }} />
                      <NumberInput label="Quantity" value={solarBatteryQty} onChange={setSolarBatteryQty} />
                      <NumberInput label="Price per unit (AUD)" value={solarBatteryPrice} onChange={setSolarBatteryPrice} />
                    </div>
                  </ModuleCard>
                  <ModuleCard title="Installation" badge="GST">
                    <div className="grid gap-3 md:grid-cols-2">
                      <NumberInput label="Installation Cost (AUD)" value={solarInstall} onChange={setSolarInstall} />
                      <Select label="Apply GST (10%)" value={solarGstOn} options={["yes", "no"]} labelFor={(value) => value === "yes" ? "Yes - include GST" : "No"} onChange={setSolarGstOn} />
                    </div>
                  </ModuleCard>
                  <ModuleCard title="Rebate" badge="Calculated">
                    <div className="grid gap-3 md:grid-cols-2">
                      <NumberInput label="STC Count" value={solarStcCount} onChange={setSolarStcCount} />
                      <NumberInput label="STC Price (AUD per certificate)" value={solarStcPrice} onChange={setSolarStcPrice} />
                      <NumberInput label="VEU Count (battery only)" value={solarVeuCount} onChange={setSolarVeuCount} />
                      <NumberInput label="VEU Price (AUD per certificate)" value={solarVeuPrice} onChange={setSolarVeuPrice} />
                      <NumberInput label="Solar Victoria Rebate (AUD)" value={rebate} onChange={setRebate} />
                      <NumberInput label="Solar Victoria Loan (AUD)" value={solarVicLoan} onChange={setSolarVicLoan} />
                    </div>
                    <NumberInput label="Additional Rebate (AUD)" value={additionalDiscount} onChange={setAdditionalDiscount} />
                  </ModuleCard>
                </>
              ) : isHeatPumpCategory ? (
                <>
                  <ModuleCard title="Product" badge="Heat Pump">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select label="Product" value={activeHeatPumpProduct} options={heatPumpProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(heatPumpProducts, value))} onChange={(value) => { setHeatPumpProduct(value); setSelectedProductPrice(value, setHeatPumpPrice); }} />
                      <NumberInput label="Quantity" value={heatPumpQty} onChange={setHeatPumpQty} />
                      <NumberInput label="Price per unit (AUD)" value={heatPumpPrice} onChange={setHeatPumpPrice} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <NumberInput label="Installation Cost (AUD)" value={heatPumpInstall} onChange={setHeatPumpInstall} />
                      <Select label="Apply GST (10%)" value={heatPumpGstOn} options={["yes", "no"]} labelFor={(value) => value === "yes" ? "Yes - include GST" : "No"} onChange={setHeatPumpGstOn} />
                    </div>
                  </ModuleCard>
                  <ModuleCard title="Rebate" badge="VEU + STC">
                    <div className="grid gap-3 md:grid-cols-2">
                      <NumberInput label="VEU Count" value={heatPumpVeuCount} onChange={setHeatPumpVeuCount} />
                      <NumberInput label="VEU Rate (AUD)" value={heatPumpVeuRate} onChange={setHeatPumpVeuRate} />
                      <NumberInput label="STC Count" value={heatPumpStcCount} onChange={setHeatPumpStcCount} />
                      <NumberInput label="STC Rate (AUD)" value={heatPumpStcRate} onChange={setHeatPumpStcRate} />
                    </div>
                    <NumberInput label="Solar Victoria Rebate (AUD)" value={rebate} onChange={setRebate} />
                    <NumberInput label="Additional Rebate (AUD)" value={additionalDiscount} onChange={setAdditionalDiscount} />
                  </ModuleCard>
                </>
              ) : isAirconCategory ? (
                <>
                  <ModuleCard title="Outdoor Unit" badge="Required">
                    <Select label="Outdoor Unit (always outside)" value={selectedOutdoorModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setOutdoorModel} />
                    <button onClick={addOutdoor} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add selected as outdoor unit</button>
                  </ModuleCard>
                  <ModuleCard title="Indoor Heads" badge="At least one required">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select label="Product Configuration" value={activeProductConfiguration} options={productConfigurationOptions} onChange={setProductConfiguration} />
                      <Select label="Indoor Head (up to 4)" value={selectedHeadModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setHeadModel} />
                      <Select label="Original Equipment" value={baseline} options={baselineOptions} onChange={setBaseline} />
                      <Input label="Area" value={headArea} onChange={(event) => setHeadArea(event.target.value)} />
                      <NumberInput label="Area (m2)" value={headAreaM2} onChange={setHeadAreaM2} />
                      <NumberInput label="Upgrade Quantity" value={quantity} onChange={setQuantity} />
                      <NumberInput label="Combined indoor + outdoor price (per unit), $" value={productPrice} onChange={setProductPrice} />
                      <NumberInput label="Install Cost, $" value={installPrice} onChange={setInstallPrice} />
                    </div>
                    <button onClick={addHead} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add combined system line</button>
                  </ModuleCard>
                  <ModuleCard title="Rebate" badge="VEU + Custom">
                    <div className="grid gap-3 md:grid-cols-2">
                      <NumberInput label="Total Certificates" value={certificates} onChange={setCertificates} />
                      <NumberInput label="VEU Rate (AUD per certificate)" value={certificateRate} onChange={setCertificateRate} />
                      <NumberInput label="Additional Rebate (AUD)" value={additionalDiscount} onChange={setAdditionalDiscount} />
                    </div>
                  </ModuleCard>
                </>
              ) : (
                <ModuleCard title="Product" badge="Required">
                  <Select label="Product" value={selectedProductModel} options={quoteProducts.map((item) => item.id)} labelFor={(value) => productLabel(productById(quoteProducts, value))} onChange={setHeadModel} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <NumberInput label="Quantity" value={quantity} onChange={setQuantity} />
                    <NumberInput label="Product Price (per unit), $" value={productPrice} onChange={setProductPrice} />
                    <NumberInput label="Install Cost, $" value={installPrice} onChange={setInstallPrice} />
                    <NumberInput label="Total Certificates" value={certificates} onChange={setCertificates} />
                    <NumberInput label="Additional Rebate (AUD)" value={additionalDiscount} onChange={setAdditionalDiscount} />
                  </div>
                  <button onClick={addProductLine} className="h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add product line</button>
                </ModuleCard>
              )}

            <ModuleCard title="Additional Costs" badge="Optional add-ons">
              <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_auto]">
                <Input label="Add-On" value={addonName} onChange={(event) => setAddonName(event.target.value)} />
                <NumberInput label="Quantity" value={addonQty} onChange={setAddonQty} />
                <NumberInput label="Price" value={addonPrice} onChange={setAddonPrice} />
                <button onClick={addService} className="mt-6 h-10 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">Add cost</button>
              </div>
              {addons.length ? (
                <div className="grid gap-2">
                  {addons.map((item) => (
                    <LineItemRow key={item.id} title={item.model} meta={`Qty ${item.quantity}`} value={currency(item.productPrice * item.quantity)} onRemove={() => removeAddon(item.id)} />
                  ))}
                </div>
              ) : null}
            </ModuleCard>

          </div>

          <aside className="h-fit rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm xl:sticky xl:top-24">
            <div>
              <span className="text-xs font-bold uppercase text-[#657267]">Live calculation</span>
              <h2 className="mt-1 text-xl font-semibold">{productCategory} Summary</h2>
            </div>
            <a
              href={activeQuoteTab.templatePath}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block rounded-lg border border-[#d9e2f2] bg-[#f8fbff] p-3 text-sm hover:border-[#003CBB]"
            >
              <span className="block text-xs font-bold uppercase text-[#657267]">Template</span>
              <span className="mt-1 block font-semibold text-[#003CBB]">{activeQuoteTab.templateName}</span>
            </a>
            <div className="mt-5 divide-y divide-[#e5edf7] text-sm">
              <SummaryRow label="Products" value={currency(quoteDraft.items.reduce((sum, item) => sum + item.productPrice * item.quantity, 0))} />
              <SummaryRow label="Installation" value={currency(quoteDraft.items.reduce((sum, item) => sum + item.installPrice * item.quantity, 0))} />
              <SummaryRow label="Additional costs" value={currency(addons.reduce((sum, item) => sum + item.productPrice * item.quantity, 0))} />
              <SummaryRow label="Subtotal" value={currency(calculations.totalCost)} strong />
              <SummaryRow label={`GST (${quoteDraft.gstRate}%)`} value={currency(calculations.gstAmount)} />
              <SummaryRow label="Total (incl. GST)" value={currency(calculations.systemTotalIncGst)} strong />
              {deductionRows.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={`-${currency(row.value)}`} discount />
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-[#003CBB] p-4 text-white">
              <p className="text-xs font-semibold uppercase text-white/70">Final Price</p>
              <p className="mt-1 text-3xl font-bold">{currency(calculations.finalPriceIncGst)}</p>
            </div>
            {message ? <p className="mt-3 rounded-lg bg-[#eef4ff] p-3 text-sm font-semibold text-[#003CBB]">{message}</p> : null}
            <div className="mt-4 grid gap-2">
              <button onClick={() => saveQuote("Saved", true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white"><Save size={16} /> Generate Proposal</button>
            </div>
          </aside>
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

function filterProductsForQuote(products: Product[], categories: string[], brand: string, productType: string, productConfiguration: string, search: string) {
  const term = search.trim().toLowerCase();
  return products.filter((product) => {
    const matchesCategory = categories.includes(product.category);
    const matchesBrand = brand === "All" || displayBrandForCategory(product.category, product.brandName) === brand;
    const matchesType = productType === "All" || product.productType === productType;
    const matchesConfiguration = productConfiguration === "All" || product.productConfiguration === productConfiguration;
    const matchesSearch = !term || [product.brandName, product.model, product.productName, product.productType, product.productConfiguration, product.productClass].join(" ").toLowerCase().includes(term);
    return matchesCategory && matchesBrand && matchesType && matchesConfiguration && matchesSearch;
  });
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

function visibleDeductionRows(rows: { label: string; value: number }[]) {
  return rows.filter((row) => row.value > 0);
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

function ModuleCard({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#d9e2f2] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[#0f172a]">{title}</h3>
        <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#003CBB]">{badge}</span>
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

function SummaryRow({ label, value, strong = false, discount = false }: { label: string; value: string; strong?: boolean; discount?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${strong ? "font-semibold text-[#0f172a]" : "text-[#657267]"} ${discount ? "text-emerald-700" : ""}`}>
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-[#0f172a]">{value}</span>
    </div>
  );
}

function LineItemRow({ title, meta, value, onRemove }: { title: string; meta: string; value: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5edf7] bg-[#f8fbff] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#0f172a]">{title}</p>
        <p className="mt-1 text-xs text-[#657267]">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <IconButton onClick={onRemove} />
      </div>
    </div>
  );
}

function IconButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white"><Trash2 size={14} /></button>;
}
