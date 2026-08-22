"use client";

import { useEffect, useRef, useState } from "react";

type OrgHit = {
  orgId: string;
  org: string;
  segment: string | null;
  serviceTier: string | null;
  activeEmployees: number;
  healthStatus: string | null;
};

type Draft = {
  org: { orgId: string; org: string };
  segmentSummary: string;
  subject: string;
  body: string;
};

export function CampaignForm() {
  const [orgQuery, setOrgQuery] = useState("");
  const [orgHits, setOrgHits] = useState<OrgHit[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgHit | null>(null);
  const [showHits, setShowHits] = useState(false);

  const [requestText, setRequestText] = useState("");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedOrg && orgQuery === selectedOrg.org) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (orgQuery.trim().length < 2) {
      setOrgHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/orgs?q=${encodeURIComponent(orgQuery)}`);
      const data = await res.json();
      setOrgHits(data.orgs ?? []);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgQuery]);

  function selectOrg(org: OrgHit) {
    setSelectedOrg(org);
    setOrgQuery(org.org);
    setShowHits(false);
    setDraft(null);
    setSentId(null);
  }

  async function compose() {
    if (!selectedOrg) return;
    setComposing(true);
    setError(null);
    setSentId(null);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: selectedOrg.orgId, request: requestText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drafting failed");
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setComposing(false);
    }
  }

  async function markReady() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/campaign/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgId: draft.org.orgId,
          orgName: draft.org.org,
          requestText,
          segmentSummary: draft.segmentSummary,
          subject: draft.subject,
          body: draft.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save this campaign");
      setSentId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this campaign");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-ink" htmlFor="org">
            Organization
          </label>
          <input
            id="org"
            value={orgQuery}
            onChange={(e) => {
              setOrgQuery(e.target.value);
              setSelectedOrg(null);
              setShowHits(true);
            }}
            onFocus={() => setShowHits(true)}
            placeholder="Start typing a client name…"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-plum"
          />
          {showHits && orgHits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-paper shadow-none">
              {orgHits.map((org) => (
                <li key={org.orgId}>
                  <button
                    type="button"
                    onClick={() => selectOrg(org)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-mist"
                  >
                    <span className="text-ink">{org.org}</span>
                    <span className="mono text-xs text-faint">
                      {org.activeEmployees.toLocaleString()} employees
                      {org.segment ? ` · ${org.segment.replace(/-/g, " ")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedOrg && (
          <div className="highlight text-sm">
            <p className="eyebrow mb-1">Real segment, not a guess</p>
            <p className="text-ink">
              {selectedOrg.activeEmployees.toLocaleString()} active employees
              {selectedOrg.segment ? ` · ${selectedOrg.segment.replace(/-/g, " ")}` : ""}
              {selectedOrg.serviceTier ? ` · ${selectedOrg.serviceTier} tier` : ""}
              {selectedOrg.healthStatus ? ` · health: ${selectedOrg.healthStatus.toLowerCase()}` : ""}
            </p>
          </div>
        )}

        <label className="block text-sm font-medium text-ink" htmlFor="request">
          What do you want to send?
        </label>
        <textarea
          id="request"
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          rows={4}
          placeholder="e.g. Renewal reminder — mention the new dental benefit, friendly tone"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-plum"
        />

        <button
          onClick={compose}
          disabled={composing || !selectedOrg || !requestText}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {composing ? "Drafting…" : "Draft campaign"}
        </button>

        {error && (
          <p className="rounded-lg bg-signal-wash px-4 py-2 text-sm text-signal">{error}</p>
        )}
      </div>

      <div className="card space-y-4">
        {!draft ? (
          <p className="text-sm text-faint">Your draft will appear here once you compose one.</p>
        ) : (
          <>
            <p className="eyebrow">{draft.org.org}</p>
            <p className="mono text-xs text-stone">{draft.segmentSummary}</p>

            <label className="block text-sm font-medium text-ink" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-plum"
            />

            <label className="block text-sm font-medium text-ink" htmlFor="body">
              Body
            </label>
            <textarea
              id="body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-plum"
            />

            <button
              onClick={markReady}
              disabled={sending || !!sentId}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sentId ? "Ready to launch" : sending ? "Saving…" : "Mark as ready to send"}
            </button>

            <p className="text-xs text-faint">
              This build doesn&apos;t dispatch a live CleverTap campaign — the connection here is
              read-only. &ldquo;Mark as ready to send&rdquo; saves the reviewed draft to your
              campaign queue.
            </p>

            {sentId && (
              <p className="rounded-lg bg-plum-wash px-4 py-2 text-sm text-plum-ink">
                Saved to your campaign queue.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
