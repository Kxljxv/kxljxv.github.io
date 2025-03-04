// Hilfsfunktion: URL-Parameter auslesen
function getURLParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// Lese Parameter: Partei, Jahr, Mode (dark/light) – weitere Parameter können ergänzt werden
const partyParam = getURLParam('partei') || "Gewinner";
const yearParam = getURLParam('jahr') || "2025";
const modeParam = getURLParam('mode') || "dark";

// Für dieses Embed verwenden wir einen offenen Standard-Stil (demotiles) – passen Sie nach Bedarf an.
const styleURL = "https://demotiles.maplibre.org/style.json";

// Wenn im URL-Parameter mode=dark, fügen wir eine CSS-Klasse hinzu, die den Stil etwas abdunkelt (aber nicht rein schwarz darstellt)
if (modeParam === "dark") {
  document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('map').classList.add('dark-mode');
  });
}

// Initialisiere die Karte
var map = new maplibregl.Map({
  container: 'map',
  style: styleURL,
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  // Erweitern Sie die Bounds, damit der Nutzer sich nicht ungewollt außerhalb Berlins bewegen kann
  maxBounds: [[12.5, 51.5], [14.5, 53]],
  attributionControl: false
});

// Deaktivieren Sie Rotation, Neigung und andere unerwünschte Kamerabewegungen
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
map.setPitch(0);
map.setBearing(0);

// Optionale: Falls weitere UI-Controls (z. B. Zoom-Buttons) standardmäßig erscheinen, entfernen wir diese.
map.addControl(new maplibregl.NavigationControl({
  showCompass: false,
  showZoom: false
}));

// Laden der GeoJSON-Daten (hier können Sie ggf. anhand von "jahr" und "partei" weitere Anpassungen vornehmen)
const dataURL = (yearParam === "2025")
  ? 'https://kxljxv.github.io/wahlergebnisse2025.json'
  : 'https://kxljxv.github.io/wahlergebnisse2021.json';

fetch(dataURL)
  .then(response => response.json())
  .then(data => {
    // Hier können Sie noch Logik einbauen, um z.B. den "partei"-Parameter zu verarbeiten.
    // In diesem Minimalbeispiel gehen wir davon aus, dass die GeoJSON-Daten bereits die erforderlichen Eigenschaften besitzen.
    map.addSource('geojson-layer', { type: 'geojson', data: data });
    map.addLayer({
      id: 'geojson-fill',
      type: 'fill',
      source: 'geojson-layer',
      paint: {
        // Nehmen Sie an, dass in den Daten eine Eigenschaft "fillColor" hinterlegt ist.
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': 1,
        'fill-outline-color': 'transparent'
      }
    });
  })
  .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
