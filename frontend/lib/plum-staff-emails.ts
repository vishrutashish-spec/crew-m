/**
 * Hand-maintained list of Plum staff email addresses, for "send to everyone
 * at Plum" test sends.
 *
 * This is NOT queried live from CleverTap. Checked first: CleverTap's
 * hackathon tier has no reliable way to do it — the Segments/API attribute
 * filter is Private Beta only (CSM access required, not available here;
 * CLEVERTAP_PLATFORM_REFERENCE.md §3.8), and every profile-read endpoint is
 * event-anchored ("profiles who did X"), not filterable by an email domain.
 * A live "email ends with @plumhq.com" query simply isn't available, and
 * SESSION-HANDOFF.md separately documents that this account's equals-style
 * profile filters can silently ignore the filter and return the entire
 * 680k+ base instead — building an automatic resolver on top of either gap
 * risks turning "email my ~N coworkers" into "email the whole customer
 * base." A static, hand-verified list side-steps both problems, the same
 * way account-facts.ts handles other verified-but-unqueryable data.
 *
 * Keep this list current by editing it directly — add or remove addresses
 * as staff change. /api/campaign/send refuses to send to "everyone at Plum"
 * if this list is empty, so an unmaintained list fails loud, not by
 * mailing the wrong people.
 */
export const PLUM_STAFF_EMAILS: string[] = [
  "krtin.k@plumhq.com",
];
