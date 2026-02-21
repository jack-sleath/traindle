"""
Generate footfall-map.json from ORR station usage data
=======================================================
Downloads Table 1410 (Passenger entries and exits by station) from the
Office of Rail and Road data portal and maps each CRS code to a
FootfallBand value used by the game.

Source:
  https://dataportal.orr.gov.uk/statistics/usage/estimates-of-station-usage/

Bands (annual entries + exits, i.e. total footfall):
  <10k        < 10,000
  10k-100k    10,000 – 99,999
  100k-500k   100,000 – 499,999
  500k-1m     500,000 – 999,999
  1m-5m       1,000,000 – 4,999,999
  5m-10m      5,000,000 – 9,999,999
  10m+        ≥ 10,000,000

Run:
  python scripts/generate_footfall_map.py

Output:
  scripts/footfall-map.json
"""

import os
import io
import csv
import json
import logging
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

ORR_CSV_URL = (
    "https://dataportal.orr.gov.uk/media/1909/"
    "table-1410-passenger-entries-and-exits-and-interchanges-by-station.csv"
)
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "footfall-map.json")

# Ordered thresholds → band name (checked from highest to lowest)
BANDS = [
    (10_000_000, "10m+"),
    (5_000_000,  "5m-10m"),
    (1_000_000,  "1m-5m"),
    (500_000,    "500k-1m"),
    (100_000,    "100k-500k"),
    (10_000,     "10k-100k"),
    (0,          "<10k"),
]


def footfall_band(value: float) -> str:
    for threshold, band in BANDS:
        if value >= threshold:
            return band
    return "<10k"


def main():
    log.info(f"Downloading ORR CSV from {ORR_CSV_URL} ...")
    r = requests.get(ORR_CSV_URL, timeout=60)
    r.raise_for_status()
    log.info(f"Downloaded {len(r.content):,} bytes")

    # The ORR CSV has a complex multi-row header (rows 0-9 are metadata/header).
    # Data rows start at row 10.  Column layout (0-indexed):
    #   0  = Station name
    #   1  = Entries & exits: full price
    #   2  = Entries & exits: reduced price
    #   3  = Entries & exits: season
    #   4  = Entries & exits: ALL tickets  ← use this
    #   5  = Rank
    #   6  = Interchanges
    #   7  = Main origin/destination
    #   8  = Journeys to/from main O/D
    #   9  = Data source
    #  10  = Estimates supplemented flag
    #  11  = Quality limitations
    #  12  = Additional information
    #  13  = NLC (National Location Code)
    #  14  = CRS (Three-letter code)       ← use this
    #  15  = Region
    #  16  = Station facility owner
    #  17  = Station group
    COL_FOOTFALL = 4
    COL_CRS      = 14
    HEADER_ROWS  = 10  # skip rows 0-9

    footfall_map: dict[str, str] = {}
    skipped = 0

    reader = csv.reader(io.StringIO(r.text))
    for i, row in enumerate(reader):
        if i < HEADER_ROWS:
            continue
        if len(row) <= max(COL_FOOTFALL, COL_CRS):
            skipped += 1
            continue

        crs = row[COL_CRS].strip().upper()
        if not crs or len(crs) != 3:
            skipped += 1
            continue

        raw_val = row[COL_FOOTFALL].strip().replace(",", "")
        try:
            value = float(raw_val)
        except ValueError:
            skipped += 1
            continue

        footfall_map[crs] = footfall_band(value)

    log.info(f"Mapped {len(footfall_map)} stations (skipped {skipped} rows)")

    # Band distribution
    from collections import Counter
    dist = Counter(footfall_map.values())
    for band, _ in BANDS:
        pass  # just for ordering
    for _threshold, band in reversed(BANDS):
        if band in dist:
            log.info(f"  {band:>12s}: {dist[band]:>4d} stations")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(footfall_map, f, indent=2, ensure_ascii=False)
    log.info(f"✅ Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
