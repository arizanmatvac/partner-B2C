"use server";

import { headers } from "next/headers";
import { bookQuote, CalculatorError, getMemberCatalog, previewQuote, saveQuote, type QuoteRequest } from "@/lib/calculator";

// ponytail: no rate limit or bot check yet; Turnstile + per-IP limits (Phase 5) before the URL is shared.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T | null>): Promise<Result<T>> {
  try {
    const data = await fn();
    return data ? { ok: true, data } : { ok: false, error: "This page is no longer available." };
  } catch (err) {
    return { ok: false, error: err instanceof CalculatorError ? err.message : "Something went wrong. Please try again." };
  }
}

export async function priceAction(slug: string, body: QuoteRequest) {
  return run(() => previewQuote(slug, body));
}

export async function memberAction(slug: string, memberId: string) {
  return run(() => getMemberCatalog(slug, memberId));
}

export async function bookAction(slug: string, id: string) {
  const h = await headers();
  const host = h.get("host") ?? "";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  return run(() => bookQuote(slug, id, { redirectUrl: `${origin}/${slug}/q/${id}` }));
}

/**
 * "Pay & Book Now": saves the quote, books it (Wave invoice and HitPay link, as for staff bookings)
 * and returns where to pay. If booking fails after saving, `id` is the saved quote, which can be booked from its page.
 */
export async function payAction(slug: string, body: QuoteRequest): Promise<Result<{ id: string; paymentUrl: string | null }> & { id?: string }> {
  const saved = await run(() => saveQuote(slug, { ...body, distance: undefined }));
  if (!saved.ok) return saved;
  const { id } = saved.data;
  const booked = await bookAction(slug, id);
  return booked.ok ? { ok: true, data: { id, paymentUrl: booked.data.paymentUrl } } : { ...booked, id };
}
