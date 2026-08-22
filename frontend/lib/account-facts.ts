/**
 * Warehouse-verified policy facts, keyed by the account name an AM types.
 *
 * Every field here was read from the Plum warehouse (iw_policy_si 19648,
 * policy_schedule 19251) or a build sheet derived from it — nothing is
 * inferred. If an account is missing, the copy route writes the correct
 * structure but omits specifics rather than inventing them, because a wrong
 * sum insured or renewal date in a member email is worse than a vague one.
 *
 * Known gap: maternity / copay / room-rent limits live in policy_schedule,
 * which the data API exposes without an org filter, so they can only be
 * filled in per account by hand today. Ambulance cap, LASIK and Ayush are
 * genuinely absent from every dataset — the AM must supply them.
 */
export interface AccountFacts {
  displayName: string;
  insurer: string;
  benefitType: string;
  coverStart?: string;
  coverEnd?: string;
  sumInsured?: string;
  maternity?: string;
  copay?: string;
  tpa?: string;
  source: string;
}

const FACTS: Record<string, AccountFacts> = {
  groww: {
    displayName: "Groww",
    insurer: "Bajaj Allianz General Insurance",
    benefitType: "Group Medical Cover",
    coverStart: "7 December 2025",
    coverEnd: "6 December 2026",
    sumInsured: "graded — ₹5,00,000 / ₹10,00,000 / ₹15,00,000 / ₹20,00,000 depending on your grade",
    source: "iw_policy_si, policy OG-26-9906-8403-00000493, read 2026-08-22",
  },
  prochant: {
    displayName: "Prochant",
    insurer: "ICICI Lombard",
    benefitType: "Group Medical Cover",
    coverStart: "29 September 2026",
    coverEnd: "28 September 2027",
    sumInsured: "graded — ₹5,00,000 / ₹10,00,000 / ₹20,00,000 depending on your grade",
    maternity: "₹50,000 for normal and caesarean delivery",
    copay: "No copayment on your plan",
    tpa: "claims handled in-house by Plum",
    source: "policy_schedule via BUILD-SHEET-prochant-welcome.md",
  },
};

export function lookupAccountFacts(accountName?: string): AccountFacts | null {
  if (!accountName) return null;
  const key = accountName.trim().toLowerCase();
  if (FACTS[key]) return FACTS[key];
  // tolerate "Groww - 2025 to 2026", "Groww Pvt Ltd" etc.
  const hit = Object.keys(FACTS).find((k) => key.startsWith(k) || key.includes(k));
  return hit ? FACTS[hit] : null;
}

/** Render the facts as a block the copy model can quote from verbatim. */
export function factsForPrompt(f: AccountFacts): string {
  const lines = [
    `Account: ${f.displayName}`,
    `Insurer: ${f.insurer}`,
    `Benefit: ${f.benefitType}`,
    f.coverStart ? `Cover starts: ${f.coverStart}` : null,
    f.coverEnd ? `Cover ends / renews: ${f.coverEnd}` : null,
    f.sumInsured ? `Sum insured: ${f.sumInsured}` : null,
    f.maternity ? `Maternity: ${f.maternity}` : null,
    f.copay ? `Copayment: ${f.copay}` : null,
    f.tpa ? `Claims handling: ${f.tpa}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
