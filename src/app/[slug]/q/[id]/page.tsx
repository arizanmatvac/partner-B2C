import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCatalog, getQuote } from "@/lib/calculator";
import { lineAmount, rm } from "@/lib/format";
import { PartnerHeader } from "../../PartnerHeader";
import { BookButton } from "./BookButton";
import { CancelBooking } from "./CancelBooking";
import { ShareButtons } from "./ShareButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your booking · Matvac" };

const STATUS = {
  quoted: "Quote saved",
  confirmed: "Booked, awaiting payment",
  deposit_paid: "Deposit paid",
  paid: "Paid",
} as const;

const PAYMENT_WINDOW_HOURS = 48;

const MY = { timeZone: "Asia/Kuala_Lumpur" } as const;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-MY", { ...MY, day: "numeric", month: "long", year: "numeric" });
const visit = (iso: string) =>
  new Date(iso).toLocaleString("en-MY", { ...MY, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-MY", { ...MY, weekday: "long", day: "numeric", month: "long" });

/** HitPay's `status` on the way back when the customer didn't pay. */
const NOT_PAID = ["failed", "canceled", "cancelled", "expired"];

export default async function QuotePage({ params, searchParams }: PageProps<"/[slug]/q/[id]">) {
  const { slug, id } = await params;
  const { status } = await searchParams;
  const [catalog, q] = await Promise.all([getCatalog(slug), getQuote(slug, id)]);
  if (!catalog) notFound();
  // Unpaid bookings are deleted (failed payment, cancelled, expired): start a new one.
  if (!q) redirect(`/${slug}`);
  const paymentFailed = q.status === "confirmed" && typeof status === "string" && NOT_PAID.includes(status.toLowerCase());
  const sizeName = (s: string) => catalog.sizes.find((x) => x.id === s)?.name ?? s;

  return (
    <>
      <PartnerHeader partner={catalog.partner} />
      <main className="mx-auto flex w-full max-w-[760px] grow flex-col gap-4 px-4 py-6 md:px-6 md:py-10">
        {q.status === "paid" && (
          <div role="status" className="flex flex-col gap-1 rounded-[14px] bg-success-bg px-5 py-4">
            <span className="font-display text-lg tracking-[0.04em] text-success">PAID, THANK YOU!</span>
            <span className="text-sm text-grey-900">
              {q.serviceAt ? `We'll see you on ${day(q.serviceAt)}.` : "We'll be in touch to confirm your visit."} Our team will WhatsApp you before the visit.
            </span>
          </div>
        )}

        {/* Shared and saved as an image, so everything the customer needs is inside the card. */}
        <article id="booking-card" className="card overflow-hidden shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-end gap-2 bg-navy-900 px-6 py-5 text-white md:px-8">
            <div className="flex grow flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.12em] text-orange-300">
                {q.invoiceNumber ? `INVOICE ${q.invoiceNumber}` : `QUOTATION · REF ${q.ref}`}
              </span>
              <span className="text-xl font-bold">{q.customerName}</span>
              <span className="text-sm text-navy-100">{q.customerAddress}</span>
            </div>
            <span className="text-sm text-navy-100">{longDate(q.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2 px-6 pt-5 md:px-8">
            <span className="rounded bg-grey-100 px-2 py-1 text-xs font-bold tracking-[0.06em] text-grey-700">{STATUS[q.status].toUpperCase()}</span>
            <span className="rounded bg-grey-100 px-2 py-1 text-xs font-bold tracking-[0.06em] text-grey-700">
              {q.sizes.map(sizeName).join(", ").toUpperCase()}
            </span>
            {q.member && (
              <span className="rounded bg-success-bg px-2 py-1 text-xs font-bold tracking-[0.06em] text-success">MEMBER PRICE</span>
            )}
            {q.serviceAt && (
              <span className="rounded bg-orange-50 px-2 py-1 text-xs font-bold tracking-[0.06em] text-orange-900">{day(q.serviceAt).toUpperCase()}</span>
            )}
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-6 pt-4 text-sm md:px-8">
            {q.serviceAt && <Detail label="Booking date">{day(q.serviceAt)}</Detail>}
            {q.carModel && <Detail label={q.carModel.includes(",") ? "Cars" : "Car"}>{q.carModel}</Detail>}
            {q.carPlate && <Detail label="Registration">{q.carPlate}</Detail>}
            {q.invoiceNumber && <Detail label="Invoice no.">{q.invoiceNumber}</Detail>}
            {q.invoiceUrl && q.status !== "quoted" && (
              <Detail label="Invoice">
                <a href={q.invoiceUrl} target="_blank" rel="noopener" className="break-all font-bold">View / download invoice</a>
              </Detail>
            )}
            {q.paidAt && <Detail label="Paid">{rm(q.amountPaid || q.total)} on {longDate(q.paidAt)}</Detail>}
          </dl>
          <ul className="m-0 flex list-none flex-col px-6 py-2 md:px-8">
            {q.lines.map((l, i) => (
              <li key={i} className="flex gap-4 border-b border-grey-100 py-3">
                <div className="flex grow flex-col">
                  <span className="text-[15px] font-bold text-grey-900">{l.label}</span>
                  {l.detail && <span className="text-[13px] text-grey-500">{l.detail}</span>}
                </div>
                <span className={`whitespace-nowrap text-[15px] font-bold ${l.amount < 0 ? "text-success" : "text-grey-900"}`}>{lineAmount(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mx-6 mb-6 flex items-baseline justify-between border-t-2 border-navy-900 pt-3 md:mx-8">
            <span className="font-display text-sm tracking-[0.06em] text-navy-900">TOTAL</span>
            <span className="font-display text-[32px] text-navy-900">{rm(q.total)}</span>
          </div>
        </article>

        {q.status === "quoted" && <BookButton slug={slug} id={q.id} total={q.total} />}

        {q.status === "confirmed" && q.paymentUrl && (
          <div className="card flex flex-col gap-3 p-5 md:p-6">
            <p className="m-0 text-[15px] text-grey-900">
              Your visit is held until{" "}
              <b>{q.confirmedAt ? visit(new Date(new Date(q.confirmedAt).getTime() + PAYMENT_WINDOW_HOURS * 3_600_000).toISOString()) : "the payment link expires"}</b>.
              Pay to confirm it.
            </p>
            {!paymentFailed && (
              <a href={q.paymentUrl} className="btn-primary h-14 text-base text-white no-underline hover:text-white">Pay {rm(q.total)} now</a>
            )}
            <CancelBooking slug={slug} id={q.id} auto={paymentFailed} />
            <span className="text-[13px] text-grey-500">Already paid? Refresh this page in a minute. Cancelling deletes this booking and its invoice.</span>
          </div>
        )}

        <ShareButtons targetId="booking-card" fileName={`Matvac booking ${q.invoiceNumber ?? q.ref}`} />
        <Link href={`/${slug}`} className="no-print text-sm font-bold">← Start a new booking</Link>
      </main>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-grey-500">{label}</dt>
      <dd className="m-0 font-semibold text-grey-900">{children}</dd>
    </>
  );
}
