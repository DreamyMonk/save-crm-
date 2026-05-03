import { ProductCategory } from "@/lib/crm-data";

const heatPumpBrands = ["Powerbay", "Emerald", "Neo power", "Midea", "Eco genica"];
const solarSystemBrands = ["Fox", "Goodwe", "So far", "Pylontech", "Solix"];

const categoryBrands: Partial<Record<ProductCategory, string[]>> = {
  "Heat Pump": heatPumpBrands,
  Solar: solarSystemBrands,
  Inverter: solarSystemBrands,
  "Solar Battery": solarSystemBrands,
};

const brandAliases: Record<string, string[]> = {
  Fox: ["fox", "foxess", "foxessco", "foxessess", "foxessbattery", "foxesssolar"],
  Goodwe: ["goodwe"],
  "So far": ["sofar", "sofarsolar"],
  Pylontech: ["pylontech"],
  Solix: ["solix", "ankersolix"],
  Powerbay: ["powerbay"],
  Emerald: ["emerald"],
  "Neo power": ["neopower"],
  Midea: ["midea"],
  "Eco genica": ["ecogenica"],
};

export function allowedBrandsForCategory(category: string) {
  return categoryBrands[category as ProductCategory];
}

export function canonicalBrandForCategory(category: string, brand: string) {
  const allowedBrands = allowedBrandsForCategory(category);
  if (!allowedBrands) return brand;

  const normalized = normalizeBrand(brand);
  return allowedBrands.find((allowedBrand) => {
    const aliases = brandAliases[allowedBrand] ?? [allowedBrand];
    return aliases.some((alias) => normalized.includes(normalizeBrand(alias)));
  });
}

export function isAllowedBrandForCategory(category: string, brand: string) {
  return Boolean(canonicalBrandForCategory(category, brand));
}

export function displayBrandForCategory(category: string, brand: string) {
  return canonicalBrandForCategory(category, brand) ?? brand;
}

function normalizeBrand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
