import requests
from bs4 import BeautifulSoup
import re
import json
import os
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import time
from tqdm import tqdm
import multiprocessing

# Global for lxml parser speed
PARSER = "lxml"

def entferne_duplikate(input_liste):
  """
  Entfernt Duplikate aus einer Liste und gibt die bereinigte Liste zurück.

  Args:
    input_liste (list): Die Liste, die bereinigt werden soll.

  Returns:
    list: Eine neue Liste ohne Duplikate.
  """
  # 1. Die Liste in ein Set umwandeln, um Duplikate automatisch zu entfernen
  einzigartige_elemente = set(input_liste)

  # 2. Das Set zurück in eine Liste umwandeln
  bereinigte_liste = list(einzigartige_elemente)

  return bereinigte_liste



def txt_zu_dict(dateiname: str) -> dict:
    """
    Liest eine Textdatei zeilenweise aus und erstellt ein Dictionary.
    Jede Zeile muss das Format "schlüssel;wert" haben.

    Args:
        dateiname: Der Pfad und Name der einzulesenden Textdatei.

    Returns:
        Ein Dictionary, das die Schlüssel-Wert-Paare aus der Datei enthält.
        Gibt ein leeres Dictionary zurück, falls die Datei nicht existiert oder leer ist.
    """
    ergebnis_dict = {}
    try:
        # Öffnen der Datei zum Lesen ('r' für read)
        with open(dateiname, 'r', encoding='utf8') as datei:
            # Iteriere durch jede Zeile der Datei
            for zeile in datei:
                # Entferne führende/nachfolgende Leerzeichen und Zeilenumbrüche
                saubere_zeile = zeile.strip()

                # Ignoriere leere Zeilen
                if not saubere_zeile:
                    continue

                # Teile die Zeile beim ersten Semikolon (;)
                teile = saubere_zeile.split(';', 1)

                # Prüfe, ob genau ein Trennzeichen gefunden wurde
                if len(teile) == 2:
                    schlüssel = teile[0].strip()
                    wert = teile[1].strip()
                    # Füge das Paar zum Dictionary hinzu
                    ergebnis_dict[schlüssel] = wert
                # Zeilen ohne Trennzeichen oder Schlüssel werden ignoriert
                else:
                    # Optional: eine Warnung ausgeben, wenn eine Zeile das Format nicht erfüllt
                    # print(f"Warnung: Zeile ignoriert, da Formatfehler: '{zeile.strip()}'")
                    pass
    
    # Behandlung von Dateifehlern (z.B. Datei nicht gefunden)
    except FileNotFoundError:
        print(f"Fehler: Die Datei '{dateiname}' wurde nicht gefunden.")
        return {}
    except Exception as e:
        print(f"Ein unerwarteter Fehler ist aufgetreten: {e}")
        return {}
        
    return ergebnis_dict




def txt_to_list(txt: str) -> list[str]:
    """
    Converts a string of text to a list of strings, where each string is a line from the text.
    Uses absolute path relative to the script directory.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, txt)
    with open(file_path, "r", encoding="utf-8") as file:
        txt = file.read()
    return txt.splitlines()


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
}

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "html_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def get_cache_path(url: str) -> str:
    # Create a safe filename from the URL
    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', url.replace("https://antraege.gruene.de/", ""))
    return os.path.join(CACHE_DIR, f"{safe_name}.html")

def fetch_and_save_html(url: str) -> str | None:
    """
    Downloads the HTML for a URL and saves it to the cache directory.
    Returns the path to the cached file or None if it failed.
    """
    cache_path = get_cache_path(url)
    if os.path.exists(cache_path):
        return cache_path

    for attempt in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=5)
            resp.raise_for_status()
            with open(cache_path, "w", encoding="utf-8") as f:
                f.write(resp.text)
            return cache_path
        except Exception:
            if attempt < 2:
                time.sleep(0.8 * (attempt + 1))
    return None


def extract_list_from_soup(soup: BeautifulSoup) -> list[str]:
    """
    Extracts the text content of all <li> items from the supporters section in the soup.
    """
    # Find the target section
    section = soup.find("section", {"class": "fullList hidden"})

    if not section:
        section = soup.find("section", {"class": "supporters"})

    if not section:
        section = soup.select_one("#supporters") or soup.select_one("section#supporters") or soup.select_one("section.supporters")
    
    if not section:
        candidates = soup.select("section.supporters, #supporters, ul.supporters")
        if candidates:
            section = candidates[0]
            
    if not section:
        return []

    # Find all list items inside the section
    items = section.select("li") if section else []
    if not items:
        items = soup.select("section.supporters li, #supporters li, ul.supporters li")

    # Extract clean text from each <li>
    clean_names = []
    for name in items:
        full_text = name.get_text(" ", strip=True)
        clean_name = full_text
        clean_names.append(clean_name)

    return entferne_duplikate(clean_names)

def extract_heading_from_soup(soup: BeautifulSoup) -> list[str]:
    """
    Extracts all <h1> items from the primaryHeader div in the soup.
    """
    div = soup.find("div", {"class": "primaryHeader"})
    if not div:
        return []
    items = div.find_all("h1")
    return [item.get_text(strip=True) for item in items]

def extract_applicant_name_from_soup(soup: BeautifulSoup) -> str | None:
    """
    Extracts the applicant's name from the motionDataTable in the soup.
    """
    table = soup.find("table", {"class": "motionDataTable"})
    if not table:
        return None

    applicant_row = table.find("th", string=lambda t: t and "Antragsteller*in" in t)
    if not applicant_row:
        return None

    applicant_cell = applicant_row.find_next("td")
    if not applicant_cell:
        return None

    full_text = applicant_cell.get_text(" ", strip=True)
    clean_name = re.split(r"\s*\(", full_text)[0].strip()
    return clean_name

def load_label_mapping() -> Dict[str, str]:
    """
    Loads label_mapping.json or creates an empty dict if it doesn't exist.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, 'label_mapping.json')
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("Warning: label_mapping.json is corrupted, starting with empty dict")
    return {}


def save_dict_to_json(data: Dict[str, Any], filename: str) -> None:
    """
    Saves a Python dictionary to a JSON file using absolute path.

    Args:
        data (dict): The dictionary to save.
        filename (str): The path/name of the file (e.g., 'data.json').
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, filename)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except IOError as e:
        tqdm.write(f"Error: Could not write to file {file_path}. Reason: {e}")
    except TypeError as e:
        tqdm.write(f"Error: Data contains non-serializable objects. Reason: {e}")


def process_url(url: str, label_mapping: Dict[str, str]) -> tuple[dict | None, tuple[str, str] | None]:
    cache_path = get_cache_path(url)
    if not os.path.exists(cache_path):
        cache_path = fetch_and_save_html(url)
    
    if not cache_path or not os.path.exists(cache_path):
        return None, None

    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        soup = BeautifulSoup(html_content, PARSER)
        
        id_session = re.split("/", (re.split("https://antraege.gruene.de", url)[1]))[0]
    except Exception as e:
        tqdm.write(f"Error reading/parsing cached file for {url}: {e}")
        return None, None

    heading_list = extract_heading_from_soup(soup)
    if not heading_list:
        return None, None
    try:
        id_heading = re.split(":", heading_list[0])[0]
        id_heading = re.split(" zu ", id_heading)[0]
    except Exception:
        id_heading = re.split(":", heading_list[0])[0]
    application_id = "-".join([id_session, id_heading])
    
    applicant = extract_applicant_name_from_soup(soup)
    supporters = extract_list_from_soup(soup)
    
    chosen_label = label_mapping.get(url, heading_list[0])
    heading = "-".join([id_session, chosen_label])
    
    if len(supporters) >= 1:
        url_data = {
            "application_id": application_id,
            "heading": heading,
            "applicant": applicant,
            "supporters": supporters,
            "url": url,
        }
        label_update = None if url in label_mapping else (url, heading_list[0])
        return url_data, label_update
    else:
        # print(f"Warning: No supporters found for {url}", flush=True)
        return None, None


def main():
    url_txts = [
        'urls/44_aenderungsantraege_urls.txt',
        'urls/45_aenderungsantraege_urls.txt',
        'urls/46_aenderungsantraege_urls.txt',
        'urls/47_aenderungsantraege_urls.txt',
        'urls/48_aenderungsantraege_urls.txt',
        'urls/49_aenderungsantraege_urls.txt',
        'urls/50_aenderungsantraege_urls.txt',
        'urls/51_aenderungsantraege_urls.txt',
    ]

    url_lists = [txt_to_list(txt) for txt in url_txts]
    database = {}

    # Load label mapping (replaces labels.txt)
    label_mapping = load_label_mapping()

    print(f"Loaded {len(label_mapping)} existing labels.")
    print(f"Starting extraction for {len(url_txts)} URL lists...")

    all_urls = [u for lst in url_lists for u in lst]

    # Stage 1: Parallel Download/Cache (only missing files) - ThreadPool is fine for I/O
    missing_urls = [url for url in all_urls if not os.path.exists(get_cache_path(url))]

    if missing_urls:
        print(f"--- Stage 1: Downloading {len(missing_urls)} missing URLs ---", flush=True)
        # 5900X can easily handle 32+ threads for network I/O
        with ThreadPoolExecutor(max_workers=32) as executor:
            list(tqdm(executor.map(fetch_and_save_html, missing_urls), total=len(missing_urls), desc="Downloading", unit="url"))
    else:
        print("--- Stage 1: Skipping Download (all URLs cached) ---", flush=True)

    # Stage 2: Parallel Processing from Cache - ProcessPool for CPU-bound parsing
    print(f"--- Stage 2: Processing cached files (High Performance) ---", flush=True)
    label_updates: list[tuple[str, str]] = []
    
    # 5900X has 12 Cores / 24 Threads. Using 20 processes for heavy parsing.
    num_processes = min(20, multiprocessing.cpu_count())
    
    with ProcessPoolExecutor(max_workers=num_processes) as executor:
        futures = {executor.submit(process_url, url, label_mapping): url for url in all_urls}
        
        with tqdm(total=len(all_urls), desc="Processing", unit="url") as pbar:
            for future in as_completed(futures):
                url = futures[future]
                try:
                    result, upd = future.result()
                except Exception as e:
                    tqdm.write(f"Error processing {url}: {e}")
                    pbar.update(1)
                    continue
                    
                if upd:
                    label_updates.append(upd)
                if result:
                    database[result["application_id"]] = result
                    # Frequent saving is fine on NVMe/SSD
                    save_dict_to_json(database, "bdk_data.json")
                
                pbar.update(1)

    for k, v in label_updates:
        if k not in label_mapping:
            label_mapping[k] = v

    save_dict_to_json(database, "bdk_data.json")
    save_dict_to_json(label_mapping, "label_mapping.json")
    print("--- Done! ---")

if __name__ == "__main__":
    main()



