# 1D Ideologie-Layout (LDK-26-1-Schnell)

Dieses Projekt berechnet und visualisiert die relative politische Positionierung (1D-Layout) von Personen und Anträgen (Amendments) basierend auf deren Interaktionen.

## 🚀 Kernfunktionen

- **Baryzentrisches Layout**: Berechnung der Positionen basierend auf einem gewichteten Mittelpunkt-Algorithmus.
- **Duale Darstellung**: Visualisierung von Personen (oben) und Anträgen (unten) auf einer gemeinsamen Achse.
- **Interaktive Web-Ansicht**: Zoombares Canvas mit Suchfunktion und Filterung nach Status.
- **R-Integration**: Robustes Backend-Skript für komplexe statistische Berechnungen und statische Grafikausgabe.

## 🛠 Technische Details

### Gewichtungs-Logik
Um die Positionen zu bestimmen, werden folgende Gewichte verwendet:
- **Initiatoren**: Faktor 3.0
- **Unterstützer (Supporter)**: Linear abnehmend von 1.5 (erster Supporter) bis 1.0 (letzter Supporter).

### Algorithmus
1. **Selbstbeeinflussungs-Eliminierung**: Bei der Berechnung der Personen-Position wird das eigene Gewicht aus dem Zentrum des Antrags herausgerechnet (Virtual Center).
2. **Gravitation**: Eine stückweise Gravitationskraft zieht Ausreißer sanft Richtung Zentrum (0), um das Layout kompakt zu halten.
3. **Quantil-Normalisierung**: Die Positionen werden so skaliert, dass das 10%- und 90%-Quantil bei -1 bzw. 1 liegen.
4. **Iterationen**: Der Algorithmus läuft über 100 Iterationen, um ein stabiles Gleichgewicht zu finden.

## 📁 Projektstruktur

- `graph_layout.R`: Das Hauptskript für die Berechnungen in R.
- `view_r_results.html`: Interaktive Web-Visualisierung der Ergebnisse.
- `final_data.db`: SQLite-Datenbank mit Personen- und Antragsdaten.
- `person_positions_r.json` / `amendment_positions_r.json`: Exportierte Koordinaten für die Web-Ansicht.
- `person_layout_r.png`: Statische Visualisierung der Ergebnisse.

## 🚦 Installation & Nutzung

### Voraussetzungen
- **R** (v4.5.2 oder höher)
- **R-Pakete**: `RSQLite`, `jsonlite`, `ggplot2`, `dplyr`, `tidyr`, `purrr`
- **Python** (optional, für den lokalen Webserver)

### Ausführung
1. **Berechnung starten**:
   ```bash
   Rscript graph_layout.R
   ```
2. **Web-Visualisierung öffnen**:
   Starte einen lokalen Server (z.B. mit Python):
   ```bash
   python -m http.server 8000
   ```
   Öffne dann `http://localhost:8000/view_r_results.html` im Browser.

## 🎨 Farbschema der Anträge
Die Anträge werden in der Web-Ansicht nach ihrem Status eingefärbt:
- 🟠 **Orange**: Eingereicht
- 🟢 **Grün**: Angenommen
- 🔴 **Rot**: Abgelehnt
- 🟡 **Gelb**: Zurückgezogen
- 🟣 **Lila**: Überwiesen
