import sqlite3
import json
import os
from tqdm import tqdm

def init_final_db(db_path="final_data.db"):
    """Initialisiert die finale Datenbank basierend auf table_description.md."""
    conn = sqlite3.connect(db_path, timeout=30)
    cursor = conn.cursor()
    
    # Motion Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS motions (
            id TEXT PRIMARY KEY,
            agenda_item TEXT,
            prefix TEXT,
            title TEXT,
            title_with_intro TEXT,
            title_with_prefix TEXT,
            status_id INTEGER,
            status_title TEXT,
            proposed_procedure TEXT,
            date_published TEXT,
            initiators TEXT, -- JSON list
            supporters TEXT, -- JSON list
            sections TEXT,    -- JSON list
            amendment_links TEXT, -- JSON list or text
            url_json TEXT,
            url_html TEXT
        )
    ''')
    
    # Amendment Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS amendments (
            id TEXT PRIMARY KEY,
            motion_id TEXT,
            prefix TEXT,
            title TEXT,
            title_with_prefix TEXT,
            status_id INTEGER,
            status_title TEXT,
            proposed_procedure TEXT,
            date_published TEXT,
            initiators TEXT, -- JSON list
            supporters TEXT, -- JSON list
            sections TEXT,    -- JSON list
            url_json TEXT,
            url_html TEXT,
            FOREIGN KEY(motion_id) REFERENCES motions(id)
        )
    ''')
    
    # Person Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS persons (
            id TEXT PRIMARY KEY,
            display_name TEXT,
            kv TEXT,                -- JSON list
            active_conventions TEXT, -- JSON list
            timeline TEXT,           -- JSON list
            initiated TEXT,          -- JSON list
            supported TEXT           -- JSON list
        )
    ''')
    
    conn.commit()
    return conn

def get_person_id(name):
    """Generiert eine einfache ID aus dem Namen (Normalisierung)."""
    return name.lower().replace(" ", "-").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")

from extract_ids import fetch_json_as_string

def process_data():
    source_db = "amendments.db"
    target_db = "final_data.db"
    
    if not os.path.exists(source_db):
        print(f"[-] Quelldatenbank {source_db} nicht gefunden.")
        return

    s_conn = sqlite3.connect(source_db, timeout=30)
    s_cursor = s_conn.cursor()
    
    t_conn = init_final_db(target_db)
    t_cursor = t_conn.cursor()
    
    # Alle gültigen IDs laden
    s_cursor.execute("SELECT amendment_id, final_url, content, status_code, probe_url FROM amendments WHERE is_valid = 1 OR status_code = 200")
    rows = s_cursor.fetchall()
    
    print(f"[*] Verarbeite {len(rows)} potenzielle Datensätze...")
    
    for am_id, final_url, content_json, status, probe_url in tqdm(rows):
        try:
            url_to_use = final_url if final_url else probe_url
            
            # Falls Content fehlt oder fehlerhaft ist, neu laden
            if not content_json or status != 200:
                if not url_to_use: continue
                content_json, new_status = fetch_json_as_string(url_to_use, return_status=True)
                if new_status != 200:
                    continue

            data = json.loads(content_json)
            item_type = data.get("type") # "amendment" or "motion"
            
            if item_type == "amendment":
                am_id = str(data.get("id"))
                motion_data = data.get("motion", {})
                m_id = str(motion_data.get("id"))
                
                # Motion speichern (falls noch nicht da)
                t_cursor.execute("INSERT OR IGNORE INTO motions (id, agenda_item, prefix, title, title_with_intro, title_with_prefix, url_json, url_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                               (m_id, motion_data.get("agenda_item"), motion_data.get("prefix"), motion_data.get("title"), 
                                motion_data.get("title_with_intro"), motion_data.get("title_with_prefix"), 
                                motion_data.get("url_json"), motion_data.get("url_html")))
                
                # Amendment speichern
                t_cursor.execute('''
                    INSERT OR REPLACE INTO amendments 
                    (id, motion_id, prefix, title, title_with_prefix, status_id, status_title, proposed_procedure, date_published, initiators, supporters, sections, url_json, url_html)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    am_id, m_id, data.get("prefix"), data.get("title"), data.get("title_with_prefix"),
                    data.get("status_id"), data.get("status_title"), data.get("proposed_procedure"),
                    data.get("date_published"), json.dumps(data.get("initiators", [])),
                    json.dumps(data.get("supporters", [])), json.dumps(data.get("sections", [])),
                    data.get("url_json"), data.get("url_html")
                ))
                    
            elif item_type == "motion":
                m_id = str(data.get("id"))
                t_cursor.execute('''
                    INSERT OR REPLACE INTO motions 
                    (id, agenda_item, prefix, title, title_with_intro, title_with_prefix, status_id, status_title, proposed_procedure, date_published, initiators, supporters, sections, url_json, url_html)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    m_id, data.get("agenda_item"), data.get("prefix"), data.get("title"),
                    data.get("title_with_intro"), data.get("title_with_prefix"),
                    data.get("status_id"), data.get("status_title"), data.get("proposed_procedure"),
                    data.get("date_published"), json.dumps(data.get("initiators", [])),
                    json.dumps(data.get("supporters", [])), json.dumps(data.get("sections", [])),
                    data.get("url_json"), data.get("url_html")
                ))

        except Exception as e:
            print(f"[-] Fehler beim Verarbeiten eines Datensatzes: {e}")

    t_conn.commit()
    s_conn.close()
    t_conn.close()
    print("[*] Motions und Amendments erfolgreich verarbeitet.")

def generate_persons_from_db(db_path="final_data.db"):
    """Extrahiert Personen aus den bereits befüllten Tabellen in der finalen DB."""
    conn = sqlite3.connect(db_path, timeout=30)
    cursor = conn.cursor()
    
    persons_data = {}

    def update_person(person_info, item_id, item_type, convention, date, is_initiator, status_title, status_id):
        name = person_info.get("name")
        if not name: return
        
        p_id = get_person_id(name)
        if p_id not in persons_data:
            persons_data[p_id] = {
                "id": p_id,
                "display_name": name,
                "kv": set(),
                "active_conventions": set(),
                "timeline": [],
                "initiated": [],
                "supported": []
            }
        
        p = persons_data[p_id]
        kv = person_info.get("organization")
        if kv: p["kv"].add(kv)
        if convention: p["active_conventions"].add(convention)
        if date:
            p["timeline"].append({"date": date, "initiating": is_initiator})
            
        item_entry = {
            "id": item_id,
            "type": item_type,
            "convention": convention,
            "date_published": date,
            "status_title": status_title,
            "status_id": status_id
        }
        if is_initiator:
            p["initiated"].append(item_entry)
        else:
            p["supported"].append(item_entry)

    # 1. Aus Motions lesen
    cursor.execute("SELECT id, initiators, supporters, date_published, status_title, status_id, url_json FROM motions")
    for m_id, inits_json, supps_json, date, s_title, s_id, url in cursor.fetchall():
        convention = url.split("/rest/")[1].split("/")[0] if "/rest/" in (url or "") else ""
        for init in json.loads(inits_json or "[]"):
            update_person(init, m_id, "motion", convention, date, True, s_title, s_id)
        for supp in json.loads(supps_json or "[]"):
            update_person(supp, m_id, "motion", convention, date, False, s_title, s_id)

    # 2. Aus Amendments lesen
    cursor.execute("SELECT id, initiators, supporters, date_published, status_title, status_id, url_json FROM amendments")
    for am_id, inits_json, supps_json, date, s_title, s_id, url in cursor.fetchall():
        convention = url.split("/rest/")[1].split("/")[0] if "/rest/" in (url or "") else ""
        for init in json.loads(inits_json or "[]"):
            update_person(init, am_id, "amendment", convention, date, True, s_title, s_id)
        for supp in json.loads(supps_json or "[]"):
            update_person(supp, am_id, "amendment", convention, date, False, s_title, s_id)

    print(f"[*] Speichere {len(persons_data)} Personen...")
    for p_id, p in tqdm(persons_data.items()):
        cursor.execute('''
            INSERT OR REPLACE INTO persons (id, display_name, kv, active_conventions, timeline, initiated, supported)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            p_id, p["display_name"], json.dumps(list(p["kv"])), json.dumps(list(p["active_conventions"])),
            json.dumps(p["timeline"]), json.dumps(p["initiated"]), json.dumps(p["supported"])
        ))
    
    conn.commit()
    conn.close()
    print("[*] Personen-Tabelle erfolgreich generiert.")

if __name__ == "__main__":
    process_data()
    generate_persons_from_db()
