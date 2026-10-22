"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Distance, Line, PartnerCatalog, Size } from "@/lib/calculator";
import { lineAmount, rm } from "@/lib/format";
import { memberAction, payAction, priceAction } from "./actions";

const OTHER = "__other";

/** A car as picked: a listed make/model, or typed ("Other") with the size picked by hand. */
interface Car {
  makePick: string;
  modelPick: string;
  makeText: string;
  modelText: string;
  plate: string;
  /** Only for cars not on the list. */
  size: Size | "";
  packageId: string;
  addOnIds: string[];
}

/** The form as it was when Pay & Book Now was pressed, kept in this tab to try again after a failed payment. */
const savedKey = (slug: string) => `matvac-booking:${slug}`;
interface SavedForm {
  cars: Car[];
  details: Record<"serviceDate" | "customerName" | "customerPhone" | "customerEmail" | "customerAddress", string>;
  memberId: string;
  pricedAddress: string;
}

const NEW_CAR: Car = { makePick: "", modelPick: "", makeText: "", modelText: "", plate: "", size: "", packageId: "", addOnIds: [] };
const plateOk = (p: string) => p.replace(/[^a-z0-9]/gi, "").length >= 2;

export function QuoteForm({ slug, catalog: normal }: { slug: string; catalog: PartnerCatalog }) {
  const router = useRouter();
  // An ID on the partner's member list swaps in the member prices.
  const [catalog, setCatalog] = useState(normal);
  const [memberId, setMemberId] = useState("");
  const [checkingId, setCheckingId] = useState(false);
  const [idError, setIdError] = useState("");
  // No mileage: no address is asked at all (the visit is at the partner's).
  const mileage = catalog.mileage.ratePerKm > 0;
  const [cars, setCars] = useState<Car[]>([NEW_CAR]);
  const [details, setDetails] = useState({ serviceDate: "", customerName: "", customerPhone: "", customerEmail: "", customerAddress: "" });
  // The address is priced once typed (on leaving the field), not on every keystroke.
  const [pricedAddress, setPricedAddress] = useState("");
  const [distance, setDistance] = useState<Distance | undefined>();
  const [priced, setPriced] = useState<{ key: string; lines: Line[]; total: number } | null>(null);
  const [priceError, setPriceError] = useState<{ key: string; msg: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const request = useRef(0);

  // Back after a failed or cancelled payment (?retry): fill the form in again as it was.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("retry")) return;
    let saved: SavedForm | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(savedKey(slug)) ?? "null");
    } catch {
      // nothing saved (private tab, another device): the form starts empty
    }
    /* eslint-disable react-hooks/set-state-in-effect -- restoring from sessionStorage, only readable after hydration */
    setRetrying(true);
    if (!saved) return;
    setCars(saved.cars);
    // The date may have filled up since: then it's picked again.
    setDetails({ ...saved.details, serviceDate: normal.dates.includes(saved.details.serviceDate) ? saved.details.serviceDate : "" });
    setPricedAddress(saved.pricedAddress);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (saved.memberId) {
      const id = saved.memberId;
      setMemberId(id);
      memberAction(slug, id).then((res) => { if (res.ok) setCatalog(res.data); });
    }
  }, [slug, normal.dates]);

  const makes = useMemo(() => [...new Set(catalog.cars.map((c) => c.make))], [catalog.cars]);
  const sizeName = (s: string) => catalog.sizes.find((x) => x.id === s)?.name ?? s;
  const pkg = (id: string) => catalog.oneOffs.find((p) => p.id === id);
  const addOn = (id: string) => catalog.addOns.find((a) => a.id === id);

  /** The make, model and size a car comes to (size null until known). */
  function identify(c: Car) {
    const typedMake = c.makePick === OTHER;
    const make = typedMake ? c.makeText.trim() : c.makePick;
    const model = typedMake || c.modelPick === OTHER ? c.modelText.trim() : c.modelPick;
    const listed = catalog.cars.find((x) => x.make === make && x.model === model);
    return { make, model, listed: Boolean(listed), size: listed?.size ?? (c.size || null) };
  }

  const services = cars.map((c) => {
    const id = identify(c);
    return { make: id.make, model: id.model, plate: c.plate.trim().toUpperCase(), size: (id.size ?? "M") as Size, packageId: c.packageId, addOnIds: c.addOnIds };
  });
  const carsReady = cars.every((c) => {
    const id = identify(c);
    return id.make && id.model && id.size && plateOk(c.plate) && c.packageId;
  });
  const appliedId = catalog.member ? memberId : undefined;
  // Everything the price depends on (not the plates or the date).
  const priceKey = JSON.stringify([services.map((s) => [s.make, s.model, s.size, s.packageId, s.addOnIds]), appliedId, mileage ? pricedAddress : ""]);
  const canPrice = carsReady && (!mileage || pricedAddress !== "");
  const price = canPrice && priced?.key === priceKey ? priced : null;
  const shownPriceError = canPrice && priceError?.key === priceKey ? priceError.msg : "";

  // The price follows every change (the server prices it; the browser never decides a total).
  useEffect(() => {
    if (!canPrice) return;
    const n = ++request.current;
    const timer = setTimeout(async () => {
      const res = await priceAction(slug, { services, customerAddress: pricedAddress, distance: mileage ? distance : undefined, memberId: appliedId });
      if (n !== request.current) return;
      if (!res.ok) return setPriceError({ key: priceKey, msg: res.error });
      setDistance(res.data.distance);
      setPriced({ key: priceKey, ...res.data.pricing });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- priceKey holds everything the price depends on
  }, [priceKey, canPrice]);

  const changeCar = (i: number, next: Partial<Car>) => setCars((cs) => cs.map((c, n) => (n === i ? { ...c, ...next } : c)));
  const changeDetails = (field: keyof typeof details, value: string) => setDetails((d) => ({ ...d, [field]: value }));

  function changeMemberId(value: string) {
    setMemberId(value);
    setIdError("");
    if (catalog.member) setCatalog(normal);
  }

  async function applyMemberId() {
    if (!memberId.trim()) return;
    setCheckingId(true);
    setIdError("");
    const res = await memberAction(slug, memberId);
    setCheckingId(false);
    if (!res.ok) return setIdError(res.error);
    setCatalog(res.data);
  }

  async function pay() {
    setPaying(true);
    setError("");
    const form: SavedForm = { cars, details, memberId: appliedId ?? "", pricedAddress };
    try {
      sessionStorage.setItem(savedKey(slug), JSON.stringify(form));
    } catch {
      // storage blocked: a failed payment just means filling the form in again
    }
    const { serviceDate, customerName, customerPhone, customerEmail, customerAddress } = details;
    const res = await payAction(slug, { serviceDate, customerName, customerPhone, customerEmail, customerAddress, services, memberId: appliedId });
    if (res.ok) {
      if (res.data.paymentUrl) return window.location.assign(res.data.paymentUrl);
      return router.push(`/${slug}/q/${res.data.id}`);
    }
    setPaying(false);
    setError(res.error);
  }

  return (
    <form className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8" onSubmit={(e) => { e.preventDefault(); pay(); }}>
      <div className="flex min-w-0 flex-col gap-5">
        {retrying && (
          <p role="status" className="m-0 rounded-[14px] bg-warning-bg px-5 py-4 text-sm font-semibold text-warning-ink">
            Your payment didn&apos;t go through, so nothing was booked or charged. Check your details and press Pay &amp; Book Now to try again.
          </p>
        )}
        <Section num="01" title="PICK A DATE">
          {catalog.dates.length ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="label">Booking date</label>
              <select id="date" required className="field" value={details.serviceDate} onChange={(e) => changeDetails("serviceDate", e.target.value)}>
                <option value="" disabled>Choose a date</option>
                {catalog.dates.map((d) => <option key={d} value={d}>{dateLabel(d)}</option>)}
              </select>
            </div>
          ) : (
            <p className="m-0 text-[15px] text-grey-700">No booking dates are open right now. Please check back soon.</p>
          )}
        </Section>

        {normal.members && (
          <Section num="02" title="MEMBER PRICE">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="member" className="label">ID number (optional)</label>
              <div className="flex gap-2">
                <input id="member" className="field uppercase" value={memberId} autoComplete="off" aria-describedby="member-help"
                  onChange={(e) => changeMemberId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!catalog.member) applyMemberId(); } }} />
                <button type="button" onClick={applyMemberId} disabled={checkingId || !memberId.trim() || catalog.member}
                  className="btn-outline h-[46px] shrink-0 px-4 text-sm">
                  {checkingId ? "Checking…" : catalog.member ? "Applied" : "Apply"}
                </button>
              </div>
              {idError ? (
                <span role="alert" className="text-[13px] font-semibold text-danger">{idError}</span>
              ) : catalog.member ? (
                <span id="member-help" role="status" className="text-[13px] font-semibold text-success">Member prices applied.</span>
              ) : (
                <span id="member-help" className="text-[13px] text-grey-500">Members get special prices (one booking per day). Leave it empty for the normal price.</span>
              )}
            </div>
          </Section>
        )}

        {cars.map((car, i) => {
          const id = identify(car);
          const models = catalog.cars.filter((c) => c.make === car.makePick);
          const typedMake = car.makePick === OTHER;
          const typedModel = typedMake || car.modelPick === OTHER;
          const known = Boolean(id.make && id.model);
          const ready = known && id.size && plateOk(car.plate);
          const p = pkg(car.packageId);
          const num = String((normal.members ? 3 : 2) + i).padStart(2, "0");
          return (
            <Section key={i} num={num} title={cars.length > 1 ? `CAR ${i + 1}` : "YOUR CAR"}
              aside={cars.length > 1 && (
                <button type="button" className="text-sm font-bold text-danger" onClick={() => setCars(cars.filter((_, n) => n !== i))}>Remove</button>
              )}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`make-${i}`} className="label">Make</label>
                  <select id={`make-${i}`} required className="field" value={car.makePick}
                    onChange={(e) => changeCar(i, { makePick: e.target.value, modelPick: "", makeText: "", modelText: "", size: "" })}>
                    <option value="" disabled>Choose the make</option>
                    {makes.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value={OTHER}>Other make</option>
                  </select>
                </div>
                {typedMake ? (
                  <Field id={`make-text-${i}`} label="Make" required value={car.makeText} onChange={(v) => changeCar(i, { makeText: v })} placeholder="e.g. Chevrolet" />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`model-${i}`} className="label">Model</label>
                    <select id={`model-${i}`} required className="field" value={car.modelPick} disabled={!car.makePick}
                      onChange={(e) => changeCar(i, { modelPick: e.target.value, modelText: "", size: "" })}>
                      <option value="" disabled>{car.makePick ? "Choose the model" : "Choose the make first"}</option>
                      {models.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
                      {car.makePick && <option value={OTHER}>Other model</option>}
                    </select>
                  </div>
                )}
                {typedModel && (
                  <Field id={`model-text-${i}`} label="Model" required value={car.modelText} onChange={(v) => changeCar(i, { modelText: v })} placeholder="e.g. Cruze" />
                )}
                <Field id={`plate-${i}`} label="Registration number" required className="field uppercase" value={car.plate}
                  onChange={(v) => changeCar(i, { plate: v })} placeholder="e.g. WYY 1024" autoComplete="off" />
              </div>

              {known && !id.listed && (
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className="label mb-2">Car size (we couldn&apos;t find your model)</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {catalog.sizes.map((s) => (
                      <Choice key={s.id} name={`size-${i}`} checked={car.size === s.id} onChange={() => changeCar(i, { size: s.id })}>
                        <span className="font-bold text-navy-900">{s.name}</span>
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              )}
              {known && id.listed && id.size && <p className="m-0 text-[13px] text-grey-700">Size: <b>{sizeName(id.size)}</b></p>}

              {ready && id.size ? (
                <>
                  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="label mb-2">Package</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catalog.oneOffs.map((o) => (
                        <Choice key={o.id} name={`pkg-${i}`} checked={car.packageId === o.id}
                          onChange={() => changeCar(i, { packageId: o.id, addOnIds: car.addOnIds.filter((a) => o.addOnIds.includes(a)) })}>
                          <span className="grow font-bold text-navy-900">{o.name}</span>
                          <span className="font-bold text-grey-900">{rm(o.prices[id.size!])}</span>
                        </Choice>
                      ))}
                    </div>
                  </fieldset>
                  {p && p.addOnIds.length > 0 && (
                    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                      <legend className="label mb-2">Add-ons (optional)</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {p.addOnIds.map((aid) => addOn(aid)).filter((a) => a !== undefined).map((a) => (
                          <label key={a.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-grey-200 px-4 py-2.5 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
                            <input type="checkbox" className="size-5 accent-orange-600" checked={car.addOnIds.includes(a.id)}
                              onChange={(e) => changeCar(i, { addOnIds: e.target.checked ? [...car.addOnIds, a.id] : car.addOnIds.filter((x) => x !== a.id) })} />
                            <span className="grow font-semibold text-grey-900">{a.name}</span>
                            <span className="font-bold text-grey-900">+ {rm(a.prices[id.size!])}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </>
              ) : (
                <p className="m-0 rounded-[10px] bg-grey-50 px-4 py-3 text-[13px] text-grey-500">
                  Pick your car{known && !id.size ? "'s size" : ""} and enter the registration number to see the packages.
                </p>
              )}
            </Section>
          );
        })}
        {cars.length < 10 && (
          <button type="button" className="self-start text-sm font-bold text-orange-700 hover:text-orange-900" onClick={() => setCars([...cars, NEW_CAR])}>
            + Add another car
          </button>
        )}

        {mileage && (
          <Section title="WHERE WE COME TO YOU">
            <Field id="address" label="Service address" required value={details.customerAddress} onChange={(v) => changeDetails("customerAddress", v)}
              onBlur={() => { if (details.customerAddress.trim() !== pricedAddress) { setDistance(undefined); setPricedAddress(details.customerAddress.trim()); } }}
              placeholder="Street, area, postcode, city" autoComplete="street-address" />
            {distance?.resolvedAddress && <p className="-mt-2 m-0 text-[13px] text-grey-500">We found: {distance.resolvedAddress}</p>}
          </Section>
        )}

        <Section title="YOUR DETAILS">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              {/* A member is booked under the name on the member list. */}
              <Field id="name" label="Your name" required readOnly={catalog.member} aria-describedby={catalog.member ? "name-help" : undefined}
                className={catalog.member ? "field bg-grey-50 text-grey-700" : "field"}
                value={catalog.member ? (catalog.memberName ?? "") : details.customerName} onChange={(v) => changeDetails("customerName", v)} autoComplete="name" />
              {catalog.member && <span id="name-help" className="text-[13px] text-grey-500">From the member list for ID {memberId.toUpperCase()}.</span>}
            </div>
            <Field id="phone" label="Phone (WhatsApp)" required type="tel" value={details.customerPhone} onChange={(v) => changeDetails("customerPhone", v)} autoComplete="tel" />
            <Field id="email" label="Email (for your invoice)" required type="email" value={details.customerEmail} onChange={(v) => changeDetails("customerEmail", v)} autoComplete="email" />
          </div>
        </Section>
      </div>

      {/* Summary: sticky column on desktop, after the form on phones */}
      <aside aria-label="Booking summary" className="card flex flex-col overflow-hidden shadow-[var(--shadow-card)] lg:sticky lg:top-6">
        <div className="flex flex-col gap-1 bg-navy-900 px-6 py-5 text-white">
          <span className="text-xs font-bold tracking-[0.12em] text-orange-300">YOUR BOOKING</span>
          <span className="text-lg font-bold">{details.serviceDate ? dateLabel(details.serviceDate) : "Pick a date"}</span>
          {cars.map((c, i) => {
            const id = identify(c);
            return id.make && id.model ? (
              <span key={i} className="text-sm text-navy-100">
                {id.make} {id.model}{c.plate.trim() ? ` · ${c.plate.trim().toUpperCase()}` : ""}{id.size ? ` · ${sizeName(id.size)}` : ""}
              </span>
            ) : null;
          })}
        </div>
        <div className="px-6 py-2" aria-live="polite">
          {price ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {price.lines.map((l, i) => (
                <li key={i} className="flex gap-4 border-b border-grey-100 py-3">
                  <div className="flex grow flex-col">
                    <span className="text-[15px] font-bold text-grey-900">{l.label}</span>
                    {l.detail && <span className="text-[13px] text-grey-500">{l.detail}</span>}
                  </div>
                  <span className={`whitespace-nowrap text-[15px] font-bold ${l.amount < 0 ? "text-success" : "text-grey-900"}`}>{lineAmount(l.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`m-0 py-4 text-sm ${shownPriceError ? "font-semibold text-danger" : "text-grey-500"}`}>
              {shownPriceError || (canPrice ? "Working out your price…" : mileage && carsReady ? "Enter your address for the full price." : "Pick your car and a package to see the price.")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
          <div className="flex items-baseline justify-between border-t-2 border-navy-900 pt-4">
            <span className="font-display text-base tracking-[0.06em] text-navy-900">TOTAL</span>
            <span className="font-display text-[40px] tracking-[-0.01em] text-navy-900">{price ? rm(price.total) : "—"}</span>
          </div>
          {catalog.member && price && <span className="-mt-3 text-right text-[13px] font-semibold text-success">Member price</span>}
          {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
          <button type="submit" disabled={paying || !price || !catalog.dates.length} className="btn-primary h-14 text-base">
            {paying ? "Booking… this can take up to a minute" : price ? `Pay & Book Now · ${rm(price.total)}` : "Pay & Book Now"}
          </button>
          <span className="-mt-2 text-center text-xs text-grey-500">You&apos;ll pay securely with HitPay and get your invoice by email.</span>
        </div>
      </aside>
    </form>
  );
}

const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Section({ num, title, aside, children }: { num?: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-center gap-3">
        {num && <span className="font-display text-lg text-orange-500">{num}</span>}
        <h2 className="m-0 grow font-display text-lg tracking-[0.04em] text-navy-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Choice({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-grey-200 px-4 py-2.5 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
      <input type="radio" name={name} className="size-4 accent-orange-600" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function Field({ id, label, value, onChange, className = "field", ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}
