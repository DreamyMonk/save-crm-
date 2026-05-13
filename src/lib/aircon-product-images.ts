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

type AirconImageInput = Pick<Product, "category" | "brandName" | "productName"> & Partial<Pick<Product, "model" | "productType" | "productConfiguration">>;

export function defaultAirconProductImage(product: AirconImageInput) {
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

export function withDefaultAirconProductImage<T extends AirconImageInput & { imageUrl?: string }>(product: T): T {
  if (product.imageUrl) return product;
  const imageUrl = defaultAirconProductImage(product);
  return imageUrl ? { ...product, imageUrl } : product;
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}
