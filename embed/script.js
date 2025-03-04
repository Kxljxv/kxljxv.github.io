// Hilfsfunktion zum Auslesen von URL-Parametern
function getURLParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// Lese Parameter aus der URL
const partyParam = getURLParam('partei') || "Gewinner";
const yearParam = getURLParam('jahr') || "2025";
const modeParam = getURLParam('mode') || "dark";
// controlsParam wird hier ignoriert, da keine UI-Elemente angezeigt werden sollen

// Definieren Sie die Kartendesigns (beispielsweise Darkmode vs. Lightmode)
// Für dieses Beispiel verwenden wir den Darkmode-Stil; passen Sie den Lightmode-Stil nach Bedarf an.
const darkStyle = 'https://kxljxv.github.io/bm_web_gry_7.json'; 
const lightStyle = 'https://your-light-style-url.example.com/style.json'; // Ersetzen, falls Lightmode benötigt wird
const mapStyle = (modeParam === "light") ? lightStyle : darkStyle;

// Initialisiere die Maplibre-Karte
var map = new maplibregl.Map({
  container: 'map',
  style: mapStyle,
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]], // Erweiterte Begrenzungen, damit sich der User nicht zu weit bewegt
  attributionControl: false
});

// Entferne alle UI-Controls (Zoom, Kompass etc.)
map.addControl(new maplibregl.NavigationControl({
  showCompass: false,
  showZoom: false
}));

// Optional: Wenn Ihre GeoJSON-Daten unterschiedliche Styles je nach Jahr oder Partei benötigen,
// können Sie hier die URL basierend auf dem 'jahr'-Parameter auswählen.
var dataURL = (yearParam === "2025") ?
  'https://kxljxv.github.io/wahlergebnisse2025.json' :
  'https://kxljxv.github.io/wahlergebnisse2021.json';

// Laden der GeoJSON-Daten
fetch(dataURL)
  .then(response => response.json())
  .then(data => {
    // Hier können Sie bei Bedarf noch die Daten bearbeiten – z.B. anhand des partyParam.
    // In diesem Minimalbeispiel wird davon ausgegangen, dass die GeoJSON-Daten bereits die benötigten
    // Eigenschaften (wie 'fillColor') enthalten.
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
