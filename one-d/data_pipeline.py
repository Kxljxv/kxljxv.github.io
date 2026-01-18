import argparse
import json
import os
import sqlite3
import subprocess
import time

import requests


POLL_INTERVAL_SECONDS = 300
DB_PATH = "final_data.db"
AMENDMENT_URL_TEMPLATE = "https://ldk-berlin.antragsgruen.de/ldk261/amendment/{id}?format=json"


def fetch_amendment_from_source(amendment_id):
    url = AMENDMENT_URL_TEMPLATE.format(id=amendment_id)
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException:
        return None
    if response.status_code != 200:
        return None
    try:
        data = response.json()
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    if "id" not in data or "title" not in data or "status_id" not in data:
        return None
    initiators = data.get("initiators", [])
    supporters = data.get("supporters", [])
    return {
        "id": data["id"],
        "title": data["title"],
        "initiators": json.dumps(initiators, ensure_ascii=False),
        "supporters": json.dumps(supporters, ensure_ascii=False),
        "status_id": data["status_id"],
    }


def sync_existing_status_15(conn):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, title, initiators, supporters, status_id FROM amendments WHERE status_id = 15"
    )
    rows = cursor.fetchall()
    changed = False
    for row in rows:
        amendment_id = row[0]
        # print(f"  Prüfe ID {amendment_id}...", end="\r") # Temporäres Debugging entfernt
        local_title = row[1]
        local_initiators = row[2]
        local_supporters = row[3]
        local_status_id = row[4]
        remote = fetch_amendment_from_source(amendment_id)
        if not remote:
            continue
        if (
            remote["title"] != local_title
            or remote["initiators"] != local_initiators
            or remote["supporters"] != local_supporters
            or remote["status_id"] != local_status_id
        ):
            cursor.execute(
                "UPDATE amendments SET title = ?, initiators = ?, supporters = ?, status_id = ? WHERE id = ?",
                (
                    remote["title"],
                    remote["initiators"],
                    remote["supporters"],
                    remote["status_id"],
                    amendment_id,
                ),
            )
            changed = True
    return changed


def sync_new_ids(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(CAST(id AS INTEGER)) FROM amendments")
    row = cursor.fetchone()
    if not row:
        return False
    max_id = row[0]
    if max_id is None:
        return False
    
    try:
        max_id = int(max_id)
    except (ValueError, TypeError):
        return False

    changed = False
    for amendment_id in range(max_id + 1, max_id + 11):
        remote = fetch_amendment_from_source(amendment_id)
        if not remote:
            continue
        cursor.execute(
            "INSERT OR REPLACE INTO amendments (id, title, initiators, supporters, status_id) VALUES (?, ?, ?, ?, ?)",
            (
                remote["id"],
                remote["title"],
                remote["initiators"],
                remote["supporters"],
                remote["status_id"],
            ),
        )
        changed = True
    return changed


def run_graph_layout():
    print("Starte Koordinaten-Neuberechnung via R...")
    candidates = []
    env_path = os.getenv("R_SCRIPT_PATH")
    if env_path:
        candidates.append(env_path)
    candidates.append(r"C:\Program Files\R\R-4.5.2\bin\x64\Rscript.exe")
    candidates.append("Rscript")
    last_error = None
    for path in candidates:
        try:
            subprocess.run(
                [path, "graph_layout.R"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            return
        except FileNotFoundError as exc:
            last_error = exc
        except subprocess.CalledProcessError as exc:
            last_error = exc
            break
    if last_error:
        raise last_error


def run_once():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    try:
        changed = False
        if sync_existing_status_15(conn):
            changed = True
        if sync_new_ids(conn):
            changed = True
        conn.commit()
    finally:
        conn.close()
    if changed:
        run_graph_layout()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL_SECONDS)
    args = parser.parse_args()
    if args.once:
        run_once()
        return
    interval = max(10, args.interval)
    while True:
        run_once()
        time.sleep(interval)


if __name__ == "__main__":
    main()

