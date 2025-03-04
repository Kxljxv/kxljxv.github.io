// Funktion zum Auslesen von URL-Parametern
function getURLParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// Lese URL-Parameter (z. B. "partei", "jahr", "mode")
// Diese Parameter können intern genutzt werden – sie beeinflussen hier die Kartenkonfiguration,
// ändern aber nicht die sichtbare UI, da diese hier komplett entfernt ist.
const partyParam = getURLParam('partei') || 'Gewinner';
const yearParam = getURLParam('jahr') || '2025';
const modeParam = getURLParam('mode') || 'dark';

// Für diesen Embed nutzen wir einen bekannten Demo-Stil von Maplibre, der nicht komplett schwarz ist.
const darkStyle = "https://demotiles.maplibre.org/style.json";
const lightStyle = "https://demotiles.maplibre.org/style.json"; // Sie können hier einen anderen Lightmode-Stil angeben
const styleURL = (modeParam === "light") ? lightStyle : darkStyle;

// Initialisiere die Karte
var map = new maplibregl.Map({
  container: 'map',
  style: styleURL,
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]], // Grenzen, die sicherstellen, dass man sich innerhalb Berlins bewegt
  attributionControl: false
});

// Deaktiviere Kamera-Rotation und Neigung
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Falls weitere UI-Controls standardmäßig hinzugefügt werden, entfernen wir diese:
var navControl = new maplibregl.NavigationControl({
  showCompass: false,
  showZoom: false
});
map.addControl(navControl, 'top-right');

// Optional: Hier könnten Sie noch den Einfluss der URL-Parameter (partyParam, yearParam)
// auf die interne Datenverarbeitung implementieren – in diesem Minimalbeispiel wird nur der Kartenstil angezeigt.
