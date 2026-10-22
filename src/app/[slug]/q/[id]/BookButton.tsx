"use client";

import { useState } from "react";
import { rm } from "@/lib/format";
import { bookAction } from "../../actions";

/** Books the date picked with the quote, then goes straight to HitPay to pay in full. */
export function BookButton({ slug, id, total }: { slug: string; id: string; total: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function book() {
    setBusy(true);
    setError("");
    const res = await bookAction(slug, id);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    if (res.data.paymentUrl) window.location.assign(res.data.paymentUrl);
    else window.location.reload();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
      <button type="button" onClick={book} disabled={busy} className="btn-primary h-14 text-base">
        {busy ? "Booking… this can take up to a minute" : `Pay & Book Now · ${rm(total)}`}
      </button>
    </div>
  );
}
