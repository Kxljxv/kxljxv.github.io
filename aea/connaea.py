#!/usr/bin/env python3 
# -*- coding: utf-8 -*-
"""
Beispielskript zum Einlesen der erzeugten antragstellerinnen.txt,
welche eine Python-Dictionary-Repräsentation enthält.

Struktur:
{
  'VR-01-025': [ ['Name1', 'KV ...'], ['Name2', 'KV ...'], ... ],
  'E-05-032': [ ... ],
  ...
}

Zusätzlich wird ein Mapping erstellt: 
{ Supporter: [AEA1, AEA2, ...] }
"""

import os
import ast
import json
import pprint


def load_support_map(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    data = ast.literal_eval(content)
    if not isinstance(data, dict):
        raise ValueError('Die geladene Datei enthält kein Dictionary.')
    return data

def save_dict_to_json(data: dict, filepath: str, indent: int = 2) -> None:
    if not isinstance(data, dict):
        raise TypeError("Das übergebene Objekt ist kein Dictionary.")

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        print(f"Dictionary erfolgreich in '{filepath}' gespeichert.")
    except IOError as e:
        print(f"Fehler beim Schreiben der Datei: {e}")

def main():
    txt_path = os.path.join(os.getcwd(), 'antragstellerinnen.txt')
    if not os.path.isfile(txt_path):
        print('antragstellerinnen.txt nicht gefunden. Bitte zuerst extract_supporters.py ausführen.')
        return

    support_map = load_support_map(txt_path)

    # Filter AEA mit mehr als einem Supporter
    aea_without_1 = {aea: supporters for aea, supporters in support_map.items() if len(supporters) > 1}

    # Berechnung der gemeinsamen Supporter zwischen AEAs
    aea_connections = {}
    for aea_perspective in aea_without_1:
        aea_perspective_connections = {}
        for aea_target in aea_without_1:
            if aea_perspective != aea_target:
                common_supporters = 0
                for supporter_perspective in aea_without_1[aea_perspective]:
                    for supporter_target in aea_without_1[aea_target]:
                        if supporter_perspective == supporter_target:
                            common_supporters += 1
                aea_perspective_connections[aea_target] = common_supporters
        aea_connections[aea_perspective] = aea_perspective_connections

    #save_dict_to_json(aea_connections, "aea_connections.json")

    # Mapping Supporter -> Liste der AEAs, die sie supporten
    supporter_map = {}
    for aea, supporters in support_map.items():
        for supporter in supporters:
            supporter_id = tuple(supporter)  # ["Name", "KV ..."] -> ("Name", "KV ...")
            if supporter_id not in supporter_map:
                supporter_map[supporter_id] = []
            supporter_map[supporter_id].append(aea)

    # JSON kann keine Tuples als Key, also wandeln wir sie in Strings um
    supporter_map_json = {f"{k[0]} | {k[1]}": v for k, v in supporter_map.items()}
    pprint.pp(supporter_map_json)

    #save_dict_to_json(supporter_map_json, "supporter_map.json")

    # Sicherstellen, dass das Verzeichnis existiert
    output_dir = "./supporter/AEA5"
    os.makedirs(output_dir, exist_ok=True)

    # Ungültige Zeichen für Windows-Dateien
    invalid_chars = '<>:"/\\|?*'

    # Markdown-Dateien für jeden Supporter erstellen
    for supporter_key, aeas in supporter_map_json.items():
        safe_key = supporter_key
        for ch in invalid_chars:
            safe_key = safe_key.replace(ch, "_") # ungültige Zeichen ersetzen
        # Leerzeichen in Unterstriche, Punkte in Bindestriche
        safe_key = safe_key.replace(" ", "_").replace(".", "-")
        
        file_name = os.path.join(output_dir, safe_key + ".md")
        
        content = ""
        for aea in aeas:
            safe_aea = aea
            for ch in invalid_chars:
                safe_aea = safe_aea.replace(ch, "_") # ungültige Zeichen ersetzen

            safe_aea = safe_aea.replace(" ", "_").replace(".", "-")

            file_name_aea = os.path.join(output_dir, safe_aea + ".md")


            aea_content = f"[[{safe_key}]]\n"
            try:
                with open(file_name_aea, "x", encoding="utf-8", errors="xmlcharrefreplace") as output_file:
                    output_file.write(f"typ_antrag\n{aea_content}")
            except:
                with open(file_name_aea, "a", encoding="utf-8", errors="xmlcharrefreplace") as output_file:
                    output_file.write(aea_content)

    
            content += f"[[{aea}]]\n"


        content += f"{safe_key.split("___")[0]}\n{safe_key.split("___")[1]}\n"
        with open(file_name, "w", encoding="utf-8", errors="xmlcharrefreplace") as output_file:
            output_file.write(content)



if __name__ == '__main__':
    main()
