import type { Product } from "./crm-data";

export const airconProductImageUrls = {
  daikinMultiSplit: "https://saveplanet.com.au/images/ac%20prouct/Daikin-Multi-Split-System.png",
  mideaDucted: "https://saveplanet.com.au/images/ac%20prouct/Midea-Ducted.png",
  mideaMultiHead: "https://saveplanet.com.au/images/ac%20prouct/Midea-Multi-Head-System.png",
  mideaVrfSplits: "https://saveplanet.com.au/images/ac%20prouct/Midea-VRF-Splits.png",
  mitsubishiMultiSplit: "https://saveplanet.com.au/images/ac%20prouct/Mitsubishi-Electric-Multi-Split-System.png",
  panasonicDucted: "https://saveplanet.com.au/images/ac%20prouct/Panasonic-Ducted-System.png",
  rinnaiMultiHead: "https://saveplanet.com.au/images/ac%20prouct/Rinnai-Multi-Head-System.png",
} as const;

export const heatPumpProductImageUrls = {
  powerbay: "https://saveplanet.com.au/images/heatpump_product/4222490ba0ce4e0d0678da9d229358dc.png",
  emerald: "https://saveplanet.com.au/images/heatpump_product/53cecb8cc523ca5ef31946c768ed49d0.png",
  neoPower: "https://saveplanet.com.au/images/heatpump_product/5c5c85823234567d717f7ebee645cac5.png",
  emeraldAlternate: "https://saveplanet.com.au/images/heatpump_product/53cecb8cc523ca5ef31946c768ed49d0%20(1).png",
  midea: "https://saveplanet.com.au/images/heatpump_product/c5341826ed9c349b38ca362f2cfceae7.png",
  neoPowerAlternate: "https://saveplanet.com.au/images/heatpump_product/5c5c85823234567d717f7ebee645cac5%20(1).png",
  ecoGenica: "https://saveplanet.com.au/images/heatpump_product/a3429038bb9cd8a7b95ae878f427d853.jpeg",
} as const;

export const solarProductImageUrls = {
  panelBlack: "https://saveplanet.com.au/images/solar_product/122ab820b84040a43a1e0d7ae5ce9976.webp",
  panelFramed: "https://saveplanet.com.au/images/solar_product/19612aa17ecd3b4efdeb83ed60c5c8f7.webp",
  panelGrid: "https://saveplanet.com.au/images/solar_product/c88593906eafb829b36fe351ef71d767.webp",
  panelPair: "https://saveplanet.com.au/images/solar_product/fddb820c383ce7cf2b91530bf95181c6.webp",
  sofarStorage: "https://saveplanet.com.au/images/battary%20stoorage%20product/462cbabc965f0b70aca7d5c4a0024d53.jpg",
  solixStorage: "https://saveplanet.com.au/images/battary%20stoorage%20product/4be9658bfd078c4513d965a941125009.jpg",
  pylontechStorage: "https://saveplanet.com.au/images/battary%20stoorage%20product/4cb8104e14826f6931a47a3786dc7bba.png",
  foxStorage: "https://saveplanet.com.au/images/battary%20stoorage%20product/55dc897ed335a5432a2e7a8d5536a8fc.jpg",
  goodweStorage: "https://saveplanet.com.au/images/battary%20stoorage%20product/9fcc54149a639de3afe43da19fa9ed93.png",
} as const;

type ProductImageInput = Pick<Product, "category" | "brandName" | "productName"> & Partial<Pick<Product, "model" | "productType" | "productConfiguration">>;

export function defaultAirconProductImage(product: ProductImageInput) {
  if (product.category !== "Aircon") return "";
  const brand = normalize(product.brandName);
  const type = normalize(product.productType);
  const config = normalize(product.productConfiguration);
  const name = normalize(`${product.productName} ${product.model ?? ""}`);
  const text = `${type} ${config} ${name}`;
  const ducted = text.includes("ducted");
  const vrf = text.includes("variable refrigerant") || text.includes("vrf");

  if (brand.includes("rinnai")) return airconProductImageUrls.rinnaiMultiHead;
  if (brand.includes("panasonic")) return ducted ? airconProductImageUrls.panasonicDucted : "";
  if (brand.includes("mitsubishi")) return airconProductImageUrls.mitsubishiMultiSplit;
  if (brand.includes("daikin")) return airconProductImageUrls.daikinMultiSplit;
  if (brand.includes("midea")) {
    if (ducted) return airconProductImageUrls.mideaDucted;
    if (vrf) return airconProductImageUrls.mideaVrfSplits;
    return airconProductImageUrls.mideaMultiHead;
  }

  return "";
}

export function defaultHeatPumpProductImage(product: ProductImageInput) {
  if (product.category !== "Heat Pump") return "";
  const brand = normalize(product.brandName);
  const text = normalize(`${product.brandName} ${product.productName} ${product.model ?? ""} ${product.productType ?? ""} ${product.productConfiguration ?? ""}`);

  if (brand.includes("powerbay") || text.includes("power bay")) return heatPumpProductImageUrls.powerbay;
  if (brand.includes("emerald")) return text.includes("alternate") ? heatPumpProductImageUrls.emeraldAlternate : heatPumpProductImageUrls.emerald;
  if (brand.includes("neo") || text.includes("neo power") || text.includes("neopower")) return heatPumpProductImageUrls.neoPower;
  if (brand.includes("midea")) return heatPumpProductImageUrls.midea;
  if (brand.includes("eco genica") || brand.includes("ecogenica")) return heatPumpProductImageUrls.ecoGenica;

  return heatPumpProductImageUrls.emerald;
}

export function defaultProductImage(product: ProductImageInput) {
  return defaultAirconProductImage(product) || defaultHeatPumpProductImage(product) || defaultSolarProductImage(product);
}

export function defaultSolarProductImage(product: ProductImageInput) {
  const brand = normalize(product.brandName);
  const text = normalize(`${product.brandName} ${product.productName} ${product.model ?? ""} ${product.productType ?? ""} ${product.productConfiguration ?? ""}`);

  if (product.category === "Solar") {
    if (text.includes("bifacial") || text.includes("dual glass")) return solarProductImageUrls.panelPair;
    if (text.includes("black") || text.includes("all black")) return solarProductImageUrls.panelBlack;
    if (text.includes("mono") || text.includes("module")) return solarProductImageUrls.panelGrid;
    return solarProductImageUrls.panelFramed;
  }

  if (product.category !== "Inverter" && product.category !== "Solar Battery") return "";
  if (brand.includes("fox") || text.includes("foxess")) return solarProductImageUrls.foxStorage;
  if (brand.includes("goodwe")) return solarProductImageUrls.goodweStorage;
  if (brand.includes("so far") || brand.includes("sofar") || text.includes("sofar")) return solarProductImageUrls.sofarStorage;
  if (brand.includes("pylontech")) return solarProductImageUrls.pylontechStorage;
  if (brand.includes("solix") || text.includes("anker")) return solarProductImageUrls.solixStorage;

  return product.category === "Solar Battery" ? solarProductImageUrls.pylontechStorage : solarProductImageUrls.goodweStorage;
}

export function withDefaultProductImage<T extends ProductImageInput & { imageUrl?: string }>(product: T): T {
  if (product.imageUrl) return product;
  const imageUrl = defaultProductImage(product);
  return imageUrl ? { ...product, imageUrl } : product;
}

export function withDefaultAirconProductImage<T extends ProductImageInput & { imageUrl?: string }>(product: T): T {
  if (product.imageUrl) return product;
  const imageUrl = defaultAirconProductImage(product);
  return imageUrl ? { ...product, imageUrl } : product;
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}
