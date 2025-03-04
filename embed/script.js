// Hilfsfunktion: URL-Parameter auslesen
function getURLParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// Lese Parameter: Partei, Jahr, Modus, und ob Steuerelemente angezeigt werden sollen
// Bei diesem Embed möchten wir keine zusätzlichen UI-Elemente (wie Zoom-Buttons) anzeigen.
const partyParam = getURLParam('partei') || "Gewinner";
const yearParam = getURLParam('jahr') || "2025";
const modeParam = getURLParam('mode') || "dark";
// In diesem Embed werden Steuerelemente standardmäßig nicht angezeigt.
const controlsParam = getURLParam('controls') || "false";

// Optional: Modus (Dark / Light) steuern – wir wählen dazu unterschiedliche Kartenstile
const darkStyle = 'https://kxljxv.github.io/bm_web_gry_7.json';  // Beispiel Darkmode-Stil
const lightStyle = 'https://your-light-style-url.example.com/style.json'; // Passen Sie an

// Setze Standardwerte für die internen Variablen
var currentParty = partyParam;
var currentDataset = (yearParam === "2025") ? {
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
} : {
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

var geojsonData = null;

/***********************
 * Karte initialisieren
 ***********************/
var map = new maplibregl.Map({
  container: 'map',
  style: (modeParam === "light") ? lightStyle : darkStyle,
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});

// Entferne alle UI-Controls (Zoom, Navigation, etc.)
map.addControl(new maplibregl.NavigationControl({
  showZoom: false,
  showCompass: false
}), 'top-right'); // Falls nötig, können Sie diese Zeile weglassen

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
 * Farben der Karte aktualisieren
 ***********************/
function updateMapColors() {
  if (!geojsonData) return;
  geojsonData.features.forEach(function(feature) {
    var fillColor;
    if (currentParty === "Gewinner") {
      // Gewinner-Modus: Ermittle die höchste Partei und verwende eine einheitliche Farbe
      var winningParty = null, winningValue = 0;
      currentDataset.availableParties.forEach(function(key) {
        var val = parseFloat(feature.properties[key].replace(',', '.'));
        if (val > winningValue) {
          winningValue = val;
          winningParty = key;
        }
      });
      fillColor = getPartyColor(winningParty) || getComputedStyle(document.documentElement).getPropertyValue('--winner-fill').trim();
    } else {
      var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
      var range = currentDataset.partyRanges[currentParty];
      var norm = (val - range.min) / (range.max - range.min);
      norm = Math.max(0, Math.min(norm, 1));
      fillColor = interpolateColor("#f0f0f0", getPartyColor(currentParty), norm);
    }
    feature.properties.fillColor = fillColor;
  });
  if (map.getSource('geojson-layer')) {
    map.getSource('geojson-layer').setData(geojsonData);
  }
}

/***********************
 * Hilfsfunktionen für Farben
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

/***********************
 * Hinweis: Da diese Einbettung ausschließlich die Karte anzeigen soll,
 * sind keine UI-Elemente (wie Suchfelder, Charts, etc.) sichtbar.
 ***********************/

/***********************
 * Damit externe Websites die Karte einbetten können, verarbeiten wir URL-Parameter,
 * die z. B. die anzuzeigende Partei, das Jahr, den Darstellungsmodus und ob Steuerelemente angezeigt werden sollen,
 * festlegen. Diese Parameter beeinflussen ausschließlich die interne Konfiguration, nicht aber die sichtbare UI.
 ***********************/
  
// Optional: Sie können hier weitere Konfigurationen vornehmen, z.B. zusätzliche Filter für GeoJSON-Daten,
// falls die URL-Parameter dafür genutzt werden sollen.

</script>
