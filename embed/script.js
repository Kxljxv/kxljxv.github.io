// Hilfsfunktion: URL-Parameter auslesen
function getURLParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// Lese Parameter: Partei, Jahr, Modus (dark/light) – Diese Parameter können die interne Konfiguration steuern
const partyParam = getURLParam('partei') || "Gewinner";
const yearParam = getURLParam('jahr') || "2025";
const modeParam = getURLParam('mode') || "dark";

// Für dieses Embed verwenden wir keine zusätzlichen UI-Elemente (Steuerelemente werden entfernt).
// Definieren Sie alternativ, welche Parameter Sie verarbeiten möchten.
var currentParty = partyParam;

// Beispiel: Für Darkmode vs. Lightmode können Sie unterschiedliche Styles verwenden.
// Hier verwenden wir den Demo-Style von Maplibre (diesen können Sie anpassen).
const darkStyle = "https://demotiles.maplibre.org/style.json";
const lightStyle = "https://demotiles.maplibre.org/style.json"; // Ersetzen, falls ein Lightmode-Stil gewünscht ist
const mapStyle = (modeParam === "light") ? lightStyle : darkStyle;

// Initialisieren Sie die Karte
var map = new maplibregl.Map({
  container: 'map',
  style: mapStyle,
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});

// Deaktivieren Sie Kamera-Rotation (Neigung, Kompass, etc.)
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Entfernen Sie alle Standard-UI-Controls (Zoom, Navigation, etc.)
if (map.getControl('navigation')) {
  map.removeControl(map.getControl('navigation'));
}

// Laden Sie die GeoJSON-Daten basierend auf dem Jahr (hier als Beispiel)
var dataURL = (yearParam === "2025") ?
  'https://kxljxv.github.io/wahlergebnisse2025.json' :
  'https://kxljxv.github.io/wahlergebnisse2021.json';

fetch(dataURL)
  .then(response => response.json())
  .then(data => {
    // Optional: Bearbeiten Sie die Daten, z.B. setzen Sie Farben entsprechend dem partyParam.
    // Hier: Wenn "Gewinner" gewählt ist, verwenden wir eine einheitliche Farbe; ansonsten berechnen wir den Farbverlauf.
    data.features.forEach(function(feature) {
      var fillColor;
      if (currentParty === "Gewinner") {
        // Gewinner-Modus: Ermitteln Sie die höchste Partei und verwenden Sie eine einheitliche Farbe
        var winningParty = null, winningValue = 0;
        currentDataset = {}; // Für dieses Minimalbeispiel ignorieren wir Jahr-spezifische min/max Werte.
        // Annahme: In den Daten gibt es für jede Partei einen Wert als Eigenschaft
        Object.keys(feature.properties).forEach(function(key) {
          // Hier wird angenommen, dass alle Partei-Eigenschaften mit "inkBW" enden
          if (key.endsWith("inkBW")) {
            var val = parseFloat(feature.properties[key].replace(',', '.'));
            if (val > winningValue) {
              winningValue = val;
              winningParty = key;
            }
          }
        });
        fillColor = getPartyColor(winningParty) || getComputedStyle(document.documentElement).getPropertyValue('--winner-fill').trim();
      } else {
        // Für eine spezifische Partei: Verwenden Sie vordefinierte min/max Werte
        // Hier wird als Beispiel angenommen, dass min = 0 und max = 0.5 gelten
        var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
        var norm = Math.min(val / 0.5, 1);
        fillColor = interpolateColor("#f0f0f0", getPartyColor(currentParty), norm);
      }
      feature.properties.fillColor = fillColor;
    });

    // Fügen Sie die Daten als Quelle und Layer zur Karte hinzu
    map.addSource('geojson-layer', { type: 'geojson', data: data });
    map.addLayer({
      id: 'geojson-fill',
      type: 'fill',
      source: 'geojson-layer',
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 1,
        'fill-outline-color': 'transparent'
      }
    });
  })
  .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));

/***********************
 * Farb- und Hilfsfunktionen
 ***********************/
function interpolateColor(color1, color2, factor) {
  var c1 = hexToRgb(color1);
  var c2 = hexToRgb(color2);
  var result = {
    r: Math.round(c1.r + (c2.r - c1.r) * factor),
    g: Math.round(c1.g + (c2.g - c1.g) * factor),
    b: Math.round(c1.b + (c2.b - c1.b) * factor)
  };
  return "rgb(" + result.r + ", " + result.g + ", " + result.b + ")";
}
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  var bigint = parseInt(hex, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function getPartyColor(key) {
  // Legen Sie hier die Zuordnung der Partei-Keys zu Farben fest.
  switch(key) {
    case "SPDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--spd-color').trim();
    case "GrueninkBW": return getComputedStyle(document.documentElement).getPropertyValue('--gruen-color').trim();
    case "CDUinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--cdu-color').trim();
    case "LINKEinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--linke-color').trim();
    case "LinkeinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--linke-color').trim();
    case "AfDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--afd-color').trim();
    case "FDPinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--fdp-color').trim();
    case "BSWinkBWB": return getComputedStyle(document.documentElement).getPropertyValue('--bsw-color').trim();
    case "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--tierschutz-color').trim();
    case "VoltDeutschlandinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--volt-color').trim();
    case "FWinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--fw-color').trim();
    case "MLPDinkBW": return getComputedStyle(document.documentElement).getPropertyValue('--mlpd-color').trim();
    default: return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  }
}
