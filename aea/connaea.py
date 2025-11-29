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

    # Erstelle graph_data.json mit neuer Struktur
    # Struktur: Jeder Antrag hat initiator und supporters Liste
    graph_data = {
        "support_map": {},
        "metadata": {
            "total_aeas": len(support_map)
        }
    }
    
    all_supporters_set = set()
    
    # Konvertiere zu neuer Struktur
    for aea, data in support_map.items():
        # Handle both old format (list) and new format (dict)
        if isinstance(data, dict):
            # Neue Struktur: {"initiator": [name, kv] oder None, "supporters": [[name, kv], ...]}
            graph_data["support_map"][aea] = {
                "initiator": data.get("initiator"),
                "supporters": data.get("supporters", [])
            }
            # Sammle alle Supporter für Metadata
            if data.get("initiator"):
                all_supporters_set.add(tuple(data["initiator"]))
            for sup in data.get("supporters", []):
                all_supporters_set.add(tuple(sup))
        else:
            # Alte Struktur: Liste von [name, kv] oder [name, kv, is_initiator]
            # Konvertiere zu neuer Struktur
            initiator = None
            supporters = []
            for item in data:
                if len(item) == 2:
                    name, kv = item
                    is_initiator = False
                else:
                    name, kv, is_initiator = item
                
                if is_initiator and initiator is None:
                    initiator = [name, kv]
                else:
                    supporters.append([name, kv])
            
            graph_data["support_map"][aea] = {
                "initiator": initiator,
                "supporters": supporters
            }
            # Sammle alle Supporter für Metadata
            if initiator:
                all_supporters_set.add(tuple(initiator))
            for sup in supporters:
                all_supporters_set.add(tuple(sup))
    
    graph_data["metadata"]["total_supporters"] = len(all_supporters_set)
    
    # Speichere graph_data.json
    graph_data_path = os.path.join(os.getcwd(), 'graph_data.json')
    save_dict_to_json(graph_data, graph_data_path)
    print(f"graph_data.json erfolgreich erstellt mit {len(graph_data['support_map'])} Anträgen.")
    print(f"Gesamt: {graph_data['metadata']['total_supporters']} eindeutige Personen.")

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
