"""
Fetch raw station list from davwheat/uk-railway-stations
=========================================================
Downloads the community-maintained station dataset from GitHub and saves it
as scripts/raw-stations.json, which is the base input for compile-stations.ts.

Source: https://github.com/davwheat/uk-railway-stations
Licence: ODbL (Open Database Licence)

Prerequisites:
  pip install requests

Run:
  python scripts/fetch_raw_stations.py
"""

import os
import json
import requests
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SOURCE_URL = "https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "raw-stations.json")


def main():
    log.info(f"Downloading station list from {SOURCE_URL} ...")
    r = requests.get(SOURCE_URL, timeout=30)
    r.raise_for_status()

    stations = r.json()
    log.info(f"Downloaded {len(stations)} stations")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(stations, f, indent=2, ensure_ascii=False)

    log.info(f"✅ Saved to {OUTPUT_FILE}")

    # Quick sanity check on the first record
    first = stations[0]
    expected_fields = {"stationName", "lat", "long", "crsCode", "constituentCountry"}
    missing = expected_fields - set(first.keys())
    if missing:
        log.warning(f"Unexpected schema — missing fields: {missing}")
        log.warning(f"First record keys: {list(first.keys())}")
    else:
        log.info(f"Schema OK — first station: {first['stationName']} ({first['crsCode']})")


if __name__ == "__main__":
    main()
