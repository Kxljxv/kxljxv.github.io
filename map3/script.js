/****************************************
 * Globale Variablen / Strukturen
 ****************************************/

// URLs zu deinen Dateien (CSV + GeoJSON) - 2021
const CSV_URL_2021 = "https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2021(8).csv";
const GEOJSON_URL_2021 = "https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2021nurID.json";

// URLs zu deinen Dateien (CSV + GeoJSON) - 2025
const CSV_URL_2025 = "https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2025(8).csv";
const GEOJSON_URL_2025 = "https://kxljxv.github.io/wahlergebnisse/wahlergebnisse2025nurID.json";

/**
 * Wir gehen davon aus, dass in den CSVs folgende Spalten vorkommen:
 * - ID
 * - Wahlbeteiligung
 * - CDU
 * - LINKE
 * - SPD
 * - Gruen
 * - AfD
 * - FDP
 * - PMUT
 * - FW
 * - MLPD
 * - Volt
 * (und in 2025 ggf. BSW zusätzlich)
 *
 * Die Donut-Grafik soll alle Parteien enthalten.
 * Die Attribut-Auswahl (Färbung) soll auch "Wahlbeteiligung" + Parteien enthalten.
 */

// Definiere, welche "Attribute" wählbar sind
// (für die Färbung der Karte)
const ATTRIBUTES = [
  "Wahlbeteiligung",
  "CDU",
  "LINKE",
  "SPD",
  "Gruen",
  "AfD",
  "FDP",
  "PMUT",
  "FW",
  "MLPD",
  "Volt",
  "BSW" // nur in 2025 vorhanden, in 2021 ist das Feld evtl. 0 oder nicht vorhanden
];

// Für den Donut-Chart wollen wir ALLE Parteien (ohne Wahlbeteiligung):
const PARTIES_FOR_CHART = [
  "CDU",
  "LINKE",
  "SPD",
  "Gruen",
  "AfD",
  "FDP",
  "PMUT",
  "FW",
  "MLPD",
  "Volt",
  "BSW"
];

// Farben pro Partei / Attribut
const COLOR_MAPPING = {
  "CDU":  getComputedStyle(document.documentElement).getPropertyValue('--party-cdu'),
  "LINKE": getComputedStyle(document.documentElement).getPropertyValue('--party-linke'),
  "SPD":   getComputedStyle(document.documentElement).getPropertyValue('--party-spd'),
  "Gruen": getComputedStyle(document.documentElement).getPropertyValue('--party-gruen'),
  "AfD":   getComputedStyle(document.documentElement).getPropertyValue('--party-afd'),
  "FDP":   getComputedStyle(document.documentElement).getPropertyValue('--party-fdp'),
  "BSW":   getComputedStyle(document.documentElement).getPropertyValue('--party-bsw'),
  "PMUT":  getComputedStyle(document.documentElement).getPropertyValue('--party-tierschutz'),
  "Volt":  getComputedStyle(document.documentElement).getPropertyValue('--party-volt'),
  "FW":    getComputedStyle(document.documentElement).getPropertyValue('--party-fw'),
  "MLPD":  getComputedStyle(document.documentElement).getPropertyValue('--party-mlpd'),
  // Für Wahlbeteiligung nehmen wir z.B.:
  "Wahlbeteiligung": getComputedStyle(document.documentElement).getPropertyValue('--participation-color')
};

// Hier speichern wir die Daten aus den CSV-Dateien (nach ID geordnet)
let csvData2021 = {};  // csvData2021[ID] = {Wahlbeteiligung: ..., SPD: ..., ...}
let csvData2025 = {};  // csvData2025[ID] = {Wahlbeteiligung: ..., SPD: ..., ...}

// Hier speichern wir die GeoJSON-Daten für 2021 und 2025 (nachdem sie geladen wurden)
let geojson2021 = null;
let geojson2025 = null;

// Aktuelle Auswahl (Jahr und Attribut)
let currentYear = "2021";
let currentAttribute = "Wahlbeteiligung";

// Map-Objekt (MapLibre)
let map;

// Marker oder Info, falls gewünscht
let lastClickedFeature = null;

// amCharts Donut-Chart
let chartRoot;
let chartSeries;

/****************************************
 * Initialisierung
 ****************************************/
window.addEventListener("load", async () => {
  // 1) CSV-Daten laden
  await loadCSVData();

  // 2) GeoJSON-Daten laden
  geojson2021 = await loadGeoJSON(GEOJSON_URL_2021);
  geojson2025 = await loadGeoJSON(GEOJSON_URL_2025);

  // 3) CSV-Daten in GeoJSON mergen
  mergeCSVIntoGeoJSON(geojson2021, csvData2021);
  mergeCSVIntoGeoJSON(geojson2025, csvData2025);

  // 4) Karte initialisieren
  initMap();

  // 5) amCharts Donut initialisieren
  initDonutChart();

  // 6) Select-Boxen füllen und Eventlistener setzen
  populateAttributeSelect();
  document.getElementById("attributeSelect").addEventListener("change", (e) => {
    currentAttribute = e.target.value;
    updateMapColors();
    updateDonutChart(lastClickedFeature); // neu rendern, falls bereits Bezirk gewählt
  });

  document.getElementById("yearSelect").addEventListener("change", (e) => {
    currentYear = e.target.value;
    switchGeoJSONSource(); 
    updateDonutChart(lastClickedFeature);
  });
});

/****************************************
 * CSV laden und in Objekte speichern
 ****************************************/
async function loadCSVData() {
  // CSV für 2021 laden
  csvData2021 = await fetchCSVandParse(CSV_URL_2021);
  // CSV für 2025 laden
  csvData2025 = await fetchCSVandParse(CSV_URL_2025);
}

// Hilfsfunktion: CSV laden + parsen (ohne zusätzliche Libraries)
async function fetchCSVandParse(url) {
  const response = await fetch(url);
  const csvText = await response.text();
  return parseCSV(csvText);
}

/**
 * Sehr einfacher CSV-Parser (Trennzeichen: \t oder ; oder ,).
 * Gibt ein Objekt zurück: dataByID[id] = {Spalte1:Wert1, Spalte2:Wert2,...}
 */
function parseCSV(csvText) {
  // Zeilen splitten (auch CRLF abfangen)
  let lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);

  // Versuchen, Delimiter zu erkennen (z.B. \t oder ; oder 
