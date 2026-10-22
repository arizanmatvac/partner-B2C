"use client";

import { useState } from "react";
import { toBlob } from "html-to-image";

/**
 * Share: the booking card as a PNG through the phone's share sheet (WhatsApp, Save image…), or a
 * download where the browser can't share files. Save as PDF: the browser's print dialog.
 */
export function ShareButtons({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function share() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      if (!blob) throw new Error("no image");
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: window.location.href });
      } else {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
        URL.revokeObjectURL(url);
        setNote("Saved as an image to your downloads.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={share} disabled={busy} className="btn-outline h-12 rounded-[10px] text-[15px]">
          {busy ? "Preparing…" : "Share / save image"}
        </button>
        <button type="button" onClick={() => window.print()} className="btn-outline h-12 rounded-[10px] text-[15px]">
          Save as PDF
        </button>
      </div>
      {note && <span role="status" className="text-[13px] text-grey-500">{note}</span>}
    </div>
  );
}
