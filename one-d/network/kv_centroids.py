import os
import json
import xml.etree.ElementTree as ET
import re
import yaml
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GEXF_PATH = os.path.join(BASE_DIR, "weighted_layout_result.gexf")
YAML_PATH = os.path.join(os.path.dirname(BASE_DIR), "supported_amendments.yaml")
OUTPUT_FILE = os.path.join(BASE_DIR, "kv_centroids.json")

def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_").lower()

def clean_kv_id(name):
    if not name:
        return ""
    s = name
    # Erste Ersetzungen (entsprechend der Excel-Logik vor der Kleinschreibung)
    terms = ["Berlin-", "Berlin", " OV", "OV ", " BV", "BV ", " LV", "LV ", " RV", "RV ", " KV", "KV "]
    for term in terms:
        s = s.replace(term, "")
    
    # Kleinschreibung
    s = s.lower()
    
    # Finale Bereinigung von Sonderzeichen
    for char in [" ", "-", "/"]:
        s = s.replace(char, "")
    
    # Spezifische Zusammenfassungen (Mappings)
    mappings = {
        "pankowunterschriftübernommenvonmai2024": "pankow",
        "reinickendorfunterschriftübernommenvonmai2024": "reinickendorf",
        "reinickendrof": "reinickendorf",
        "lichtenbergunterschriftübernommenvonmai2024": "lichtenberg",
        "xhain": "friedrichshainkreuzberg",
        "potsdam": "kreisfrei",
        "chemnitz": "kreisfrei",
        "havelland": "kreisfrei",
        "oberhavel": "kreisfrei",
        "dahmespreewald": "kreisfrei",
        "bundesverband": "kreisfrei",
        "": "kreisfrei",
        "frankfurtoder": "kreisfrei",
        "leipzig": "kreisfrei"
    }
    
    return mappings.get(s, s)

def load_gexf_data(path):
    ns = {"gexf": "http://gexf.net/1.3", "viz": "http://gexf.net/1.3/viz"}
    tree = ET.parse(path)
    root = tree.getroot()
    if "http://gexf.net/1.3" not in root.tag and "}" in root.tag:
        ns["gexf"] = root.tag.split("}")[0].strip("{")
        ns["viz"] = ns["gexf"] + "/viz"
    graph_elem = root.find("gexf:graph", ns) or root.find("graph")
    nodes_elem = graph_elem.find("gexf:nodes", ns) or graph_elem.find("nodes")
    attr_map = {}
    attrs_elem = graph_elem.find("gexf:attributes", ns) or graph_elem.find("attributes")
    if attrs_elem is not None:
        for a in attrs_elem.findall("gexf:attribute", ns) or attrs_elem.findall("attribute"):
            attr_map[a.get("id")] = a.get("title")
    data = {}
    for node in nodes_elem.findall("gexf:node", ns) or nodes_elem.findall("node"):
        nid = node.get("id")
        p = node.find("viz:position", ns)
        x = float(p.get("x", 0)) if p is not None else 0.0
        y = float(p.get("y", 0)) if p is not None else 0.0
        t = "unknown"
        w = 1.0
        attvalues = node.find("gexf:attvalues", ns) or node.find("attvalues")
        if attvalues is not None:
            for att in attvalues.findall("gexf:attvalue", ns) or attvalues.findall("attvalue"):
                aid = att.get("for")
                title = attr_map.get(aid, "")
                val = att.get("value", "")
                if title == "type":
                    t = val
                elif title == "node_weight":
                    try:
                        w = float(val) if val != "" else 1.0
                    except:
                        w = 1.0
        data[nid] = {"pos": np.array([x, y], dtype=float), "type": t, "node_weight": w}
    return data

def load_supported_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        root = yaml.safe_load(f)
    mapping = {}
    for _, conf in root.items():
        content = conf.get("content", {})
        motions = content.get("motions", [])
        for motion in motions:
            for _, m in motion.items():
                amendments = m.get("amendments", [])
                for amend in amendments:
                    for _, a in amend.items():
                        aid = a.get("id")
                        supporters = a.get("supporters", [])
                        for sup in supporters:
                            for person_id, details in sup.items():
                                if details.get("type") != "person":
                                    continue
                                kv = details.get("organization")
                                if not kv:
                                    continue
                                kv_key = clean_kv_id(kv)
                                mapping.setdefault(kv_key, {})
                                persons = mapping[kv_key]
                                persons.setdefault(person_id, set())
                                persons[person_id].add(aid)
    return mapping

def compute_centroids(kv_person_amends, gexf_nodes):
    result = {}
    for kv, persons in kv_person_amends.items():
        kv_entry = {"kv_id": kv, "persons": []}
        for pid, amend_ids in persons.items():
            pts = []
            ws = []
            used = []
            for aid in amend_ids:
                nd = gexf_nodes.get(aid)
                if nd and nd["type"] == "amendment":
                    pts.append(nd["pos"])
                    ws.append(nd["node_weight"])
                    used.append(aid)
            if pts:
                wsum = float(np.sum(ws))
                centroid = (np.sum([p * w for p, w in zip(pts, ws)], axis=0) / wsum).tolist()
            else:
                centroid = [0.0, 0.0]
                wsum = 0.0
            kv_entry["persons"].append({
                "person_id": pid,
                "centroid": centroid,
                "supported_amendments": sorted(list(used)),
                "weight_sum": wsum
            })
        result[kv] = kv_entry
    return result

def write_outputs(centroids):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(centroids, f, ensure_ascii=False, indent=2)
    print(f"[*] Gesamte KV-Daten gespeichert in: {OUTPUT_FILE}")

def main():
    gexf_nodes = load_gexf_data(GEXF_PATH)
    kv_person_amends = load_supported_yaml(YAML_PATH)
    centroids = compute_centroids(kv_person_amends, gexf_nodes)
    write_outputs(centroids)

if __name__ == "__main__":
    main()
