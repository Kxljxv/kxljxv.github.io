import yaml
import os
import urllib.request
import urllib.error
import json
import time
import random
from urllib.parse import urlparse
from tqdm import tqdm

def load_cookies(file_path="cookies.yaml"):
    """Lädt Cookies aus der YAML-Datei."""
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        print(f"[-] Fehler beim Laden der Cookies: {e}")
        return {}

def fetch_json_as_string(url, cookies_file="cookies.yaml", retries=5, return_status=False):
    """
    Ruft eine URL auf und gibt den JSON-Inhalt hocheffizient als String zurück.
    Wenn return_status True ist, wird (content, status_code) zurückgegeben.
    """
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    
    all_cookies = load_cookies(cookies_file)
    domain_cookies = all_cookies.get(domain, {})
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    if domain_cookies:
        cookie_str = "; ".join([f"{k}={v}" for k, v in domain_cookies.items()])
        headers["Cookie"] = cookie_str

    for i in range(retries):
        try:
            timeout = 30 * (i + 1)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                content = response.read().decode('utf-8')
                if return_status:
                    return content, response.status
                return content if response.status == 200 else ""
        except urllib.error.HTTPError as e:
            if e.code == 429:  # Too Many Requests
                wait_time = (2 ** i) * 10 + random.uniform(0, 5)
                time.sleep(wait_time)
                continue
            
            # Auch bei Fehlern (z.B. 404) versuchen den Content zu lesen
            try:
                error_content = e.read().decode('utf-8', errors='replace')
            except:
                error_content = ""
                
            if return_status:
                return error_content, e.code
            return ""
        except (urllib.error.URLError, Exception):
            wait_time = (2 ** (i + 1)) + random.uniform(0, 1)
            if i < retries - 1:
                time.sleep(wait_time)
                continue
            if return_status:
                return "", 0
            return ""
    return ("", 0) if return_status else ""

def get_data_from_yaml(file_path="exported_conventions.yaml"):
    """Lädt die YAML-Daten einmalig."""
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"[-] Fehler beim Laden der YAML-Datei: {e}")
        return None

def get_all_ids(data):
    """Extrahiert alle IDs aus den geladenen Daten."""
    if not data:
        return set()
    all_ids = set()
    for conv_data in data.values():
        motions = conv_data.get("content", {}).get("motions", [])
        for motion_dict in motions:
            for m_id, m_struct in motion_dict.items():
                all_ids.add(str(m_id))
                amendments = m_struct.get("amendments", [])
                for am_dict in amendments:
                    for a_id in am_dict.keys():
                        all_ids.add(str(a_id))
    return all_ids

def get_all_motions(data):
    """Extrahiert alle Motions aus den geladenen Daten."""
    if not data:
        return []
    all_motions = []
    for conv_data in data.values():
        all_motions.extend(conv_data.get("content", {}).get("motions", []))
    return all_motions

def get_all_motion_urls_sorted(data):
    """
    Extrahiert alle Motion-Basis-URLs aus den Amendments und sortiert sie nach der Anzahl ihrer Amendments.
    Gibt eine Liste von Basis-URLs zurück.
    """
    if not data:
        return []
    
    motion_info = {} # motion_base_url -> am_count
    
    print("[*] Analysiere Motions und Amendment-Anzahl...")
    for conv_data in tqdm(data.values(), desc="Conventions", leave=False):
        motions = conv_data.get("content", {}).get("motions", [])
        for motion_dict in tqdm(motions, desc="Motions", leave=False):
            for m_struct in motion_dict.values():
                amendments = m_struct.get("amendments", [])
                am_count = len(amendments)
                
                # Suche in den Amendments nach der Motion-URL
                motion_base_url = None
                for am_dict in amendments:
                    for am_struct in am_dict.values():
                        url = am_struct.get("url_json")
                        if url and "/amendment/" in url:
                            motion_base_url = url.split("/amendment/")[0]
                            break
                    if motion_base_url:
                        break
                
                if motion_base_url:
                    motion_info[motion_base_url] = max(motion_info.get(motion_base_url, 0), am_count)
    
    # Sortiere absteigend nach am_count
    sorted_items = sorted(motion_info.items(), key=lambda x: x[1], reverse=True)
    return [url for url, count in sorted_items]

import sqlite3

WRONG_PLACE_JSON = '{"success":false,"message":"Der \\u00c4nderungsantrag geh\\u00f6rt nicht zum Antrag."}'
NOT_FOUND_JSON = '{"success":false,"message":"Der \\u00c4nderungsantrag wurde nicht gefunden"}'

def init_db(db_path="amendments.db"):
    """Initialisiert die SQLite Datenbank."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS amendments (
            amendment_id TEXT PRIMARY KEY,
            probe_url TEXT,
            content TEXT,
            status_code INTEGER,
            final_url TEXT,
            is_valid BOOLEAN DEFAULT 0
        )
    ''')
    conn.commit()
    return conn

def phase_1_fetch_to_db(conn, amendment_ids, motion_urls):
    """
    Phase 1: Alle JSON Inhalte für alle IDs in die SQLite speichern.
    Nutzt die erste verfügbare Motion-URL als Probe.
    """
    if not motion_urls:
        print("[-] Keine Motion-URLs zum Prüfen vorhanden.")
        return
    
    probe_base_url = motion_urls[0]
    cursor = conn.cursor()
    
    print(f"[*] Phase 1: Speichere {len(amendment_ids)} IDs in Datenbank...")
    count = 0
    for am_id in tqdm(amendment_ids, desc="Phase 1 (Fetch)"):
        # Prüfen, ob bereits in DB mit Content (um bei Abbruch fortzusetzen)
        cursor.execute("SELECT content FROM amendments WHERE amendment_id = ?", (am_id,))
        row = cursor.fetchone()
        if row and row[0] and row[0].strip():
            continue
            
        url = f"{probe_base_url}/amendment/{am_id}"
        content, status = fetch_json_as_string(url, return_status=True)
        
        cursor.execute('''
            INSERT OR REPLACE INTO amendments (amendment_id, probe_url, content, status_code)
            VALUES (?, ?, ?, ?)
        ''', (am_id, url, content, status))
        
        count += 1
        # Alle 50 Einträge committen und ausgeben
        if count % 50 == 0:
            conn.commit()
            print(f"[.] Phase 1: {count} neue IDs verarbeitet (Letzte ID: {am_id}, Status: {status})")
    
    conn.commit()

def phase_2_cleanup(conn):
    """
    Phase 2: Entfernt Records, die 'nicht gefunden' enthalten.
    """
    cursor = conn.cursor()
    print("[*] Phase 2: Entferne ungültige IDs aus Datenbank...")
    
    # Zähle vorher
    cursor.execute("SELECT COUNT(*) FROM amendments")
    total_before = cursor.fetchone()[0]
    
    # Lösche NOT_FOUND_JSON (genaue Übereinstimmung oder Teilstring zur Sicherheit)
    cursor.execute("DELETE FROM amendments WHERE content LIKE ?", (f"%{NOT_FOUND_JSON}%",))
    deleted = cursor.rowcount
    
    conn.commit()
    print(f"[+] {deleted} von {total_before} Records entfernt.")

def phase_3_find_correct_motion(conn, motion_urls):
    """
    Phase 3: Sucht für die verbleibenden IDs die korrekte Motion.
    """
    cursor = conn.cursor()
    # Wähle alle aus, die noch keine final_url haben und nicht bereits als 200 bestätigt wurden
    cursor.execute("SELECT amendment_id, status_code, probe_url FROM amendments WHERE final_url IS NULL")
    rows = cursor.fetchall()
    
    print(f"[*] Phase 3: Suche korrekte Motion für {len(rows)} IDs...")
    for am_id, status, probe_url in tqdm(rows, desc="Phase 3 (Search)"):
        if status == 200:
            cursor.execute("UPDATE amendments SET final_url = ?, is_valid = 1 WHERE amendment_id = ?", (probe_url, am_id))
            conn.commit()
            continue
            
        # Wenn nicht 200, dann alle anderen Motions durchprobieren
        found_url = None
        for base_url in motion_urls:
            # Überspringe die bereits geprüfte probe_url
            full_url = f"{base_url}/amendment/{am_id}"
            if full_url == probe_url:
                continue
                
            _, s = fetch_json_as_string(full_url, return_status=True)
            if s == 200:
                found_url = full_url
                break
        
        if found_url:
            cursor.execute("UPDATE amendments SET final_url = ?, is_valid = 1 WHERE amendment_id = ?", (found_url, am_id))
            print(f"\n[+] Korrekte URL für {am_id} gefunden: {found_url}")
        else:
            # Wenn gar nichts gefunden wurde (sollte nach Phase 2 selten sein)
            cursor.execute("UPDATE amendments SET is_valid = 0 WHERE amendment_id = ?", (am_id,))
            
        conn.commit()

if __name__ == "__main__":
    data = get_data_from_yaml()
    known_ids = get_all_ids(data)
    motion_urls = get_all_motion_urls_sorted(data)
    
    # Bereinige IDs für schnelleren Lookup
    clean_known_ids = {str(kid).split("/")[-1] for kid in known_ids}
    
    beginn_id = 98700
    end_id = 101000
    
    all_target_ids = [str(i) for i in range(beginn_id, end_id)]
    
    # Datenbank initialisieren
    db_conn = init_db()
    
    try:
        # Phase 1: Fetch
        phase_1_fetch_to_db(db_conn, all_target_ids, motion_urls)
        
        # Phase 2: Cleanup
        phase_2_cleanup(db_conn)
        
        # Phase 3: Search
        phase_3_find_correct_motion(db_conn, motion_urls)
        
        # Endergebnis ausgeben
        cursor = db_conn.cursor()
        cursor.execute("SELECT final_url FROM amendments WHERE is_valid = 1")
        valid_urls = [row[0] for row in cursor.fetchall()]
        
        print(f"\n[*] Fertig! {len(valid_urls)} neue gültige Amendment-URLs gefunden.")
        if valid_urls:
            with open("found_amendment_urls.txt", "w") as f:
                for url in valid_urls:
                    f.write(f"{url}\n")
            print("[*] URLs wurden in 'found_amendment_urls.txt' gespeichert.")
            
    except Exception as e:
        print(f"[-] Ein kritischer Fehler ist aufgetreten: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_conn.close()
            
            

 


