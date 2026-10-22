"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelAction } from "../../actions";

/**
 * Undoes an unpaid booking (the calculator deletes its invoice, payment link and quote) and goes back to
 * the booking form, filled in as before, to try again. `auto`: HitPay said the payment failed or was cancelled.
 */
export function CancelBooking({ slug, id, auto }: { slug: string; id: string; auto: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(auto);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function cancel() {
    setBusy(true);
    setError("");
    const res = await cancelAction(slug, id);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    router.replace(`/${slug}?retry=1`);
  }

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    cancelAction(slug, id).then((res) => {
      if (res.ok) return router.replace(`/${slug}?retry=1`);
      setBusy(false);
      setError(res.error);
    });
  }, [auto, slug, id, router]);

  return (
    <div className="no-print flex flex-col gap-2">
      {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
      <button type="button" onClick={cancel} disabled={busy} className="btn-outline h-12 rounded-[10px] text-[15px]">
        {busy ? (auto ? "Payment didn't go through, cancelling…" : "Cancelling…") : "Cancel and start again"}
      </button>
    </div>
  );
}
