"""
UK Train Station Scraper - National Rail Knowledgebase + DTD Timetable
=======================================================================
Combines two feeds from opendata.nationalrail.co.uk:

  1. Knowledgebase Stations XML  → name, CRS, owning operator, platforms,
                                    station type, region, facilities
  2. DTD Timetable (CIF format)  → all TOCs that actually call at each station

Prerequisites:
  1. Register free at https://opendata.nationalrail.co.uk
  2. Subscribe to "Knowledgebase (KB) API" AND "DTD" on your account
  3. pip install requests

Run:
  python scrape_stations_nrdp.py --username you@email.com --password yourpassword

Output:
  uk_stations.json
"""

import os
import requests
import zipfile
import io
import xml.etree.ElementTree as ET
import json
import argparse
import logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

BASE_URL   = "https://opendata.nationalrail.co.uk"
AUTH_URL   = f"{BASE_URL}/authenticate"
KB_STATIONS_URL = f"{BASE_URL}/api/staticfeeds/4.0/stations"
# Try these in order until one succeeds
DTD_TIMETABLE_URLS = [
    f"{BASE_URL}/api/staticfeeds/3.0/timetable",
    f"{BASE_URL}/api/staticfeeds/2.0/timetable",
    f"{BASE_URL}/api/staticfeeds/4.0/timetable",
]
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "uk_stations.json")

# TOC code -> operator name (for display)
TOC_NAMES = {
    "SE": "Southeastern",
    "SN": "Southern",
    "TL": "Thameslink",
    "GN": "Great Northern",
    "XR": "Elizabeth line",
    "NT": "Northern",
    "TP": "TransPennine Express",
    "VT": "Avanti West Coast",
    "XC": "CrossCountry",
    "GW": "Great Western Railway",
    "GR": "LNER",
    "CC": "c2c",
    "CH": "Chiltern Railways",
    "EM": "East Midlands Railway",
    "LE": "Greater Anglia",
    "HT": "Hull Trains",
    "LO": "London Overground",
    "ME": "Merseyrail",
    "SR": "ScotRail",
    "SW": "South Western Railway",
    "LM": "West Midlands Trains",
    "HX": "Heathrow Express",
    "GC": "Grand Central",
    "CS": "Caledonian Sleeper",
    "AW": "Transport for Wales",
    "GX": "Gatwick Express",
    "IL": "Island Line",
}


# ── Step 1: Authenticate ─────────────────────────────────────────────────────

def authenticate(username: str, password: str) -> str:
    """Returns an X-Auth-Token string."""
    log.info("Authenticating with National Rail Data Portal...")
    r = requests.post(AUTH_URL, data={
        "username": username,
        "password": password
    })
    r.raise_for_status()
    token = r.json()["token"]
    log.info("Authenticated successfully")
    return token


# ── Step 2: Download and parse Knowledgebase Stations XML ────────────────────

def fetch_kb_stations(token: str) -> dict:
    """
    Downloads the Knowledgebase stations XML and returns a dict keyed by CRS:
    {
      "TON": {
        "crs": "TON",
        "name": "Tonbridge",
        "owningOperator": "Southeastern",
        "owningTocCode": "SE",
        "platforms": 4,
        "stationType": "through",
        "region": "South East",
      },
      ...
    }
    The KB XML uses the NationalRail schema. Key elements per station:
      <Station>
        <CrsCode>TON</CrsCode>
        <Name>Tonbridge</Name>
        <StationOperator>SE</StationOperator>   ← owning TOC code
        <NumOfPlatforms>4</NumOfPlatforms>       ← may not always be present
        <StationType>through</StationType>       ← through / terminus / request
      </Station>
    """
    log.info("Downloading Knowledgebase stations XML...")
    r = requests.get(KB_STATIONS_URL, headers={"X-Auth-Token": token})
    r.raise_for_status()

    stations = {}
    root = ET.fromstring(r.content)

    # The XML namespace used by the KB stations feed
    ns = {"nr": "http://nationalrail.co.uk/xml/station"}

    for station_el in root.findall(".//nr:Station", ns):

        def get(tag):
            el = station_el.find(f"nr:{tag}", ns)
            return el.text.strip() if el is not None and el.text else None

        crs = get("CrsCode")
        if not crs:
            continue

        owning_toc = get("StationOperator")
        owning_name = TOC_NAMES.get(owning_toc) if owning_toc else None

        platforms_raw = get("NumOfPlatforms")
        try:
            platforms = int(platforms_raw) if platforms_raw else None
        except ValueError:
            platforms = None

        stations[crs] = {
            "crs":            crs,
            "name":           get("Name"),
            "owningOperator": owning_name,
            "owningTocCode":  owning_toc,
            "platforms":      platforms,
            "stationType":    get("StationType"),
            "region":         get("NationalRailRegion") or get("Region"),
            "tocCodes":       [owning_toc] if owning_toc else [],
            "operators":      [owning_name] if owning_name else [],
        }

    log.info(f"Parsed {len(stations)} stations from Knowledgebase")
    return stations


# ── Step 3: Download DTD Timetable and extract TOCs per CRS ─────────────────

def fetch_timetable_tocs(token: str) -> dict:
    """
    Downloads the DTD timetable zip (CIF format) and extracts
    which TOC codes call at each CRS code.

    CIF format key lines:
      BS (Basic Schedule) → columns 2-5 = TOC code (actually operator at col 28-30)
      LO/LI/LT (Origin/Intermediate/Terminate) → location lines contain TIPLOC
      
    Simpler approach: parse the MCA timetable file for BS records.
    Each BS record contains:
      - Positions 2-3:   Transaction type (N=new, D=delete, R=revise)  
      - Positions 28-29: TOC code (2 chars)
    Each LO/LI/LT record contains:
      - Tiploc (positions 2-9)

    We also need the CORPUS/TIPLOC→CRS mapping from the MSN (Master Station Names) file.
    The MSN file is included in the same zip.
    MSN line format (A record):
      - Positions 5-34:  Station name
      - Positions 36-38: CRS code (3 chars)
      - Positions 49-52: TIPLOC (may differ)
    """
    log.info("Downloading DTD timetable zip (this may take a minute — it's large)...")
    r = None
    for url in DTD_TIMETABLE_URLS:
        log.info(f"Trying DTD endpoint: {url}")
        resp = requests.get(url, headers={"X-Auth-Token": token}, stream=True)
        if resp.status_code == 200:
            r = resp
            break
        log.warning(f"  {resp.status_code} — skipping")

    if r is None:
        log.warning("Could not reach any DTD timetable endpoint — falling back to owning operator only")
        return {}


    zip_data = io.BytesIO(r.content)
    toc_by_crs = defaultdict(set)

    with zipfile.ZipFile(zip_data) as z:
        # Find the MSN file (Master Station Names) to build TIPLOC -> CRS map
        msn_files = [f for f in z.namelist() if f.endswith(".msn") or f.endswith(".MSN")]
        mca_files = [f for f in z.namelist() if f.endswith(".mca") or f.endswith(".MCA")]

        log.info(f"Timetable zip contains: {z.namelist()}")

        # Build TIPLOC -> CRS from MSN
        tiploc_to_crs = {}
        if msn_files:
            log.info(f"Parsing MSN file: {msn_files[0]}")
            with z.open(msn_files[0]) as msn_file:
                for line in msn_file:
                    line = line.decode("utf-8", errors="replace")
                    if line.startswith("A"):
                        # Station record
                        crs    = line[49:52].strip()
                        tiploc = line[36:43].strip()
                        if crs and tiploc:
                            tiploc_to_crs[tiploc] = crs

            log.info(f"Built TIPLOC→CRS map for {len(tiploc_to_crs)} locations")

        # Parse MCA timetable to map TOC -> CRS stops
        if mca_files:
            log.info(f"Parsing MCA timetable: {mca_files[0]} (this takes a moment...)")
            current_toc = None

            with z.open(mca_files[0]) as mca_file:
                for line in mca_file:
                    line = line.decode("utf-8", errors="replace")
                    record_type = line[:2]

                    if record_type == "BS":
                        # Reset — TOC code comes from the following BX record
                        current_toc = None

                    elif record_type == "BX":
                        # Extra Schedule Details — ATOC code at positions 11-12 (0-indexed)
                        current_toc = line[11:13].strip() or None

                    elif record_type in ("LO", "LI", "LT") and current_toc:
                        # Location record — extract TIPLOC at positions 2-9
                        tiploc = line[2:9].strip()
                        crs = tiploc_to_crs.get(tiploc)
                        if crs:
                            toc_by_crs[crs].add(current_toc)

    log.info(f"Extracted TOC calls for {len(toc_by_crs)} CRS codes")
    return {crs: list(tocs) for crs, tocs in toc_by_crs.items()}


# ── Step 4: Merge and output ─────────────────────────────────────────────────

def merge_and_output(kb_stations: dict, timetable_tocs: dict) -> dict:
    """Merge timetable TOC data into the KB station records."""
    for crs, station in kb_stations.items():
        tocs = timetable_tocs.get(crs, [])

        # Start with owning TOC, add timetable TOCs
        all_tocs = list(dict.fromkeys(
            ([station["owningTocCode"]] if station["owningTocCode"] else []) +
            sorted(tocs)
        ))

        station["tocCodes"] = all_tocs
        station["operators"] = [TOC_NAMES.get(t, t) for t in all_tocs]

        # Clean up internal field
        del station["owningTocCode"]

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(kb_stations, f, indent=2, ensure_ascii=False)

    log.info(f"\n✅ Saved {len(kb_stations)} stations to {OUTPUT_FILE}")
    return kb_stations


# ── Validation ───────────────────────────────────────────────────────────────

def validate(results: dict):
    log.info("\n── Validation: Tonbridge (TON) ──")
    ton = results.get("TON")
    if not ton:
        log.error("FAIL — TON not found"); return

    checks = [
        ("crs == TON",                         ton["crs"] == "TON"),
        ("name == Tonbridge",                  "Tonbridge" in (ton["name"] or "")),
        ("SE in tocCodes",                     "SE" in ton["tocCodes"]),
        ("SN in tocCodes",                     "SN" in ton["tocCodes"]),
        ("Southeastern in operators",          "Southeastern" in ton["operators"]),
        ("Southern in operators",              "Southern" in ton["operators"]),
        ("owningOperator == Southeastern",     ton["owningOperator"] == "Southeastern"),
    ]
    for label, passed in checks:
        log.info(f"  {'PASS ✓' if passed else 'FAIL ✗'}  {label}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    token       = authenticate(args.username, args.password)
    kb_stations = fetch_kb_stations(token)
    toc_by_crs  = fetch_timetable_tocs(token)
    results     = merge_and_output(kb_stations, toc_by_crs)
    validate(results)


if __name__ == "__main__":
    main()