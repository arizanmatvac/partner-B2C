import Image from "next/image";
import type { PartnerCatalog } from "@/lib/calculator";

/** Google Drive share links ("…/file/d/<id>/view") are web pages; Drive's thumbnail link is the image itself (Drive refuses it when sent a referrer). */
function logoSrc(url: string): string {
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  return drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w400` : url;
}

/** Co-branded: Matvac on the left, "in partnership with" the partner on the right. */
export function PartnerHeader({ partner }: { partner: PartnerCatalog["partner"] }) {
  return (
    <header className="bg-navy-900 text-white">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-5 md:px-6">
        <Image src="/matvac-logo.png" alt="Matvac" width={44} height={44} className="size-11 rounded-full" priority />
        <span className="grow font-display text-base tracking-[0.06em] md:text-lg">MATVAC AUTO DETAILING</span>
        <div className="flex items-center gap-3">
          <span className="hidden flex-col items-end text-right sm:flex">
            <span className="text-xs font-semibold tracking-[0.12em] text-grey-300">IN PARTNERSHIP WITH</span>
            {partner.logoUrl && <span className="max-w-[260px] text-sm font-bold leading-snug">{partner.name}</span>}
          </span>
          {partner.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- partner logos are external links set by an admin
            <img src={logoSrc(partner.logoUrl)} alt={partner.name} referrerPolicy="no-referrer" className="h-10 max-w-[140px] rounded bg-white object-contain p-1" />
          ) : (
            <span className="font-bold">{partner.name}</span>
          )}
        </div>
      </div>
    </header>
  );
}
