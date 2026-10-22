import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/calculator";
import { PartnerHeader } from "./PartnerHeader";
import { QuoteForm } from "./QuoteForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const c = await getCatalog((await params).slug);
  return { title: c ? `Matvac × ${c.partner.name}` : "Not found" };
}

export default async function PartnerPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const catalog = await getCatalog(slug);
  if (!catalog) notFound();

  return (
    <>
      <PartnerHeader partner={catalog.partner} />
      <main className="mx-auto flex w-full max-w-[1200px] grow flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[26px] tracking-[0.02em] text-navy-900 md:text-[32px]">BOOK YOUR DETAILING</h1>
          <p className="m-0 text-[15px] text-grey-700">
            At {catalog.partner.name} partner prices{catalog.mileage.ratePerKm > 0 ? " (travel to your address is included in the price)" : ", with no travel charge"}.
            Pick a date and your car, choose a package, then pay to confirm your booking.
          </p>
        </div>
        {catalog.oneOffs.length ? (
          <QuoteForm slug={slug} catalog={catalog} />
        ) : (
          <p className="card m-0 p-6 text-grey-700">Packages are coming soon.</p>
        )}
      </main>
    </>
  );
}
