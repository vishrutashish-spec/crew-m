"""
ML pipeline: feature engineering → clustering → persona discovery → prediction.

Personas emerge from K-Means clustering on real behavioral features.
The LLM writes narrative descriptions, but every claim traces to cluster statistics.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import json
from config import N_PERSONAS, RANDOM_SEED


# Features used for clustering (all numeric, behavioral)
CLUSTER_FEATURES = [
    "age",
    "tenure_months",
    "th_consult_count",
    "th_funnel_depth",
    "hc_booking_count",
    "hc_funnel_depth",
    "app_launches_30d",
    "days_since_active",
    "peak_activity_hour",
    "notif_response_rate",
    "campaign_fatigue",
    "wallet_expiry_days",
    # Encoded categoricals
    "has_app_enc",
    "is_dnd_enc",
    "has_th_booking_enc",
    "has_hc_booking_enc",
    "gender_female",
    "segment_ent",
    "segment_smb",
    "segment_mm",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Convert raw user data into ML-ready feature matrix."""
    feat = df.copy()

    feat["has_app_enc"] = feat["has_app"].astype(float)
    feat["is_dnd_enc"] = feat["is_dnd"].astype(float)
    feat["has_th_booking_enc"] = feat["has_th_booking"].astype(float)
    feat["has_hc_booking_enc"] = feat["has_hc_booking"].astype(float)
    feat["gender_female"] = (feat["gender"] == "FEMALE").astype(float)
    feat["segment_ent"] = (feat["partner_segment"] == "ENT").astype(float)
    feat["segment_smb"] = (feat["partner_segment"] == "SMB").astype(float)
    feat["segment_mm"] = (feat["partner_segment"] == "MM").astype(float)

    return feat


def cluster_users(df: pd.DataFrame, n_clusters: int = N_PERSONAS) -> dict:
    """
    Run K-Means clustering and return persona definitions.

    Returns dict with:
    - labels: cluster assignment per user
    - personas: list of persona dicts with statistics
    - silhouette: model quality score
    - scaler: fitted StandardScaler
    - model: fitted KMeans
    """
    feat = engineer_features(df)
    X = feat[CLUSTER_FEATURES].fillna(0).values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=n_clusters, random_state=RANDOM_SEED, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    sil_score = silhouette_score(X_scaled, labels, sample_size=min(5000, len(X_scaled)))

    feat["cluster"] = labels

    personas = []
    for c in range(n_clusters):
        cluster_df = feat[feat["cluster"] == c]
        n = len(cluster_df)

        persona = {
            "id": c,
            "size": n,
            "share": round(n / len(feat), 3),

            # OBSERVED: demographics
            "avg_age": round(cluster_df["age"].mean(), 1),
            "female_share": round(cluster_df["gender_female"].mean(), 3),
            "segment_mix": {
                "ENT": round(cluster_df["segment_ent"].mean(), 3),
                "SMB": round(cluster_df["segment_smb"].mean(), 3),
                "MM": round(cluster_df["segment_mm"].mean(), 3),
                "EOR": round(1 - cluster_df[["segment_ent", "segment_smb", "segment_mm"]].sum(axis=1).mean(), 3),
            },

            # OBSERVED: engagement
            "app_installed_share": round(cluster_df["has_app_enc"].mean(), 3),
            "avg_app_launches_30d": round(cluster_df["app_launches_30d"].mean(), 1),
            "avg_days_since_active": round(cluster_df["days_since_active"].mean(), 1),
            "avg_notif_response_rate": round(cluster_df["notif_response_rate"].mean(), 3),
            "avg_campaign_fatigue": round(cluster_df["campaign_fatigue"].mean(), 3),
            "peak_hour_mode": int(cluster_df["peak_activity_hour"].mode().iloc[0]) if len(cluster_df) > 0 else 20,

            # OBSERVED: product usage
            "th_adoption_rate": round(cluster_df["has_th_booking_enc"].mean(), 3),
            "avg_th_consults": round(cluster_df["th_consult_count"].mean(), 1),
            "avg_th_funnel_depth": round(cluster_df["th_funnel_depth"].mean(), 2),
            "hc_adoption_rate": round(cluster_df["has_hc_booking_enc"].mean(), 3),
            "avg_hc_bookings": round(cluster_df["hc_booking_count"].mean(), 2),
            "avg_hc_funnel_depth": round(cluster_df["hc_funnel_depth"].mean(), 2),

            # OBSERVED: reachability
            "dnd_share": round(cluster_df["is_dnd_enc"].mean(), 3),
            "avg_tenure_months": round(cluster_df["tenure_months"].mean(), 1),
            "avg_wallet_expiry_days": round(cluster_df["wallet_expiry_days"].mean(), 1),

            # Channel reachability
            "channel_reach": {
                "whatsapp": round(cluster_df["whatsapp_reachable"].astype(float).mean(), 3),
                "sms": round(cluster_df["sms_reachable"].astype(float).mean(), 3),
                "email": round(cluster_df["email_reachable"].astype(float).mean(), 3),
                "push": round(cluster_df["push_reachable"].astype(float).mean(), 3),
            },

            # Top lifecycle states
            "lifecycle_distribution": cluster_df["lifecycle_state"].value_counts(normalize=True).head(3).to_dict(),

            # Top TH specialties
            "top_th_specialties": cluster_df[cluster_df["has_th_booking"]]["th_primary_specialty"].value_counts().head(3).to_dict() if cluster_df["has_th_booking"].any() else {},

            # HRA status distribution
            "hra_distribution": cluster_df["hra_status"].value_counts(normalize=True).to_dict(),
        }
        personas.append(persona)

    # Sort by size descending
    personas.sort(key=lambda p: p["size"], reverse=True)
    for i, p in enumerate(personas):
        p["rank"] = i + 1

    return {
        "labels": labels,
        "personas": personas,
        "silhouette_score": round(sil_score, 4),
        "n_users": len(df),
        "n_clusters": n_clusters,
        "features_used": CLUSTER_FEATURES,
    }


def assign_persona_names(personas: list) -> list:
    """
    Assign descriptive names based on cluster characteristics.
    These are plain names — no fantasy naming.
    """
    for p in personas:
        traits = []

        # Engagement level
        if p["avg_days_since_active"] < 14:
            engagement = "Active"
        elif p["avg_days_since_active"] < 60:
            engagement = "Occasional"
        else:
            engagement = "Dormant"

        # Product affinity
        if p["th_adoption_rate"] > 0.15 and p["hc_adoption_rate"] > 0.15:
            product = "Dual-Product"
        elif p["th_adoption_rate"] > 0.15:
            product = "TH-Engaged"
        elif p["hc_adoption_rate"] > 0.15:
            product = "HC-Engaged"
        elif p["app_installed_share"] < 0.3:
            product = "No-App"
        else:
            product = "Pre-Activation"

        # Special modifiers
        if p["dnd_share"] > 0.1:
            traits.append("DND-Locked")
        if p["avg_campaign_fatigue"] > 0.5:
            traits.append("Fatigued")
        if p["avg_tenure_months"] < 3:
            traits.append("New")
        elif p["avg_tenure_months"] > 9:
            traits.append("Tenured")

        modifier = f" ({', '.join(traits)})" if traits else ""
        p["name"] = f"{engagement} {product}{modifier}"

    return personas


def score_audience_fit(persona: dict, campaign_objective: str) -> dict:
    """
    Score how well a persona fits a campaign objective.
    Returns a fit score (0-100) with reasoning.

    All scores are RECOMMENDED — the system's suggestion based on OBSERVED data.
    """
    score = 50  # baseline
    reasons = []

    if campaign_objective == "th_activation":
        # Want people who haven't booked TH but could
        if persona["th_adoption_rate"] < 0.05:
            score += 20
            reasons.append("Low TH adoption = high activation headroom")
        if persona["avg_th_funnel_depth"] > 0:
            score += 15
            reasons.append("Already explored TH funnel — warm intent")
        if persona["app_installed_share"] > 0.5:
            score += 10
            reasons.append("App installed — can receive push + in-app")
        if persona["dnd_share"] > 0.1:
            score -= 20
            reasons.append("High DND share limits direct messaging")

    elif campaign_objective == "hc_activation":
        if persona["hc_adoption_rate"] < 0.05:
            score += 20
            reasons.append("Low HC adoption = high activation headroom")
        if persona["avg_wallet_expiry_days"] < 90:
            score += 15
            reasons.append("Wallet expiring soon — natural urgency")
        if persona["avg_hc_funnel_depth"] > 0:
            score += 10
            reasons.append("Already explored HC funnel")

    elif campaign_objective == "app_install":
        if persona["app_installed_share"] < 0.3:
            score += 30
            reasons.append("Very low app install rate — primary target")
        if persona["avg_tenure_months"] < 3:
            score += 10
            reasons.append("New users — onboarding window still open")

    elif campaign_objective == "reengagement":
        if persona["avg_days_since_active"] > 60:
            score += 25
            reasons.append("Dormant users — reengagement target")
        if persona["avg_notif_response_rate"] > 0.1:
            score += 10
            reasons.append("Some notification responsiveness remains")
        if persona["avg_campaign_fatigue"] > 0.5:
            score -= 15
            reasons.append("High fatigue — risk of opt-out")

    elif campaign_objective == "hc_crosssell":
        if persona["th_adoption_rate"] > 0.1 and persona["hc_adoption_rate"] < 0.1:
            score += 25
            reasons.append("TH users who haven't tried HC — cross-sell sweet spot")

    # Channel feasibility bonus
    best_channel = max(persona["channel_reach"], key=persona["channel_reach"].get)
    if persona["channel_reach"][best_channel] > 0.9:
        score += 5
        reasons.append(f"High {best_channel} reachability ({persona['channel_reach'][best_channel]:.0%})")

    score = max(0, min(100, score))

    return {
        "persona_id": persona["id"],
        "persona_name": persona.get("name", f"Persona {persona['id']}"),
        "score": score,
        "reasons": reasons,
        "best_channel": best_channel,
        "label": "RECOMMENDED",
    }


if __name__ == "__main__":
    from synthetic import generate_users

    users = generate_users(10_000)
    result = cluster_users(users)

    personas = assign_persona_names(result["personas"])

    print(f"Silhouette score: {result['silhouette_score']}")
    print(f"Number of personas: {len(personas)}\n")

    for p in personas:
        print(f"  #{p['rank']} {p['name']}")
        print(f"     Size: {p['size']} ({p['share']:.1%}) | Age: {p['avg_age']} | App: {p['app_installed_share']:.0%}")
        print(f"     TH: {p['th_adoption_rate']:.1%} | HC: {p['hc_adoption_rate']:.1%} | Active: {p['avg_days_since_active']:.0f}d ago")
        print()

    print("\n--- Audience fit for 'hc_activation' ---")
    for p in personas:
        fit = score_audience_fit(p, "hc_activation")
        print(f"  {fit['persona_name']}: {fit['score']}/100 — {', '.join(fit['reasons'][:2])}")
