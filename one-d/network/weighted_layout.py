import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
import os
import math
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

# --- KONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_GEXF = os.path.join(BASE_DIR, "netzwerk.gexf")
OUTPUT_GEXF = os.path.join(BASE_DIR, "weighted_layout_result.gexf")
ITERATIONS = 2000
DAMPING = 0.81  # Wie stark sich die Nodes pro Schritt bewegen (0.0 bis 1.0)
GRAVITY_STRENGTH = 0.05  # Stärke der Anziehung zum Mittelpunkt
GRAVITY_THRESHOLD_FACTOR = 2  # Ab dem Wievielfachen der Durchschnittsdistanz Gravity wirkt
NUM_THREADS = multiprocessing.cpu_count()  # Anzahl der Threads für die Berechnung
# ---------------------

def load_graph_with_positions(path):
    """Lädt den GEXF Graph und extrahiert Startpositionen."""
    print(f"[*] Lade Graph aus {path}...")
    
    import xml.etree.ElementTree as ET
    import io
    
    # Namespaces definieren
    ns = {
        'gexf': 'http://gexf.net/1.3',
        'viz': 'http://gexf.net/1.3/viz'
    }
    
    try:
        tree = ET.parse(path)
        root = tree.getroot()
        
        # Falls der Namespace anders ist, versuchen wir ihn zu finden
        if 'http://gexf.net/1.3' not in root.tag and '{' in root.tag:
            actual_ns = root.tag.split('}')[0].strip('{')
            ns['gexf'] = actual_ns
            print(f"[*] Gefundener Namespace: {actual_ns}")

        G = nx.Graph()
        pos = {}
        sizes = {}
        colors = []
        
        # Mapping für Attribute (id -> title)
        attr_mapping = {}
        attr_elem = root.find('gexf:graph/gexf:attributes', ns) or root.find('graph/attributes')
        if attr_elem is not None:
            for attr in attr_elem.findall('gexf:attribute', ns) or attr_elem.findall('attribute'):
                attr_mapping[attr.get('id')] = attr.get('title')

        # Nodes extrahieren
        graph_elem = root.find('gexf:graph', ns)
        if graph_elem is None:
            # Versuche ohne Namespace
            graph_elem = root.find('graph')
            
        if graph_elem is None:
            raise ValueError("Kein <graph> Element gefunden")
            
        nodes_elem = graph_elem.find('gexf:nodes', ns) or graph_elem.find('nodes')
        for node in (nodes_elem.findall('gexf:node', ns) if nodes_elem is not None else []):
            node_id = node.get('id')
            label = node.get('label', node_id)
            
            # Position extrahieren
            viz_pos = node.find('viz:position', ns)
            if viz_pos is not None:
                x = float(viz_pos.get('x', 0))
                y = float(viz_pos.get('y', 0))
                pos[node_id] = np.array([x, y], dtype=float)
            else:
                pos[node_id] = np.random.uniform(-500, 500, 2).astype(float)
            
            # Attribute extrahieren
            node_attrs = {
                "type": "unknown",
                "node_weight": 1.0,
                "initiating_connections": "",
                "supporting_connections": "",
                "kv_id": ""
            }
            
            attvalues = node.find('gexf:attvalues', ns) or node.find('attvalues')
            if attvalues is not None:
                for att in attvalues.findall('gexf:attvalue', ns) or attvalues.findall('attvalue'):
                    attr_id = att.get('for')
                    attr_title = attr_mapping.get(attr_id, "")
                    attr_value = att.get('value', "")
                    
                    if attr_title == "type" or attr_id == "0":
                        node_attrs["type"] = attr_value
                    elif attr_title == "node_weight" or attr_id == "1":
                        node_attrs["node_weight"] = float(attr_value) if attr_value else 1.0
                    elif attr_title == "initiating_connections":
                        node_attrs["initiating_connections"] = attr_value
                    elif attr_title == "supporting_connections":
                        node_attrs["supporting_connections"] = attr_value
                    elif attr_title == "kv_id":
                        node_attrs["kv_id"] = attr_value
            
            # Node zum Graph hinzufügen mit allen Attributen
            G.add_node(node_id, label=label, **node_attrs)
            
            # Farbe bestimmen
            if node_attrs["type"] == "person":
                colors.append("red")
            elif node_attrs["type"] == "amendment":
                colors.append("blue")
            else:
                colors.append("gray")
                
            # Größe bestimmen: sqrt(node_weight)
            sizes[node_id] = math.sqrt(node_attrs["node_weight"])
                
        # Edges extrahieren
        edges_elem = graph_elem.find('gexf:edges', ns) or graph_elem.find('edges')
        for edge in (edges_elem.findall('gexf:edge', ns) if edges_elem is not None else []):
            u = edge.get('source')
            v = edge.get('target')
            weight = float(edge.get('weight', 1.0))
            G.add_edge(u, v, weight=weight)
            
        print(f"[+] Graph erfolgreich geladen: {len(G.nodes)} Nodes, {len(G.edges)} Edges")
        return G, pos, sizes, colors
        
    except Exception as e:
        print(f"[-] Manueller Parse-Fehler: {e}")
        raise e

def save_graph_with_positions(G, pos, sizes, path):
    """Speichert den Graph mit neuen Positionen und Größen in eine GEXF Datei."""
    print(f"[*] Speichere Ergebnis in {path}...")
    # Kopie erstellen um Original nicht zu verändern
    G_out = G.copy()
    for node_id, coords in pos.items():
        if 'viz' not in G_out.nodes[node_id]:
            G_out.nodes[node_id]['viz'] = {}
        G_out.nodes[node_id]['viz']['position'] = {'x': float(coords[0]), 'y': float(coords[1]), 'z': 0.0}
        G_out.nodes[node_id]['viz']['size'] = float(sizes[node_id])
    
    nx.write_gexf(G_out, path)

def apply_tls_rotation(pos, sizes, nodes, to_one_d=False, progress=0.0):
    """
    TLS (Total Least Squares) Rotation zur Achsenausrichtung.
    Rotiert den Graph so, dass die Hauptausdehnung entlang der X-Achse liegt.
    Optional: Reduziert die Y-Achse für 1D-Kompression.
    """
    # Gewichteter Schwerpunkt berechnen
    sum_w = 0.0
    sum_x = 0.0
    sum_y = 0.0
    
    for node_id in nodes:
        w = sizes[node_id]
        p = pos[node_id]
        sum_w += w
        sum_x += w * p[0]
        sum_y += w * p[1]
    
    if sum_w == 0:
        return pos
        
    center_x = sum_x / sum_w
    center_y = sum_y / sum_w
    
    # Kovarianzmatrix berechnen
    sxx = 0.0
    sxy = 0.0
    syy = 0.0
    
    for node_id in nodes:
        w = sizes[node_id]
        p = pos[node_id]
        dx = p[0] - center_x
        dy = p[1] - center_y
        sxx += w * dx * dx
        sxy += w * dx * dy
        syy += w * dy * dy
    
    # Rotationswinkel berechnen (Hauptachse)
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    cos_t = math.cos(-theta)
    sin_t = math.sin(-theta)
    
    # Rotation anwenden
    new_pos = {}
    for node_id in nodes:
        p = pos[node_id]
        dx = p[0] - center_x
        dy = p[1] - center_y
        
        rx = dx * cos_t - dy * sin_t
        ry = dx * sin_t + dy * cos_t
        
        # 1D-Kompression: Y-Achse reduzieren
        if to_one_d:
            ry *= (1.0 - progress)
        
        new_pos[node_id] = np.array([rx + center_x, ry + center_y])
        
    return new_pos

def run_layout():
    G, pos, sizes, colors = load_graph_with_positions(INPUT_GEXF)
    nodes = list(G.nodes())
    node_to_idx = {node: i for i, node in enumerate(nodes)}
    
    # Vorbereiten der Adjazenzliste für schnellere Threads
    # Wir speichern (Nachbar-Index, Gewicht) für jeden Node
    adj_indexed = []
    for node in nodes:
        neighbors_data = []
        for nbr in G.neighbors(node):
            weight = float(G[node][nbr].get('weight', 1.0))
            neighbors_data.append((node_to_idx[nbr], weight))
        adj_indexed.append(neighbors_data)
    
    # Positionen als Numpy-Array für schnelleren Zugriff
    pos_array = np.array([pos[n] for n in nodes])
    
    # ThreadPool für die Berechnung
    executor = ThreadPoolExecutor(max_workers=NUM_THREADS)

    # Vorbereitung der Visualisierung
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_facecolor('white')
    plt.subplots_adjust(bottom=0.2)
    ax.set_title("Weighted Center Layout (Iterative)")
    
    # Scatter plot für Nodes (Größen und Farben anwenden)
    node_x = [pos[n][0] for n in nodes]
    node_y = [pos[n][1] for n in nodes]
    node_sizes_list = [sizes[n] * 1 for n in nodes]  # Skalierung für Matplotlib
    scatter = ax.scatter(node_x, node_y, s=node_sizes_list, c=colors, alpha=0.8, edgecolors='none', zorder=10)
    
    # Achsen fest auf [-1.1, 1.1] setzen, da wir normalisieren
    ax.set_xlim(-1.1, 1.1)
    ax.set_ylim(-1.1, 1.1)
    ax.set_aspect('equal') # Sicherstellen, dass die Proportionen im Fenster stimmen

    iteration_text = ax.text(0.02, 0.95, '', transform=ax.transAxes)

    def compute_node_range(start_idx, end_idx, current_pos, g_center, g_std_devs):
        """Berechnet ein Segment von Nodes (wird von Threads ausgeführt)"""
        segment_new_pos = np.zeros((end_idx - start_idx, 2))
        
        # Sicherstellen, dass std_devs nicht 0 sind
        safe_std = np.where(g_std_devs > 0, g_std_devs, 1.0)
        
        for i in range(start_idx, end_idx):
            local_idx = i - start_idx
            node_idx = i
            
            # 1. Baryzentrisches Layout
            neighbors = adj_indexed[node_idx]
            if neighbors:
                weighted_sum = np.zeros(2)
                total_weight = 0.0
                for nbr_idx, weight in neighbors:
                    weighted_sum += weight * current_pos[nbr_idx]
                    total_weight += weight
                
                if total_weight > 0:
                    target = weighted_sum / total_weight
                    segment_new_pos[local_idx] = current_pos[node_idx] + DAMPING * (target - current_pos[node_idx])
                else:
                    segment_new_pos[local_idx] = current_pos[node_idx]
            else:
                segment_new_pos[local_idx] = current_pos[node_idx]
            
            # 2. Weiche elliptische Gravity
            # Wir berechnen die Distanz im skalierten Raum (elliptisch statt rechteckig)
            diff = g_center - current_pos[node_idx]
            normalized_diff = diff / safe_std
            elliptical_dist = np.linalg.norm(normalized_diff)
            
            if elliptical_dist > GRAVITY_THRESHOLD_FACTOR:
                # Weicher Übergang: Die Kraft startet bei 0 am Threshold und steigt linear an
                strength = (elliptical_dist - GRAVITY_THRESHOLD_FACTOR) * GRAVITY_STRENGTH
                segment_new_pos[local_idx] += diff * strength
                
        return start_idx, end_idx, segment_new_pos

    def update(frame):
        nonlocal pos_array
        
        # Berechnung des Flattening-Fortschritts (letzte 10% der Iterationen)
        flattening_start = int(ITERATIONS * 0.9)
        to_one_d = frame >= flattening_start
        progress = 0.0
        if to_one_d:
            progress = (frame - flattening_start) / (ITERATIONS - flattening_start)
            
        # Globale Statistiken für achsenweise Gravity
        global_center = np.mean(pos_array, axis=0)
        # Berechne Standardabweichung pro Achse für dynamischen Threshold
        std_devs = np.std(pos_array, axis=0)
        
        # Parallelisierung der Node-Berechnung
        chunk_size = (len(nodes) + NUM_THREADS - 1) // NUM_THREADS
        futures = []
        
        for i in range(0, len(nodes), chunk_size):
            end = min(i + chunk_size, len(nodes))
            futures.append(executor.submit(
                compute_node_range, i, end, pos_array, global_center, std_devs
            ))
        
        new_pos_array = np.zeros_like(pos_array)
        for future in futures:
            start, end, segment = future.result()
            new_pos_array[start:end] = segment
            
        # 3. TLS Rotation & Flattening
        temp_pos_dict = {nodes[i]: new_pos_array[i] for i in range(len(nodes))}
        temp_pos_dict = apply_tls_rotation(temp_pos_dict, sizes, nodes, to_one_d, progress)
        new_pos_array = np.array([temp_pos_dict[n] for n in nodes])
        
        # 4. Unabhängige Normalisierung auf [-1, 1]
        new_center = np.mean(new_pos_array, axis=0)
        new_pos_array -= new_center
        
        # Maxima für jede Achse separat finden
        max_vals = np.max(np.abs(new_pos_array), axis=0)
        
        if max_vals[0] > 0:
            new_pos_array[:, 0] /= max_vals[0]
            
        if max_vals[1] > 0:
            # Falls wir im Flattening sind, skalieren wir Y proportional zum Rest-Progress
            y_scale = (1.0 - progress) if to_one_d else 1.0
            new_pos_array[:, 1] = (new_pos_array[:, 1] / max_vals[1]) * y_scale
        
        pos_array = new_pos_array
        
        # Update Scatter
        scatter.set_offsets(pos_array)
            
        iteration_text.set_text(f"Iteration: {frame}")
        return scatter, iteration_text

    print("[*] Starte Layout-Animation...")
    ani = animation.FuncAnimation(fig, update, frames=ITERATIONS, interval=50, repeat=False)
    
    plt.show()
    
    # Nach Abschluss speichern
    final_pos = {nodes[i]: pos_array[i] for i in range(len(nodes))}
    save_graph_with_positions(G, final_pos, sizes, OUTPUT_GEXF)
    print("[+] Fertig!")

if __name__ == "__main__":
    run_layout()
