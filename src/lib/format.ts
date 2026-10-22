/** "RM 1,350" or "RM 1,350.50". */
export function rm(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0;
  return "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

/** Deductions as "− RM 50". */
export const lineAmount = (amount: number) => (amount < 0 ? `− ${rm(-amount)}` : rm(amount));
