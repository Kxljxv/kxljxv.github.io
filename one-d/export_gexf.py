import sqlite3
import json
import networkx as nx
import os

def export_to_gexf():
    db_path = os.path.join("one-dimensional", "final_data.db")
    output_path = os.path.join("one-dimensional", "network.gexf")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    G = nx.Graph()
    
    # 1. Personen laden
    cursor.execute("SELECT id, display_name FROM persons")
    persons = cursor.fetchall()
    person_name_to_id = {}
    for pid, name in persons:
        G.add_node(pid, label=name, node_type="person")
        person_name_to_id[name] = pid
        
    # 2. Anträge (amendments) laden
    cursor.execute("SELECT id, title, initiators, supporters FROM amendments")
    amendments = cursor.fetchall()
    
    for aid, title, initiators_json, supporters_json in amendments:
        am_node_id = f"am_{aid}"
        G.add_node(am_node_id, label=title, node_type="amendment")
        
        # Initiatoren
        if initiators_json:
            try:
                initiators = json.loads(initiators_json)
                for entry in initiators:
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        G.add_edge(pid, am_node_id, weight=3.0, edge_type="initiator")
            except Exception as e:
                print(f"Fehler beim Parsen der Initiatoren für {aid}: {e}")
                
        # Unterstützer
        if supporters_json:
            try:
                supporters = json.loads(supporters_json)
                n_supps = len(supporters)
                for i, entry in enumerate(supporters):
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        # Gewichtung wie in R: sinkt von 1.5 auf 1.0
                        weight = 1.5 - 0.5 * (i / (n_supps - 1)) if n_supps > 1 else 1.5
                        G.add_edge(pid, am_node_id, weight=weight, edge_type="supporter")
            except Exception as e:
                print(f"Fehler beim Parsen der Unterstützer für {aid}: {e}")

    # 3. Hauptanträge (motions) laden (optional, aber sinnvoll für Vollständigkeit)
    cursor.execute("SELECT id, title, initiators, supporters FROM motions")
    motions = cursor.fetchall()
    
    for mid, title, initiators_json, supporters_json in motions:
        mo_node_id = f"mo_{mid}"
        G.add_node(mo_node_id, label=title, node_type="motion")
        
        # Initiatoren
        if initiators_json:
            try:
                initiators = json.loads(initiators_json)
                for entry in initiators:
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        G.add_edge(pid, mo_node_id, weight=3.0, edge_type="initiator")
            except Exception as e:
                pass
                
        # Unterstützer
        if supporters_json:
            try:
                supporters = json.loads(supporters_json)
                n_supps = len(supporters)
                for i, entry in enumerate(supporters):
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        weight = 1.5 - 0.5 * (i / (n_supps - 1)) if n_supps > 1 else 1.5
                        G.add_edge(pid, mo_node_id, weight=weight, edge_type="supporter")
            except Exception as e:
                pass

    conn.close()
    
    # GEXF Export
    nx.write_gexf(G, output_path)
    print(f"Erfolgreich {G.number_of_nodes()} Knoten und {G.number_of_edges()} Kanten nach {output_path} exportiert.")

if __name__ == "__main__":
    export_to_gexf()
