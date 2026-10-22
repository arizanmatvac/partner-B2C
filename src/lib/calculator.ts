import "server-only";

// Everything (prices, quotes, Wave, HitPay) lives in the Pricing Calculator; this app calls its
// partner API server-side with PARTNER_API_KEY, so no secrets or database access sit here.

export type Size = "S" | "M" | "L" | "XL";
export type PriceBySize = Record<Size, number>;

export interface PartnerCatalog {
  partner: { slug: string; name: string; logoUrl: string | null };
  sizes: { id: Size; name: string }[];
  oneOffs: { id: string; name: string; prices: PriceBySize; addOnIds: string[] }[];
  addOns: { id: string; name: string; prices: PriceBySize }[];
  mileage: { ratePerKm: number; freeKm: number };
  /** Bookable dates (YYYY-MM-DD), set by an admin. */
  dates: string[];
  /** The partner has a member list: the page offers an ID number field. */
  members: boolean;
  /** These are the member prices. */
  member: boolean;
  /** With member prices: the name on the member list, which the booking goes under. */
  memberName?: string;
  /** Make/model → size: the car picker. Cars not listed pick their size. */
  cars: { make: string; model: string; size: Size }[];
}

export interface Line {
  label: string;
  detail?: string;
  amount: number;
  kind: string;
}

export interface Distance {
  outboundKm: number;
  returnKm: number;
  twoWayKm: number;
  oneWayMinutes: number;
  resolvedAddress?: string;
}

export interface PublicQuote {
  id: string;
  ref: string;
  status: "quoted" | "confirmed" | "deposit_paid" | "paid";
  createdAt: string;
  customerName: string;
  customerAddress: string;
  sizes: Size[];
  lines: Line[];
  total: number;
  /** Priced with member prices. */
  member: boolean;
  /** "Perodua Myvi, Honda City" and "WYY 1024, VBC 88" (one per car). */
  carModel: string | null;
  carPlate: string | null;
  paidAt: string | null;
  amountPaid: number;
  serviceAt: string | null;
  paymentUrl: string | null;
  confirmedAt: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
}

export interface BookingRequest {
  redirectUrl?: string;
}

export interface QuoteRequest {
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceDate?: string;
  /** An ID number on the partner's member list. */
  memberId?: string;
  /** One per car; a make and model on the car list set the size. The plate is required to save. */
  services: { make: string; model: string; plate: string; size: Size; packageId: string; addOnIds: string[] }[];
  distance?: Distance;
}

/** Calls the calculator; `null` on 404, otherwise throws with a message safe to show the customer. */
async function call<T>(slug: string, path: string, body?: unknown): Promise<T | null> {
  const base = process.env.CALCULATOR_URL;
  const key = process.env.PARTNER_API_KEY;
  if (!base || !key) throw new Error("CALCULATOR_URL / PARTNER_API_KEY are not set");
  const res = await fetch(`${base}/api/partner/v1/${encodeURIComponent(slug)}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400 && data.error) throw new CalculatorError(data.error);
    console.error("[calculator]", res.status, path, data.error);
    throw new CalculatorError(GENERIC_ERROR);
  }
  return data as T;
}

export class CalculatorError extends Error {}

/** What the customer sees when the calculator fails for a reason they can't fix. */
export const GENERIC_ERROR = "Something went wrong. Please try again.";

export const getCatalog = (slug: string) => call<PartnerCatalog>(slug, "/catalog");

/** The catalog with member prices; throws if the ID isn't on the partner's list. */
export const getMemberCatalog = (slug: string, memberId: string) => call<PartnerCatalog>(slug, "/catalog", { memberId });

export async function getQuote(slug: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await call<{ quote: PublicQuote }>(slug, `/quotes/${id}`))?.quote ?? null;
}

export const previewQuote = (slug: string, body: QuoteRequest) =>
  call<{ distance: Distance; pricing: { lines: Line[]; total: number } }>(slug, "/quotes/preview", body);

/** Books the date and returns the quote with its HitPay link. */
export async function bookQuote(slug: string, id: string, body: BookingRequest) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await call<{ quote: PublicQuote }>(slug, `/quotes/${id}/confirm`, body))?.quote ?? null;
}

/** Payment failed or abandoned: the calculator deletes the booking's invoice, payment link and quote. */
export async function cancelBooking(slug: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return call<{ ok: true }>(slug, `/quotes/${id}/cancel`, {});
}

export async function saveQuote(slug: string, body: QuoteRequest) {
  return (await call<{ quote: PublicQuote }>(slug, "/quotes", body))?.quote ?? null;
}

