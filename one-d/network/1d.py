#!/usr/bin/env python3
"""
Modifizierte OpenOrd 1D + Degree Layout Implementierung
Berechnet Node-Positionen exakt wie das TypeScript-Original
"""

import networkx as nx
import math
import random
from typing import Dict, List, Tuple
import sys
import matplotlib.pyplot as plt
import matplotlib
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import os


class OpenOrd1DDegreeLayout:
    """OpenOrd Layout-Algorithmus mit 1D-Kompression und Degree-basierter Y-Achse"""
    
    def __init__(self, graph: nx.Graph, show_visualization: bool = True):
        self.graph = graph
        self.iterations = 10
        self.canvas_size = 2000
        self.show_visualization = show_visualization
        
        # Phasen laut Paper (Simmer entfernt)
        self.phases = {
            'LIQUID': 200,
            'EXPANSION': 500,
            'COOLDOWN': 750,
            'CRUNCH': 900
        }
        
        self.node_data = {}
        self.nodes = list(graph.nodes())
        
        # Multithreading Konfiguration
        # Wir nutzen 75% der verfügbaren Kerne um UI-Freezes zu vermeiden
        cpu_count = os.cpu_count() or 4
        self.num_workers = max(1, int(cpu_count * 0.75))
        self.chunk_size = 100 # Minimale Chunkgröße
        
    def initialize_nodes(self):
        """Initialisiert alle Nodes mit Positionen aus GEXF (falls vorhanden) oder Zufall"""
        raw_positions = {}
        for node_id in self.nodes:
            attrs = self.graph.nodes[node_id]
            viz = attrs.get('viz', {})
            pos = viz.get('position', {}) if isinstance(viz, dict) else {}
            
            x = pos.get('x')
            y = pos.get('y')
            
            if x is not None and y is not None:
                raw_positions[node_id] = (float(x), float(y))

        pos_count = len(raw_positions)
        print(f"  {pos_count} von {len(self.nodes)} Nodes hatten vordefinierte Positionen.")

        # Normalisierungsparameter berechnen
        scale_factor = 1.0
        offset_x = 0.0
        offset_y = 0.0

        if pos_count > 0:
            all_x = [p[0] for p in raw_positions.values()]
            all_y = [p[1] for p in raw_positions.values()]
            
            min_x, max_x = min(all_x), max(all_x)
            min_y, max_y = min(all_y), max(all_y)
            
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            
            width = max_x - min_x
            height = max_y - min_y
            
            # Wir skalieren so, dass die Nodes ca. 80% des Canvas einnehmen
            # Die Standard-Zufallsverteilung ist [-1000, 1000], also Spannweite 2000
            target_span = self.canvas_size * 0.8
            current_span = max(width, height, 1.0)
            scale_factor = target_span / current_span
            
            offset_x = center_x
            offset_y = center_y
            
            print(f"  Normalisierung: Scale={scale_factor:.2f}, Offset=({offset_x:.2f}, {offset_y:.2f})")

        # Nodes initialisieren
        for node_id in self.nodes:
            attrs = self.graph.nodes[node_id]
            degree = self.graph.degree(node_id)
            
            if node_id in raw_positions:
                rx, ry = raw_positions[node_id]
                x = (rx - offset_x) * scale_factor
                y = (ry - offset_y) * scale_factor
            else:
                # Fallback für Nodes ohne Position
                x = (random.random() - 0.5) * self.canvas_size
                y = (random.random() - 0.5) * self.canvas_size
            
            self.node_data[node_id] = {
                'x': x,
                'y': y,
                'size': float(attrs.get('size', 1)),
                'node_weight': float(attrs.get('node_weight', 1.0)),
                'degree': degree,
                'type': attrs.get('type', 'unknown'),
                'vx': 0.0,
                'vy': 0.0,
                'last_dx': 0.0,
                'last_dy': 0.0
            }
        
        # Initiale TLS Rotation anwenden, um die Startpositionen auszurichten
        if pos_count > 0:
            print("Wende initiale TLS-Rotation auf Startpositionen an...")
            self.apply_tls_rotation(False, 0.0)
        else:
            print("Keine vordefinierten Positionen gefunden, TLS-Rotation übersprungen.")
    
    def apply_tls_rotation(self, to_one_d: bool, progress: float):
        """
        TLS (Total Least Squares) Rotation zur Achsenausrichtung
        Entspricht der applyTLSRotation Funktion im TypeScript
        """
        # Gewichteter Schwerpunkt berechnen
        sum_w = 0.0
        sum_x = 0.0
        sum_y = 0.0
        
        for node_id in self.nodes:
            n = self.node_data[node_id]
            sum_w += n['size']
            sum_x += n['size'] * n['x']
            sum_y += n['size'] * n['y']
        
        center_x = sum_x / sum_w
        center_y = sum_y / sum_w
        
        # Kovarianzmatrix berechnen
        sxx = 0.0
        sxy = 0.0
        syy = 0.0
        
        for node_id in self.nodes:
            n = self.node_data[node_id]
            dx = n['x'] - center_x
            dy = n['y'] - center_y
            sxx += n['size'] * dx * dx
            sxy += n['size'] * dx * dy
            syy += n['size'] * dy * dy
        
        # Rotationswinkel berechnen
        theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
        cos_t = math.cos(-theta)
        sin_t = math.sin(-theta)
        
        # Rotation anwenden
        for node_id in self.nodes:
            n = self.node_data[node_id]
            dx = n['x'] - center_x
            dy = n['y'] - center_y
            
            new_x = dx * cos_t - dy * sin_t
            new_y = dx * sin_t + dy * cos_t
            
            # Für 1D-Kompression Y-Achse reduzieren
            if to_one_d:
                new_y *= (1 - progress)
            
            n['x'] = new_x + center_x
            n['y'] = new_y + center_y
    
    def calculate_repulsion(self, temp: float, k: float):
        """Berechnet abstoßende Kräfte zwischen Nodes (Parallelisiert)"""
        base_sample_size = 50 if len(self.nodes) > 100 else len(self.nodes)
        
        # Hilfsfunktion für Worker-Threads
        def process_node_chunk(chunk_nodes):
            local_updates = {}
            for node_id in chunk_nodes:
                n1 = self.node_data[node_id]
                dvx, dvy = 0.0, 0.0
                
                # Dynamische Sample-Größe basierend auf node_weight
                # sample_size = base_sample_size * sqrt(node_weight)
                node_weight = n1.get('node_weight', 1.0)
                current_sample_size = int(base_sample_size * math.sqrt(node_weight))
                current_sample_size = max(1, min(current_sample_size, len(self.nodes) - 1))
                
                for _ in range(current_sample_size):
                    random_node = random.choice(self.nodes)
                    n2 = self.node_data[random_node]
                    if n1 is n2: continue
                    
                    dx = n1['x'] - n2['x']
                    dy = n1['y'] - n2['y']
                    dist = math.sqrt(dx * dx + dy * dy) or 1.0
                    
                    force = (k * k) / dist
                    
                    # Abstoßung zwischen gleichem Typ verstärken (Dämpft Oszillationen)
                    if n1.get('type') == n2.get('type'):
                        force *= 2.0
                        
                    dvx += (dx / dist) * force
                    # Hinweis: Originalcode hatte nur vx, wir bleiben dabei um Algorithmus nicht zu ändern
                
                local_updates[node_id] = (dvx, dvy)
            return local_updates

        # Chunks erstellen
        chunks = [self.nodes[i:i + self.chunk_size] for i in range(0, len(self.nodes), self.chunk_size)]
        
        with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            results = list(executor.map(process_node_chunk, chunks))
            
        # Ergebnisse zusammenführen
        for update_dict in results:
            for node_id, (dvx, dvy) in update_dict.items():
                self.node_data[node_id]['vx'] += dvx
                # self.node_data[node_id]['vy'] += dvy # Bleibt 0 laut Original
    
    def calculate_attraction(self, edge_cutting: bool, k: float):
        """Berechnet anziehende Kräfte entlang der Kanten (Parallelisiert)"""
        edges = list(self.graph.edges(data=True))
        
        def process_edge_chunk(chunk_edges):
            local_updates = {} # node_id -> [dvx, dvy]
            for u, v, data in chunk_edges:
                n1 = self.node_data[u]
                n2 = self.node_data[v]
                
                dx = n1['x'] - n2['x']
                dy = n1['y'] - n2['y']
                dist = math.sqrt(dx * dx + dy * dy) or 1.0
                
                if edge_cutting and dist > k * 2: continue
                
                weight = data.get('weight', 1)
                force = (dist * dist) / k * weight
                
                fx = (dx / dist) * force
                fy = (dy / dist) * force
                
                for node_id, mult in [(u, -1), (v, 1)]:
                    if node_id not in local_updates: local_updates[node_id] = [0.0, 0.0]
                    local_updates[node_id][0] += fx * mult
                    local_updates[node_id][1] += fy * mult
            return local_updates

        # Chunks erstellen
        chunks = [edges[i:i + self.chunk_size] for i in range(0, len(edges), self.chunk_size)]
        
        with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            results = list(executor.map(process_edge_chunk, chunks))
            
        # Ergebnisse zusammenführen
        for update_dict in results:
            for node_id, (dvx, dvy) in update_dict.items():
                self.node_data[node_id]['vx'] += dvx
                self.node_data[node_id]['vy'] += dvy
    
    def integrate_forces(self, temp: float, k: float):
        """
        Integriert die Kräfte und aktualisiert Positionen.
        Inklusive fließender Richtungs-Dämpfung und allgemeiner Geschwindigkeits-Dämpfung.
        """
        # Allgemeine Dämpfung für alle Bewegungen (wie Reibung)
        global_damping = 0.8
        
        for node_id in self.nodes:
            n = self.node_data[node_id]
            
            vx, vy = n['vx'], n['vy']
            ldx, ldy = n['last_dx'], n['last_dy']
            
            v_dist = math.sqrt(vx * vx + vy * vy) or 1.0
            last_dist = math.sqrt(ldx * ldx + ldy * ldy)
            
            # 1. Richtungs-Dämpfung (Oszillationsschutz)
            dir_damping = 1.0
            if last_dist > 0 and v_dist > 0:
                dot_product = (vx * ldx + vy * ldy)
                cos_theta = dot_product / (v_dist * last_dist)
                cos_theta = max(-1.0, min(1.0, cos_theta))
                # 0.5 bei 180°, 0.75 bei 90°, 1.0 bei 0°
                dir_damping = 0.75 + 0.25 * cos_theta
            
            # 2. Berechnung der Basis-Bewegung
            move = min(v_dist, temp * k) * dir_damping * global_damping
            
            # 3. Zusätzliche "Bremsung" für sehr starke Bewegungen (Soft-Limiting)
            # Wenn die Bewegung größer als das 2-fache der idealen Kantenlänge k ist,
            # wird sie progressiv abgeschwächt.
            if move > k:
                move = k + (move - k) * 0.5
            
            dx = (vx / v_dist) * move
            dy = (vy / v_dist) * move
            
            n['x'] += dx
            n['y'] += dy
            
            # Speichere Verschiebung für nächsten Oszillations-Check
            n['last_dx'] = dx
            n['last_dy'] = dy
            
            # Geschwindigkeiten zurücksetzen
            n['vx'] = 0.0
            n['vy'] = 0.0
    
    def compress_y_axis(self):
        """Setzt Y-Achse sofort auf Null für echte 1D-Projektion"""
        for node_id in self.nodes:
            self.node_data[node_id]['y'] = 0.0
    
    def apply_degree_to_y_axis(self):
        """
        Finale Anpassung: Y-Achse wird auf Null gesetzt
        """
        for node_id in self.nodes:
            self.node_data[node_id]['y'] = 0.0
    
    def run(self) -> Dict[str, Tuple[float, float]]:
        """Führt den kompletten Layout-Algorithmus aus"""
        print(f"Initialisiere {len(self.nodes)} Nodes...")
        self.initialize_nodes()
        
        k = math.sqrt((self.canvas_size * self.canvas_size) / len(self.nodes))
        
        # Visualisierung initialisieren
        scatter = None
        fig = None
        ax = None
        if self.show_visualization:
            plt.ion()
            fig, ax = plt.subplots(figsize=(10, 8))
            ax.set_facecolor('#1a1a1a')
            fig.patch.set_facecolor('#1a1a1a')
            ax.set_xlim(-self.canvas_size, self.canvas_size)
            ax.set_ylim(-self.canvas_size, self.canvas_size)
            ax.set_title("OpenOrd 1D Simulation", color='white')
            
            x_vals = [self.node_data[n]['x'] for n in self.nodes]
            y_vals = [self.node_data[n]['y'] for n in self.nodes]
            
            # Farblogik basierend auf Knotentyp
            colors = []
            for n in self.nodes:
                ntype = self.node_data[n].get('type', '').lower()
                if 'amendments' in ntype or 'amendment' in ntype:
                    colors.append('#ff4444') # Rot für Amendments
                elif 'person' in ntype:
                    colors.append('#4444ff') # Blau für Personen
                else:
                    colors.append('cyan')    # Standardfarbe für Unbekannt
            
            scatter = ax.scatter(x_vals, y_vals, s=5, c=colors, alpha=0.6, edgecolors='none')
            plt.tight_layout()

        print("Starte Simulation...")
        for i in range(self.iterations):
            # Temperatur und Phase bestimmen
            temp = 1.0
            edge_cutting = i > self.phases['EXPANSION']
            progress_1d = max(0.0, (i - 625) / 275) if i > 625 else 0.0
            
            # Temperatursteuerung nach Phasen
            if i < self.phases['LIQUID']:
                temp = 1.0
            elif i < self.phases['EXPANSION']:
                temp = 1.2
            elif i < self.phases['COOLDOWN']:
                temp = 1.0 * (1 - (i - 500) / 250)
            else:
                temp = 0.3
            
            # Kräfte berechnen
            self.calculate_repulsion(temp, k)
            self.calculate_attraction(edge_cutting, k)
            self.integrate_forces(temp, k)
            
            # TLS Rotation an bestimmten Iterationen
            if i in [625, 750, 899]:
                self.apply_tls_rotation(True, progress_1d)
            
            # Y-Achsen Kompression nach Iteration 625
            if i > 625:
                self.compress_y_axis()
            
            # Visualisierung aktualisieren
            if self.show_visualization:
                new_pos = np.array([[self.node_data[n]['x'], self.node_data[n]['y']] for n in self.nodes])
                scatter.set_offsets(new_pos)
                
                # Auto-Zoom alle 50 Iterationen
                if (i + 1) % 50 == 0:
                    x_min, x_max = new_pos[:, 0].min(), new_pos[:, 0].max()
                    y_min, y_max = new_pos[:, 1].min(), new_pos[:, 1].max()
                    
                    # Padding hinzufügen (10%)
                    x_pad = (x_max - x_min) * 0.1
                    y_pad = (y_max - y_min) * 0.1
                    
                    # Mindestgröße sicherstellen, falls alle Punkte auf einem Fleck sind
                    if x_pad == 0: x_pad = 100
                    if y_pad == 0: y_pad = 100
                    
                    ax.set_xlim(x_min - x_pad, x_max + x_pad)
                    # Bei Y-Achse unterscheiden wir: normale Phase vs. 1D Kompression
                    if i <= 625:
                         ax.set_ylim(y_min - y_pad, y_max + y_pad)
                    else:
                         # Während der Kompression wird Y durch compress_y_axis gesteuert,
                         # aber wir wollen trotzdem reinzoomen, wenn die Wolke flacher wird.
                         # Die Logik weiter unten (dynamische Achsenanpassung) überschreibt dies ggf.,
                         # daher integrieren wir es hier oder lassen die untere Logik greifen.
                         # Da die untere Logik auf canvas_size * (1-progress) basiert, ist sie "starrer".
                         # Wir nutzen hier die tatsächlichen Daten-Bounds für besseren Zoom.
                         ax.set_ylim(y_min - y_pad, y_max + y_pad)

                fig.canvas.draw_idle()
                plt.pause(0.001)

            # Fortschrittsanzeige
            if (i + 1) % 100 == 0:
                print(f"  Iteration {i + 1}/{self.iterations}")
        
        if self.show_visualization:
            plt.ioff()
            plt.close(fig)

        print("Wende finale Degree-basierte Y-Positionierung an...")
        self.apply_degree_to_y_axis()
        
        # Rückgabe als Dictionary mit (x, y) Tupeln
        return {node_id: (n['x'], n['y']) for node_id, n in self.node_data.items()}


def process_gexf(input_file: str, output_file: str):
    """Verarbeitet GEXF-Datei und schreibt mit neuen Positionen"""
    print(f"Lade Graph aus {input_file}...")
    
    # GEXF laden
    graph = nx.read_gexf(input_file)
    print(f"Graph geladen: {graph.number_of_nodes()} Nodes, {graph.number_of_edges()} Edges")
    
    # Layout berechnen
    layout = OpenOrd1DDegreeLayout(graph)
    positions = layout.run()
    
    # Positionen in Graph übertragen
    print("Übertrage Positionen in Graph...")
    for node_id, (x, y) in positions.items():
        if 'viz' not in graph.nodes[node_id]:
            graph.nodes[node_id]['viz'] = {}
        graph.nodes[node_id]['viz']['position'] = {'x': float(x), 'y': float(y), 'z': 0.0}
    
    # Graph speichern
    print(f"Speichere Graph nach {output_file}...")
    nx.write_gexf(graph, output_file)
    
    print("Fertig!")


if __name__ == "__main__":
    # Verzeichnis des Skripts ermitteln
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Pfade zu den Dateien (bevorzugt im gleichen Verzeichnis wie das Skript)
    input_file = os.path.join(script_dir, "netzwerk.gexf")
    output_file = os.path.join(script_dir, "simuliertes-netzwerk-500.gexf")
    
    # Falls die Datei nicht im network/ Ordner ist, im Hauptverzeichnis suchen
    if not os.path.exists(input_file):
        root_dir = os.path.dirname(script_dir)
        input_file = os.path.join(root_dir, "netzwerk.gexf")
        output_file = os.path.join(root_dir, "ldk_la.gexf")

    print(f"Nutze Input: {input_file}")
    print(f"Nutze Output: {output_file}")
    
    try:
        process_gexf(input_file, output_file)
    except FileNotFoundError:
        print(f"Fehler: Datei '{input_file}' nicht gefunden!")
        sys.exit(1)
    except Exception as e:
        print(f"Fehler bei der Verarbeitung: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)