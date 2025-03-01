// Daten-URLs für beide Wahljahre
const datasets = {
  "2025": "https://kxljxv.github.io/wahlergebnisse2025.json",
  "2021": "https://kxljxv.github.io/wahlergebnisse2021.json"
};

// Kompakte Definition der Parteien – Name, Farbverlauf und min/max je Jahr
const parties = {
  "WahlbeteiligunginkBW": { name: "Wahlbeteiligung", gradient: { min: "#FFF7F5", max: "#002617" },
    ranges: { "2025": {min: 0.454105275, max: 0.98}, "2021": {min: 0.454105275, max: 0.98} } },
  "SPDinkBW": { name: "SPD", gradient: { min: "#FFF7F5", max: "#570000" },
    ranges: { "2025": {min: 0.06, max: 0.39984263}, "2021": {min: 0.06, max: 0.39984263} } },
  "GrueninkBW": { name: "Grüne", gradient: { min: "#FFF7F5", max: "#004F00" },
    ranges: { "2025": {min: 0.015, max: 0.541414141}, "2021": {min: 0.015, max: 0.541414141} } },
  "CDUinkBW": { name: "CDU", gradient: { min: "#FFF7F5", max: "#09090A" },
    ranges: { "2025": {min: 0.025714286, max: 0.46}, "2021": {min: 0.025714286, max: 0.46} } },
  "LINKEinkBW": { name: "Die Linke", gradient: { min: "#FFF7F5", max: "#8F0354" },
    ranges: { "2025": {min: 0.011583012, max: 0.5}, "2021": null } },
  "LinkeinkBW": { name: "Die Linke", gradient: { min: "#FFF7F5", max: "#8F0354" },
    ranges: { "2025": null, "2021": {min: 0.011583012, max: 0.5} } },
  "AfDinkBW": { name: "AfD", gradient: { min: "#FFF7F5", max: "#002B9C" },
    ranges: { "2025": {min: 0.005931198, max: 0.5}, "2021": {min: 0.005931198, max: 0.5} } },
  "FDPinkBW": { name: "FDP", gradient: { min: "#FFF7F5", max: "#5E4A00" },
    ranges: { "2025": {min: 0.004, max: 0.268841395}, "2021": {min: 0.004, max: 0.268841395} } },
  "BSWinkBWB": { name: "BSW", gradient: { min: "#FFF7F5", max: "#571334" },
    ranges: { "2025": {min: 0.012, max: 0.16}, "2021": null } },
  "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { name: "Tierschutzpartei", gradient: { min: "#FFF7F5", max: "#00454D" },
    ranges: { "2025": {min: 0.0, max: 0.085704944}, "2021": {min: 0.0, max: 0.085704944} } },
  "VoltDeutschlandinkBW": { name: "Volt", gradient: { min: "#FFF7F5", max: "#462270" },
    ranges: { "2025": {min: 0.0, max: 0.029}, "2021": null } },
  "VoltinkBW": { name: "Volt", gradient: { min: "#FFF7F5", max: "#462270" },
    ranges: { "2025": null, "2021": {min: 0.0, max: 0.029} } },
  "FWinkBW": { name: "FW", gradient: { min: "#FFF7F5", max: "#9C4900" },
    ranges: { "2025": {min: 0.0, max: 0.034937014}, "2021": {min: 0.0, max: 0.034937014} } },
  "MLPDinkBW": { name: "MLPD", gradient: { min: "#FFF7F5", max: "#8C142A" },
    ranges: { "2025": {min: 0.0, max: 0.012658228}, "2021": {min: 0.0, max: 0.012658228} } }
};

let currentYear = "2025";
let currentParty = "WahlbeteiligunginkBW";
let vectorLayer;

// Hilfsfunktionen zur Farbinterpolation
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if(hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
function interpolateColors(c1, c2, t) {
  const rgb1 = hexToRgb(c1), rgb2 = hexToRgb(c2);
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
  return rgbToHex(r, g, b);
}

// Style-Funktion für die GeoJSON-Features
function styleFunction(feature) {
  const props = feature.getProperties();
  let value = parseFloat(String(props[currentParty]).replace(',', '.'));
  const range = parties[currentParty].ranges[currentYear];
  if(!range) return new ol.style.Style({ fill: new ol.style.Fill({ color: "#CCCCCC" }), stroke: new ol.style.Stroke({ color: "transparent" }) });
  let t = (value - range.min) / (range.max - range.min);
  t = Math.max(0, Math.min(1, t));
  const color = interpolateColors(parties[currentParty].gradient.min, parties[currentParty].gradient.max, t);
  return new ol.style.Style({ fill: new ol.style.Fill({ color: color }), stroke: new ol.style.Stroke({ color: "transparent" }) });
}

// OpenLayers-Karte initialisieren (Zentrum Berlin, Begrenzung auf Berlin)
const map = new ol.Map({
  target: 'map',
  layers: [],
  view: new ol.View({
    center: ol.proj.fromLonLat([13.40, 52.52]),
    zoom: 10,
    minZoom: 9,
    extent: ol.proj.transformExtent([13.0, 52.3, 13.8, 52.7], 'EPSG:4326', 'EPSG:3857')
  })
});

// Basemap-Layer aus Style-JSON (wird mit ol-mapbox-style überlagert)
olms.apply(map, 'https://kxljxv.github.io/style.json');

// GeoJSON laden und als Vektor-Layer hinzufügen
function loadGeoJson() {
  fetch(datasets[currentYear])
    .then(res => res.json())
    .then(data => {
      if(vectorLayer) map.removeLayer(vectorLayer);
      const vectorSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(data, { featureProjection: 'EPSG:3857' })
      });
      vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: styleFunction
      });
      // Als unterste Ebene einfügen, damit der Basemap-Layer darüber liegt
      map.getLayers().insertAt(0, vectorLayer);
    })
    .catch(err => console.error(err));
}

// Partei-Dropdown basierend auf verfügbaren Parteien (gültige Range für das Jahr)
function populatePartySelect() {
  const select = document.getElementById("partySelect");
  select.innerHTML = "";
  Object.keys(parties).forEach(key => {
    if (parties[key].ranges[currentYear]) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = parties[key].name;
      select.appendChild(opt);
    }
  });
  if (!parties[currentParty].ranges[currentYear])
    currentParty = select.options[0].value;
  select.value = currentParty;
}

// UI-Events
document.getElementById("datasetSelect").addEventListener("change", function() {
  currentYear = this.value;
  populatePartySelect();
  loadGeoJson();
});
document.getElementById("partySelect").addEventListener("change", function() {
  currentParty = this.value;
  if (vectorLayer) vectorLayer.setStyle(styleFunction);
});

// Popup-Overlay für Feature-Infos
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');
const overlay = new ol.Overlay({
  element: container,
  autoPan: true,
  autoPanAnimation: { duration: 250 }
});
map.addOverlay(overlay);
closer.onclick = () => { overlay.setPosition(undefined); closer.blur(); return false; };

// Bei Klick auf ein Feature wird ein Popup angezeigt
map.on('singleclick', function(evt) {
  overlay.setPosition(undefined);
  map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    const props = feature.getProperties();
    let value = parseFloat(String(props[currentParty]).replace(',', '.'));
    const percent = ((value * 100).toFixed(2)) + '%';
    content.innerHTML = '<b>' + props.UWB + '</b><br>' +
      'Wahlbeteiligung: ' + (parseFloat(String(props.WahlbeteiligunginkBW).replace(',', '.')) * 100).toFixed(2) + '%<br>' +
      'Ergebnis: ' + percent + ' (' + parties[currentParty].name + ')';
    overlay.setPosition(evt.coordinate);
    return true;
  });
});

// Initiale Aufrufe
populatePartySelect();
loadGeoJson();
