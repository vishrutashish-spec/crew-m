import { CampaignForm } from "@/components/CampaignForm";

export default function CampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">crew m</p>
        <h1>Draft a client campaign</h1>
        <p>
          Pick the org, say what you want to send. We pull the real segment so you don&apos;t have to
          guess it, draft the copy, and hand you a review card.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
