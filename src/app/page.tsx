import { notFound } from "next/navigation";

// Only partner pages (/<partner>) exist.
export default function Home() {
  notFound();
}
