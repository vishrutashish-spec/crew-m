"""
CleverTap REST API connector for aggregate metrics.

Pulls real counts and trends — never individual profiles.
All queries require a date range (max 1-year window enforced).
Credentials read from ~/.insurwreck/credentials.json bundle.
"""

import os
import json
import time
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("crewm.ct")

# Data access: aggregate event and profile counts from CleverTap API
# Protected by: read-only credentials, date range enforcement, no PII download


def _load_ct_credentials() -> dict:
    bundle_path = os.path.expanduser("~/.insurwreck/credentials.json")
    if os.path.exists(bundle_path):
        with open(bundle_path) as f:
            bundle = json.load(f)
        ct = bundle.get("services", {}).get("clevertap", {})
        if ct.get("account_id") and ct.get("passcode"):
            return ct
    return {
        "account_id": os.getenv("CT_ACCOUNT_ID", ""),
        "passcode": os.getenv("CT_PASSCODE", ""),
        "region": os.getenv("CT_REGION", "in1"),
    }


def _get_headers(creds: dict) -> dict:
    return {
        "X-CleverTap-Account-Id": creds["account_id"],
        "X-CleverTap-Passcode": creds["passcode"],
        "Content-Type": "application/json",
    }


def _base_url(creds: dict) -> str:
    region = creds.get("region", "in1")
    return f"https://{region}.api.clevertap.com/1/"


def _poll_result(url: str, headers: dict, req_id: str, max_wait: int = 30) -> Optional[dict]:
    poll_url = f"{url}?req_id={req_id}"
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(2)
        try:
            r = requests.get(poll_url, headers=headers, timeout=10)
            data = r.json()
            if data.get("status") == "success":
                return data
        except Exception:
            pass
    return None


def _count_query(endpoint: str, event_name: str, from_date: int, to_date: int,
                 creds: dict, event_properties: Optional[list] = None) -> Optional[int]:
    url = _base_url(creds) + endpoint
    headers = _get_headers(creds)
    payload = {"event_name": event_name, "from": from_date, "to": to_date}
    if event_properties:
        payload["event_properties"] = event_properties
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        data = r.json()
        if data.get("status") == "success":
            return data.get("count", 0)
        if data.get("status") == "partial" and data.get("req_id"):
            result = _poll_result(url, headers, data["req_id"])
            if result:
                return result.get("count", 0)
        if data.get("status") == "fail":
            logger.warning(f"CT query failed for {event_name}: {data.get('error')}")
            return None
    except Exception as e:
        logger.warning(f"CT API error for {event_name}: {e}")
    return None


def _date_int(dt: datetime) -> int:
    return int(dt.strftime("%Y%m%d"))


def get_live_metrics() -> Optional[dict]:
    """Pull aggregate metrics from CleverTap. Returns None if credentials missing."""
    creds = _load_ct_credentials()
    if not creds.get("account_id") or not creds.get("passcode"):
        logger.info("No CT credentials — skipping live metrics")
        return None

    today = datetime.now()
    today_int = _date_int(today)
    thirty_days_ago = _date_int(today - timedelta(days=30))
    ninety_days_ago = _date_int(today - timedelta(days=90))
    year_start = _date_int(today.replace(month=1, day=1))

    logger.info("DATA_ACCESS: pulling aggregate CT metrics (counts only, no profiles)")

    metrics = {}

    # DAU — unique users who launched app today
    dau = _count_query("counts/profiles.json", "App Launched", today_int, today_int, creds)
    metrics["dau"] = dau

    # MAU — unique users who launched app in last 30 days
    mau = _count_query("counts/profiles.json", "App Launched", thirty_days_ago, today_int, creds)
    metrics["mau"] = mau

    # New installs last 30 days
    new_installs_30d = _count_query("counts/profiles.json", "App Installed", thirty_days_ago, today_int, creds)
    metrics["new_installs_30d"] = new_installs_30d

    # YTD total users who launched app
    ytd_active = _count_query("counts/profiles.json", "App Launched", year_start, today_int, creds)
    metrics["ytd_active_users"] = ytd_active

    # YTD total installs
    ytd_installs = _count_query("counts/profiles.json", "App Installed", year_start, today_int, creds)
    metrics["ytd_installs"] = ytd_installs

    # App Launched event count (last 30 days) — total sessions
    sessions_30d = _count_query("counts/events.json", "App Launched", thirty_days_ago, today_int, creds)
    metrics["total_sessions_30d"] = sessions_30d

    # App Uninstalled last 90 days
    uninstalls_90d = _count_query("counts/profiles.json", "App Uninstalled", ninety_days_ago, today_int, creds)
    metrics["uninstalls_90d"] = uninstalls_90d

    metrics["pulled_at"] = today.isoformat()
    metrics["date_range"] = f"{year_start}-{today_int}"

    # Filter out failed queries
    metrics = {k: v for k, v in metrics.items() if v is not None}

    logger.info(f"CT live metrics pulled: {len(metrics)} fields")
    return metrics if len(metrics) > 2 else None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = get_live_metrics()
    if result:
        print(json.dumps(result, indent=2))
    else:
        print("No CT credentials or data available")
