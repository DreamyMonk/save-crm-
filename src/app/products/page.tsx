"use client";

import { FormEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, PackagePlus, Save, Search, Trash2, Upload } from "lucide-react";
import { CrmShell, PageHeader } from "@/components/crm-shell";
import { withDefaultAirconProductImage } from "@/lib/aircon-product-images";
import { Product, ProductCategory, currency } from "@/lib/crm-data";
import { displayBrandForCategory, isAllowedBrandForCategory } from "@/lib/product-brand-rules";
import { useCrmStore } from "@/lib/use-crm-store";

const categories: ProductCategory[] = ["Aircon", "Solar", "Inverter", "Heat Pump", "Solar Battery"];
const productTemplateHeaders = [
  "Product Class",
  "Brand",
  "Model",
  "Product Type",
  "Product Configuration",
  "Product Unit Mount",
  "GEMS Class",
  "Heating Capacity",
  "Cooling Capacity",
  "AEER",
  "ACOP",
  "GEMS HSPF Mixed",
  "GEMS TCSPF Cold",
  "GEMS TCSPF Mixed",
  "Refrigerant",
  "Status",
  "Product Name",
  "Image URL",
  "Description",
  "Price AUD",
];

export default function ProductsPage() {
  const { state, setState } = useCrmStore();
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | ProductCategory>("All");
  const [bulkCategory, setBulkCategory] = useState<ProductCategory>("Aircon");

  const categoryProducts = useMemo(() => {
    return state.products.filter((product) => {
      if (categoryFilter === "All") return true;
      return product.category === categoryFilter && isAllowedBrandForCategory(categoryFilter, product.brandName);
    });
  }, [categoryFilter, state.products]);
  const filterOptions = useMemo(() => {
    const brandProducts = brandFilter ? categoryProducts.filter((product) => displayBrandForCategory(product.category, product.brandName) === brandFilter) : categoryProducts;
    return {
      brands: unique(categoryProducts.map((product) => displayBrandForCategory(product.category, product.brandName)).filter(Boolean)),
      models: unique(brandProducts.map((product) => product.model ?? "").filter(Boolean)),
    };
  }, [brandFilter, categoryProducts]);
  const activeBrandFilter = filterOptions.brands.includes(brandFilter) ? brandFilter : "";
  const activeModelFilter = filterOptions.models.includes(modelFilter) ? modelFilter : "";

  const products = useMemo(() => {
    const term = search.toLowerCase();
    return state.products.filter((product) => {
      const haystack = [
        product.category,
        product.productClass,
        product.brandName,
        product.model,
        product.productName,
        product.productType,
        product.productConfiguration,
        product.gemsClass,
        product.refrigerant,
        product.status,
      ]
        .join(" ")
        .toLowerCase();
      const matchesKeyword = !term || haystack.includes(term);
      const matchesAllowedBrand = categoryFilter === "All" || isAllowedBrandForCategory(categoryFilter, product.brandName);
      const matchesBrand = !activeBrandFilter || displayBrandForCategory(product.category, product.brandName) === activeBrandFilter;
      const matchesModel = !activeModelFilter || product.model === activeModelFilter;
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      return matchesKeyword && matchesAllowedBrand && matchesBrand && matchesModel && matchesCategory;
    });
  }, [activeBrandFilter, activeModelFilter, categoryFilter, search, state.products]);

  function changeCategoryFilter(value: "All" | ProductCategory) {
    setCategoryFilter(value);
    setBrandFilter("");
    setModelFilter("");
  }

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product = { ...withDefaultAirconProductImage(productFromForm(form, nextProductId(state.products))), updatedAt: new Date().toISOString() };
    setState((currentState) => ({
      ...currentState,
      deletedProductIds: (currentState.deletedProductIds ?? []).filter((id) => id !== product.id),
      products: [...currentState.products, product],
    }));
    event.currentTarget.reset();
    setMessage(`${product.productName} saved to product catalog.`);
  }

  function updateProduct(productId: string, updates: Partial<Product>) {
    setState((currentState) => ({
      ...currentState,
      products: currentState.products.map((product) => (product.id === productId ? { ...product, ...updates, updatedAt: new Date().toISOString() } : product)),
    }));
  }

  function deleteProduct(productId: string) {
    setState((currentState) => ({
      ...currentState,
      deletedProductIds: Array.from(new Set([...(currentState.deletedProductIds ?? []), productId])),
      products: currentState.products.filter((product) => product.id !== productId),
    }));
    setMessage("Product removed from catalog.");
  }

  function downloadTemplate() {
    downloadCsv("product-upload-template.csv", [productTemplateHeaders]);
  }

  async function uploadProducts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = await readProductRows(file);
    const [headers, ...body] = rows;
    let nextProductNumber = highestProductNumber(state.products) + 1;
    const imported = body
      .filter((row) => row.some(Boolean))
      .map((row) => ({ ...withDefaultAirconProductImage(productFromCsv(headers, row, `P-${nextProductNumber++}`, bulkCategory)), updatedAt: new Date().toISOString() }));
    const importedIds = new Set(imported.map((product) => product.id));
    setState((currentState) => ({
      ...currentState,
      deletedProductIds: (currentState.deletedProductIds ?? []).filter((id) => !importedIds.has(id)),
      products: [...currentState.products, ...imported],
    }));
    setMessage(`${imported.length} ${bulkCategory.toLowerCase()} products imported.`);
    event.currentTarget.value = "";
  }

  return (
    <CrmShell>
      <PageHeader eyebrow="Product module" title="Saved product catalog" />
      <div className="space-y-6 p-4 md:p-8">
        <form onSubmit={addProduct} className="rounded-lg border border-[#d9e2f2] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PackagePlus size={18} />
              <h2 className="font-semibold">Add product</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-3 text-sm font-semibold text-[#172033]">
                <span className="text-[#657267]">Bulk category</span>
                <select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value as ProductCategory)} className="bg-transparent font-semibold text-[#003CBB] outline-none">
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={downloadTemplate} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c7d3e8] bg-white px-3 text-sm font-semibold text-[#003CBB]">
                <Download size={16} />
                Template
              </button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#003CBB] px-3 text-sm font-semibold text-white">
                <Upload size={16} />
                Bulk upload
                <input type="file" accept=".csv,.xlsx,.xls" onChange={uploadProducts} className="hidden" />
              </label>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Input name="productClass" label="Product Class" />
            <Input name="brandName" label="Brand" required />
            <Input name="model" label="Model" />
            <CategorySelect name="category" label="Category" />
            <Input name="productName" label="Product Name" required />
            <Input name="productType" label="Product Type" />
            <Input name="productConfiguration" label="Product Configuration" />
            <Input name="productUnitMount" label="Product Unit Mount" />
            <Input name="gemsClass" label="GEMS Class" />
            <Input name="heatingCapacity" label="Heating Capacity" />
            <Input name="coolingCapacity" label="Cooling Capacity" />
            <Input name="aeER" label="AEER" />
            <Input name="acop" label="ACOP" />
            <Input name="gemsHspfMixed" label="GEMS HSPF Mixed" />
            <Input name="gemsTcspfCold" label="GEMS TCSPF Cold" />
            <Input name="gemsTcspfMixed" label="GEMS TCSPF Mixed" />
            <Input name="refrigerant" label="Refrigerant" />
            <Input name="status" label="Status" />
            <Input name="imageUrl" label="Image URL" />
            <Input name="price" label="Price AUD" type="number" min={0} step={1} />
            <label className="space-y-1 text-sm md:col-span-3 xl:col-span-4">
              <span className="font-medium text-[#657267]">Description</span>
              <textarea name="description" className="min-h-20 w-full rounded-lg border border-[#d7dfd0] px-3 py-2 outline-none" />
            </label>
          </div>
          {message ? <p className="mt-4 rounded-lg bg-[#eef4ff] p-3 text-sm font-medium text-[#003CBB]">{message}</p> : null}
          <button className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#003CBB] px-4 text-sm font-semibold text-white">
            <Save size={16} />
            Save product
          </button>
        </form>

        <section className="rounded-lg border border-[#d9e2f2] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf7] p-4">
            <h2 className="font-semibold">Added products</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 text-[#657267]" size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all products" className="h-10 w-72 rounded-lg border border-[#d9e2f2] bg-white pl-10 pr-3 text-sm outline-none" />
              </label>
              <FilterSelect label="Category" value={categoryFilter} options={["All", ...categories]} onChange={(value) => changeCategoryFilter(value as "All" | ProductCategory)} />
              <FilterSelect label="Brand" value={activeBrandFilter} options={["", ...filterOptions.brands]} onChange={(value) => { setBrandFilter(value); setModelFilter(""); }} />
              <FilterSelect label="Model" value={activeModelFilter} options={["", ...filterOptions.models]} onChange={setModelFilter} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1900px] w-full border-collapse text-sm">
              <thead className="bg-[#f6f8fc] text-left text-xs uppercase tracking-[0.08em] text-[#657267]">
                <tr>
                  <Th>ID</Th>
                  <Th>Category</Th>
                  <Th>Product Class</Th>
                  <Th>Brand</Th>
                  <Th>Model</Th>
                  <Th>Product Type</Th>
                  <Th>Product Configuration</Th>
                  <Th>Product Unit Mount</Th>
                  <Th>GEMS Class</Th>
                  <Th>Heating Capacity</Th>
                  <Th>Cooling Capacity</Th>
                  <Th>AEER</Th>
                  <Th>ACOP</Th>
                  <Th>Refrigerant</Th>
                  <Th>Status</Th>
                  <Th>Price</Th>
                  <Th>Delete</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-[#e5edf7]">
                    <Td>{product.id}</Td>
                    <td className="min-w-32 px-2 py-2">
                      <select value={product.category} onChange={(event) => updateProduct(product.id, { category: event.target.value as ProductCategory })} className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none focus:border-[#003CBB] focus:bg-white">
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <EditableCell value={product.productClass ?? ""} onChange={(value) => updateProduct(product.id, { productClass: value })} />
                    <EditableCell value={product.brandName} onChange={(value) => updateProduct(product.id, { brandName: value })} />
                    <EditableCell value={product.model ?? ""} onChange={(value) => updateProduct(product.id, { model: value })} />
                    <EditableCell value={product.productType ?? ""} onChange={(value) => updateProduct(product.id, { productType: value })} />
                    <EditableCell value={product.productConfiguration ?? ""} onChange={(value) => updateProduct(product.id, { productConfiguration: value })} />
                    <EditableCell value={product.productUnitMount ?? ""} onChange={(value) => updateProduct(product.id, { productUnitMount: value })} />
                    <EditableCell value={product.gemsClass ?? ""} onChange={(value) => updateProduct(product.id, { gemsClass: value })} />
                    <EditableCell value={product.heatingCapacity ?? ""} onChange={(value) => updateProduct(product.id, { heatingCapacity: value })} />
                    <EditableCell value={product.coolingCapacity ?? ""} onChange={(value) => updateProduct(product.id, { coolingCapacity: value })} />
                    <EditableCell value={product.aeER ?? ""} onChange={(value) => updateProduct(product.id, { aeER: value })} />
                    <EditableCell value={product.acop ?? ""} onChange={(value) => updateProduct(product.id, { acop: value })} />
                    <EditableCell value={product.refrigerant ?? ""} onChange={(value) => updateProduct(product.id, { refrigerant: value })} />
                    <EditableCell value={product.status ?? ""} onChange={(value) => updateProduct(product.id, { status: value })} />
                    <td className="min-w-32 px-2 py-2">
                      <input value={product.price} type="number" onChange={(event) => updateProduct(product.id, { price: Number(event.target.value) })} className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none focus:border-[#003CBB] focus:bg-white" title={currency(product.price)} />
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => deleteProduct(product.id)} className="grid size-8 place-items-center rounded-lg bg-rose-600 text-white" title="Delete product">
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

function productFromForm(form: FormData, id: string): Product {
  return {
    id,
    category: String(form.get("category") || "Solar") as ProductCategory,
    productClass: String(form.get("productClass") || ""),
    productName: String(form.get("productName") || form.get("model") || ""),
    brandName: String(form.get("brandName") || ""),
    model: String(form.get("model") || ""),
    productType: String(form.get("productType") || ""),
    productConfiguration: String(form.get("productConfiguration") || ""),
    productUnitMount: String(form.get("productUnitMount") || ""),
    gemsClass: String(form.get("gemsClass") || ""),
    heatingCapacity: String(form.get("heatingCapacity") || ""),
    coolingCapacity: String(form.get("coolingCapacity") || ""),
    aeER: String(form.get("aeER") || ""),
    acop: String(form.get("acop") || ""),
    gemsHspfMixed: String(form.get("gemsHspfMixed") || ""),
    gemsTcspfCold: String(form.get("gemsTcspfCold") || ""),
    gemsTcspfMixed: String(form.get("gemsTcspfMixed") || ""),
    refrigerant: String(form.get("refrigerant") || ""),
    status: String(form.get("status") || ""),
    imageUrl: String(form.get("imageUrl") || ""),
    description: String(form.get("description") || ""),
    price: Number(form.get("price") || 0),
  };
}

function productFromCsv(headers: string[], row: string[], id: string, selectedCategory: ProductCategory): Product {
  const get = (name: string) => row[headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(name))] ?? "";
  const productClass = get("Product Class");
  return {
    id,
    category: selectedCategory,
    productClass: normalizeHeader(productClass) === normalizeHeader(selectedCategory) ? "" : productClass,
    productName: get("Product Name") || get("Model"),
    brandName: get("Brand"),
    model: get("Model"),
    productType: get("Product Type"),
    productConfiguration: get("Product Configuration"),
    productUnitMount: get("Product Unit Mount"),
    gemsClass: get("GEMS Class"),
    heatingCapacity: get("Heating Capacity"),
    coolingCapacity: get("Cooling Capacity"),
    aeER: get("AEER"),
    acop: get("ACOP"),
    gemsHspfMixed: get("GEMS HSPF Mixed"),
    gemsTcspfCold: get("GEMS TCSPF Cold"),
    gemsTcspfMixed: get("GEMS TCSPF Mixed"),
    refrigerant: get("Refrigerant"),
    status: get("Status"),
    imageUrl: get("Image URL"),
    description: get("Description"),
    price: Number(get("Price AUD") || 0),
  };
}

function nextProductId(products: Product[]) {
  return `P-${highestProductNumber(products) + 1}`;
}

function highestProductNumber(products: Product[]) {
  return products.reduce((highest, product) => {
    const match = /^P-(\d+)$/.exec(product.id);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]));
  }, 1000);
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="h-10 rounded-lg border border-[#d9e2f2] bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#657267]">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-32 bg-transparent text-sm font-medium normal-case tracking-normal text-[#172033] outline-none">
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option || `All ${label.toLowerCase()}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategorySelect({ label, name }: { label: string; name?: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[#657267]">{label}</span>
      <select name={name} className="h-11 w-full rounded-lg border border-[#d7dfd0] bg-white px-3 outline-none">
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap border-r border-[#d9e2f2] px-3 py-3 font-semibold last:border-r-0">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#003CBB]">{children}</td>;
}

function EditableCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <td className="min-w-36 px-2 py-2">
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none focus:border-[#003CBB] focus:bg-white" />
    </td>
  );
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
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

async function readProductRows(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false }).map((row) => row.map((cell) => String(cell ?? "").trim()));
  }
  return parseCsv(await file.text());
}
