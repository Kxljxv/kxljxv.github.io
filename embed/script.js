// Funktion zum Abrufen von URL-Parametern
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Standardwerte für die Karte setzen
let selectedParty = getQueryParam('partei') || 'SPD';
let selectedYear = getQueryParam('jahr') || '2025';
let mode = getQueryParam('mode') || 'dark';

// Darkmode oder Whitemode setzen
document.body.classList.add(mode === 'dark' ? 'darkmode' : 'whitemode');

// Initialisiere die Karte ohne Bedienelemente
var map = new maplibregl.Map({
    container: 'map',
    style: mode === 'dark'
        ? 'https://kxljxv.github.io/bm_web_gry_7.json'
        : 'https://kxljxv.github.io/bm_web_light.json',
    center: [13.40, 52.52],
    zoom: 10,
    minZoom: 6,
    maxBounds: [[12.5, 51.5], [14.5, 53]]
});

// Bedienelemente deaktivieren
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
map.scrollZoom.disable();
map.boxZoom.disable();
map.doubleClickZoom.disable();
map.keyboard.disable();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

// GeoJSON laden
function loadGeoJson() {
    let datasetUrl = selectedYear === '2025'
        ? 'https://kxljxv.github.io/wahlergebnisse2025.json'
        : 'https://kxljxv.github.io/wahlergebnisse2021.json';
    
    fetch(datasetUrl)
        .then(response => response.json())
        .then(data => {
            map.addSource('geojson-layer', {
                type: 'geojson',
                data: data
            });
            map.addLayer({
                id: 'geojson-fill',
                type: 'fill',
                source: 'geojson-layer',
                paint: {
                    'fill-color': ['get', selectedParty],
                    'fill-opacity': 1
                }
            });
        })
        .catch(error => console.error('Fehler beim Laden der GeoJSON-Daten:', error));
}

// Lade GeoJSON-Daten
map.on('load', loadGeoJson);
