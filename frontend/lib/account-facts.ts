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
  familyDefinition?: string;
  maternity?: string;
  prePostNatal?: string;
  babyDayOne?: string;
  ambulance?: string;
  lasik?: string;
  ayush?: string;
  copay?: string;
  tpa?: string;
  source: string;
}

const FACTS: Record<string, AccountFacts> = {
  // Sum insured is ALWAYS the word "Graded" - never the per-grade amounts.
  // A whole org reads the email and grades differ per person. Confirmed
  // against the Open Financial production email.
  "open financial": {
    displayName: "Open Financial",
    insurer: "Niva Bupa",
    benefitType: "Comprehensive Health Insurance - ESC",
    coverStart: "21 August 2026",
    sumInsured: "Graded",
    familyDefinition: "ESC (Employee + Spouse + Children)",
    tpa: "In-house",
    maternity: "₹1,00,000 for normal delivery and C-section delivery",
    prePostNatal: "covered up to ₹5,000 within the maternity limit",
    babyDayOne: "Newborn babies are covered from day 1",
    ambulance: "Covered up to ₹5,000 per hospitalisation",
    lasik: "Covered for correction above +/-7.5D",
    ayush: "Covered up to 100% of sum insured in case of IPD",
    source: "Production welcome email, 21 Aug 2026 (reference shared by Oshin)",
  },
  groww: {
    displayName: "Groww",
    insurer: "Bajaj Allianz General Insurance",
    benefitType: "Comprehensive Health Insurance",
    coverStart: "7 December 2025",
    coverEnd: "6 December 2026",
    sumInsured: "Graded",
    // Maternity, ambulance, LASIK and Ayush limits are NOT in any warehouse
    // dataset and were not supplied by the AM, so the benefits section is
    // omitted rather than guessed.
    source: "iw_policy_si, policy OG-26-9906-8403-00000493, read 2026-08-22",
  },
  prochant: {
    displayName: "Prochant",
    insurer: "ICICI Lombard",
    benefitType: "Comprehensive Health Insurance - ESC",
    coverStart: "29 September 2026",
    coverEnd: "28 September 2027",
    sumInsured: "Graded",
    familyDefinition: "ESC (Employee + Spouse + Children)",
    tpa: "In-house",
    maternity: "₹50,000 for normal delivery and C-section delivery",
    copay: "No copayment on your plan",
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
    f.sumInsured ? `Sum Insured: ${f.sumInsured}` : null,
    f.familyDefinition ? `Family definition: ${f.familyDefinition}` : null,
    f.tpa ? `TPA: ${f.tpa}` : null,
    f.maternity ? `Maternity Limit: ${f.maternity}` : null,
    f.prePostNatal ? `Pre-Post Natal Expenses: ${f.prePostNatal}` : null,
    f.babyDayOne ? `Baby Day Coverage: ${f.babyDayOne}` : null,
    f.ambulance ? `Ambulance Charges: ${f.ambulance}` : null,
    f.lasik ? `LASIK Surgery: ${f.lasik}` : null,
    f.ayush ? `Ayush: ${f.ayush}` : null,
    f.copay ? `Copayment: ${f.copay}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
