/***********************
 * Datensätze und Konfiguration
 ***********************/
var dataset2025 = {
  url: 'https://kxljxv.github.io/wahlergebnisse2025.json',
  partyRanges: {
    "SPDinkBW": { min: 0.06, max: 0.39984263 },
    "GrueninkBW": { min: 0.015, max: 0.541414141 },
    "CDUinkBW": { min: 0.025714286, max: 0.46 },
    "LINKEinkBW": { min: 0.011583012, max: 0.5 },
    "AfDinkBW": { min: 0.005931198, max: 0.5 },
    "FDPinkBW": { min: 0.004, max: 0.268841395 },
    "BSWinkBWB": { min: 0.012, max: 0.16 },
    "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { min: 0.0, max: 0.085704944 },
    "VoltDeutschlandinkBW": { min: 0.0, max: 0.029 },
    "FWinkBW": { min: 0.0, max: 0.034937014 },
    "MLPDinkBW": { min: 0.0, max: 0.012658228 }
  },
  availableParties: [
    "SPDinkBW", "GrueninkBW", "CDUinkBW", "LINKEinkBW",
    "AfDinkBW", "FDPinkBW", "BSWinkBWB", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
    "VoltDeutschlandinkBW", "FWinkBW", "MLPDinkBW"
  ]
};

var dataset2021 = {
  url: 'https://kxljxv.github.io/wahlergebnisse2021.json',
  partyRanges: {
    "SPDinkBW": { min: 0.06, max: 0.39984263 },
    "GrueninkBW": { min: 0.015, max: 0.541414141 },
    "CDUinkBW": { min: 0.025714286, max: 0.46 },
    "LinkeinkBW": { min: 0.011583012, max: 0.5 },
    "AfDinkBW": { min: 0.005931198, max: 0.5 },
    "FDPinkBW": { min: 0.004, max: 0.268841395 },
    "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { min: 0.0, max: 0.085704944 },
    "VoltinkBW": { min: 0.0, max: 0.029 },
    "FWinkBW": { min: 0.0, max: 0.034937014 },
    "MLPDinkBW": { min: 0.0, max: 0.012658228 }
  },
  availableParties: [
    "SPDinkBW", "GrueninkBW", "CDUinkBW", "LinkeinkBW",
    "AfDinkBW", "FDPinkBW", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
    "VoltinkBW", "FWinkBW", "MLPDinkBW"
  ]
};

// Um Mapping-Probleme zu lösen: Wenn "VoltinkBW" (2021) und "Volt" (2025) dieselbe Partei darstellen, definieren wir ein Mapping
var partyMapping = {
  "VoltinkBW": "Volt"
};

var currentDataset = dataset2025;
var currentParty = "Gewinner";  // Standardmäßig Gewinner-Modus
var geojsonData = null;

/***********************
 * Karte initialisieren
 ***********************/
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://kxljxv.github.io/bm_web_gry_7.json',
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

/***********************
 * Jahresauswahl: Buttongroup unter der Karte
 ***********************/
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    var selectedYear = this.getAttribute('data-year');
    currentDataset = (selectedYear === "2025") ? dataset2025 : dataset2021;
    // Bei Wechsel: Überprüfe, ob die aktuell gewählte Partei in diesem Datensatz vorhanden ist.
    // Falls nicht, prüfe, ob ein Mapping vorhanden ist.
    if (currentParty !== "Gewinner") {
      if (!currentDataset.availableParties.includes(currentParty)) {
        // Prüfe Mapping: Falls currentParty (z.B. VoltinkBW) im Mapping vorhanden ist, ersetze es.
        currentParty = partyMapping[currentParty] || "Gewinner";
      }
    }
    populatePartyRadioGroup();
    loadGeoJson();
  });
});
document.querySelector('.year-btn[data-year="2025"]').classList.add('active');

/***********************
 * GeoJSON-Daten laden
 ***********************/
function loadGeoJson() {
  fetch(currentDataset.url)
    .then(response => response.json())
    .then(data => {
      geojsonData = data;
      updateMapColors();
      if (!map.getSource('geojson-layer')) {
        map.addSource('geojson-layer', { type: 'geojson', data: geojsonData });
        var firstLayerId = map.getStyle().layers[0].id;
        map.addLayer({
          id: 'geojson-fill',
          type: 'fill',
          source: 'geojson-layer',
          paint: {
            'fill-color': ['get', 'fillColor'],
            'fill-opacity': 1,
            'fill-outline-color': 'transparent'
          }
        }, firstLayerId);
      } else {
        map.getSource('geojson-layer').setData(geojsonData);
      }
    })
    .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
}
loadGeoJson();

/***********************
 * Farben aktualisieren
 ***********************/
function updateMapColors() {
  if (!geojsonData) return;
  geojsonData.features.forEach(function(feature) {
    var fillColor;
    if (currentParty === "Gewinner") {
      // Gewinner-Modus: Ermittle die höchste Partei, verwende einheitliche Farbe (Platzhalter aus CSS)
      var winningParty = null, winningValue = 0;
      currentDataset.availableParties.forEach(function(key) {
        var val = parseFloat(feature.properties[key].replace(',', '.'));
        if (val > winningValue) {
          winningValue = val;
          winningParty = key;
        }
      });
      fillColor = getPartyColor(winningParty);
    } else {
      var val = parseFloat(feature.properties[currentParty].repla
