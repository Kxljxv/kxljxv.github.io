import sqlite3
import json
import os

def export_web_data():
    db_path = os.path.join("one-dimensional", "final_data.db")
    output_path = os.path.join("one-dimensional", "network_data.json")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Personen laden
    cursor.execute("SELECT id, display_name FROM persons")
    persons = cursor.fetchall()
    person_nodes = []
    person_name_to_id = {}
    for pid, name in persons:
        person_nodes.append({"id": pid, "label": name, "type": "person"})
        person_name_to_id[name] = pid
        
    # 2. Anträge (amendments) laden
    cursor.execute("SELECT id, title, initiators, supporters FROM amendments")
    amendments = cursor.fetchall()
    
    amendment_nodes = []
    links = []
    
    for aid, title, initiators_json, supporters_json in amendments:
        am_node_id = f"am_{aid}"
        amendment_nodes.append({"id": am_node_id, "label": title, "type": "amendment"})
        
        # Initiatoren
        if initiators_json:
            try:
                initiators = json.loads(initiators_json)
                for entry in initiators:
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        links.append({"source": pid, "target": am_node_id, "weight": 3.0, "type": "initiator"})
            except Exception: pass
                
        # Unterstützer
        if supporters_json:
            try:
                supporters = json.loads(supporters_json)
                n_supps = len(supporters)
                for i, entry in enumerate(supporters):
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        # Gewichtung: 1.5 am Anfang bis 0.8 am Ende der Liste
                        weight = 1.5 - 0.7 * (i / (n_supps - 1)) if n_supps > 1 else 1.5
                        links.append({"source": pid, "target": am_node_id, "weight": weight, "type": "supporter"})
            except Exception: pass

    # 3. Hauptanträge (motions) laden
    cursor.execute("SELECT id, title, initiators, supporters FROM motions")
    motions = cursor.fetchall()
    
    motion_nodes = []
    for mid, title, initiators_json, supporters_json in motions:
        mo_node_id = f"mo_{mid}"
        motion_nodes.append({"id": mo_node_id, "label": title, "type": "motion"})
        
        # Initiatoren
        if initiators_json:
            try:
                initiators = json.loads(initiators_json)
                for entry in initiators:
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        links.append({"source": pid, "target": mo_node_id, "weight": 3.0, "type": "initiator"})
            except Exception: pass
                
        # Unterstützer
        if supporters_json:
            try:
                supporters = json.loads(supporters_json)
                n_supps = len(supporters)
                for i, entry in enumerate(supporters):
                    name = entry.get("name")
                    if name and name in person_name_to_id:
                        pid = person_name_to_id[name]
                        # Gewichtung: 1.5 am Anfang bis 0.8 am Ende der Liste
                        weight = 1.5 - 0.7 * (i / (n_supps - 1)) if n_supps > 1 else 1.5
                        links.append({"source": pid, "target": mo_node_id, "weight": weight, "type": "supporter"})
            except Exception: pass

    conn.close()
    
    import collections
    
    # 4. Nur größte verbundene Komponente behalten
    all_nodes = person_nodes + amendment_nodes + motion_nodes
    if all_nodes:
        adj = collections.defaultdict(list)
        for link in links:
            adj[link["source"]].append(link["target"])
            adj[link["target"]].append(link["source"])
            
        visited = set()
        components = []
        for node in all_nodes:
            node_id = node["id"]
            if node_id not in visited:
                comp = []
                queue = collections.deque([node_id])
                visited.add(node_id)
                while queue:
                    u = queue.popleft()
                    comp.append(u)
                    for v in adj[u]:
                        if v not in visited:
                            visited.add(v)
                            queue.append(v)
                components.append(comp)
        
        if components:
            largest_comp_nodes = max(components, key=len)
            largest_comp_set = set(largest_comp_nodes)
            
            final_nodes = [n for n in all_nodes if n["id"] in largest_comp_set]
            final_links = [l for l in links if l["source"] in largest_comp_set and l["target"] in largest_comp_set]
            
            print(f"Filter: Behalte nur größte Komponente ({len(final_nodes)} von {len(all_nodes)} Knoten, {len(components)} Komponenten gesamt)")
            all_nodes = final_nodes
            links = final_links

    data = {
        "nodes": all_nodes,
        "links": links
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Erfolgreich {len(data['nodes'])} Knoten und {len(data['links'])} Kanten nach {output_path} exportiert.")

if __name__ == "__main__":
    export_web_data()
