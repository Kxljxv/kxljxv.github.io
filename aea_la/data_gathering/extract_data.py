import requests
from bs4 import BeautifulSoup
import re
import json
import os
from typing import Dict, Any

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



def extract_list_from_section(url: str) -> list[str]:
    """
    Fetches a webpage and extracts the text content of all <li> items
    from the <section> that has class="supporters" and id="supporters".
    
    Returns a list of strings.
    """
    
    response = requests.get(url)
    response.raise_for_status()  # Ensure the request was successful

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the target section
    section = soup.find("section", {"class": "supporters", "id": "supporters"})
    if not section:
        return []  # If not found, return an empty list

    # Find all list items inside the section
    items = section.find_all("li")

    # Extract clean text from each <li>

    # Extract visible text, removing parentheses or additional info
    clean_names = []
    for name in items:
        full_text = name.get_text(" ", strip=True)
        clean_name = re.split(r"\s*\(", full_text)[0].strip()
        clean_names.append(clean_name)

    return entferne_duplikate(clean_names)

def extract_heading_from_section(url: str) -> list[str]:
    """
    Fetches a webpage and extracts the text content of all <h1> items
    from the <section> that has class="primaryHeader".
    
    Returns a list of strings.
    """
    
    response = requests.get(url)
    response.raise_for_status()  # Ensure the request was successful

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the target div
    div = soup.find("div", {"class": "primaryHeader"})
    if not div:
        print('empty div')
        return []  # If not found, return an empty list
        
        

    # Find all list items inside the div
    items = div.find_all("h1")

    # Extract clean text from each <h1>
    return [item.get_text(strip=True) for item in items]

def extract_applicant_name(url: str) -> str | None:
    """
    Fetches the webpage and extracts the applicant's name from the motionDataTable.
    Returns a clean name string or None if not found.
    """

    response = requests.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the data table
    table = soup.find("table", {"class": "motionDataTable"})
    if not table:
        return None

    # Find the row containing the applicant entry
    applicant_row = table.find("th", string=lambda t: t and "Antragsteller*in" in t)
    if not applicant_row:
        return None

    # The name is inside the adjacent <td>
    applicant_cell = applicant_row.find_next("td")
    if not applicant_cell:
        return None

    # Extract visible text, removing parentheses or additional info
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
        print(f"Success: Data saved to {file_path}")
    except IOError as e:
        print(f"Error: Could not write to file {file_path}. Reason: {e}")
    except TypeError as e:
        print(f"Error: Data contains non-serializable objects. Reason: {e}")


url_txts = [
    'urls/LA25-4.txt',
    'urls/LA25-3.txt',
]

url_lists = [txt_to_list(txt) for txt in url_txts]

database = {}

# Load label mapping (replaces labels.txt)
label_mapping = load_label_mapping()

print("Loaded label mapping:", label_mapping)
print("URL lists:", url_lists)
for url_list in url_lists:
    for url in url_list:
        url_data = {}

        id_session = re.split("/",(re.split("https://berlin.antragsgruen.de/", url)[1]))[0]
        
        heading = extract_heading_from_section(url)
        print(heading)
        try:
            id_heading = re.split(":", heading[0])[0]
            id_heading = re.split(" zu ", id_heading)[0]
        except:
            id_heading = re.split(":", heading[0])[0]

        print(id_heading)
            
        application_id = "-".join([id_session, id_heading])

        applicant = extract_applicant_name(url)

        supporters = extract_list_from_section(url)

        web_heading = "-".join([id_session, heading[0]])

        # Use extracted heading as default if URL not in label_mapping
        if url not in label_mapping:
            label_mapping[url] = heading[0]
            print(f"Added new label for {url}: {heading[0]}")

        heading = "-".join([id_session, label_mapping[url]])
        

        print(heading)
        print(applicant)
        print(supporters)
        print(url)

        url_data["application_id"] = application_id
        url_data["heading"] = heading
        url_data["applicant"] = applicant
        url_data["supporters"] = supporters
        url_data["url"] = url
        database[application_id] = url_data


print(database)
save_dict_to_json(database, "la_data.json")

# Save updated label mapping
save_dict_to_json(label_mapping, "label_mapping.json")




