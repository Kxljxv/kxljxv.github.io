/***********************
 * URL-Parameter verarbeiten
 ***********************/
const urlParams = new URLSearchParams(window.location.search);
const partyParam = urlParams.get('partei') || "Gewinner";
const yearParam = urlParams.get('jahr') || "2025";
const modeParam = urlParams.get('mode') || "dark";  // "dark" oder "light"
const controlsParam = urlParams.get('controls') || "true"; // "true" oder "false"

// Setze Darstellungsmodus: Füge Klasse an <body> hinzu
if (modeParam === "light") {
  document.body.classList.add("light-mode");
} else {
  document.body.classList.add("dark-mode");
}

// Falls Steuerelemente deaktiviert werden sollen, verstecke ggf. Elemente (hier: Jahr-Auswahl, Zoom-/Sonstiges)
if (controlsParam === "false") {
  // Beispielsweise: Jahrsauswahl in der Karte ausblenden
  document.getElementById('mapYearControl').style.display = "none";
}

/***********************
 * Datensätze
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

currentDataset = (yearParam === "2025") ? dataset2025 : dataset2021;
currentParty = partyParam;

/***********************
 * Karte initialisieren
 ***********************/
var map = new maplibregl.Map({
  container: 'map',
  style: 'https://kxljxv.github.io/bm_web_gry_7.json',
  center: [13.40, 52.52],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[12.5, 51.5], [14.5, 53]]
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Optional: Steuerelemente nur anzeigen, wenn controlsParam true ist
if (controlsParam === "false") {
  // Hier könnten Sie beispielsweise den Standard-Zoomcontrol ausblenden
  // (Wenn Sie Ihre eigenen Steuerelemente verwenden, können Sie diese nicht hinzufügen)
}

/***********************
 * Jahresauswahl in der Karte: Buttongroup
 ***********************/
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    var selectedYear = this.getAttribute('data-year');
    currentDataset = (selectedYear === "2025") ? dataset2025 : dataset2021;
    populatePartyRadioGroup();
    loadGeoJson();
  });
});
// Setze per URL-Parameter den Jahr-Button
document.querySelectorAll('.year-btn').forEach(btn => {
  if (btn.getAttribute('data-year') === yearParam) {
    btn.classList.add('active');
  }
});

/***********************
 * GeoJSON laden
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
  if (lastClickedFeature) updateResultChart(lastClickedFeature);
}

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
 * Chart.js – Interaktives Column Chart (Flowbite-inspiriert)
 ***********************/
var lastClickedFeature = null;
var ctx = document.getElementById('resultChart').getContext('2d');
var resultChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: [], 
    datasets: [{
      label: 'Ergebnis (%)',
      data: [],
      backgroundColor: [],
      borderWidth: 0
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary-text').trim() },
        grid: { color: 'rgba(255,255,255,0.1)' }
      },
      y: {
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--primary-text').trim() },
        grid: { color: 'rgba(255,255,255,0.1)' },
        beginAtZero: true,
        max: 100
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return context.parsed.y + "%";
          }
        }
      }
    }
  }
});

function updateResultChart(feature) {
  lastClickedFeature = feature;
  var labels = [];
  var dataValues = [];
  var backgroundColors = [];
  currentDataset.availableParties.forEach(function(key) {
    var val = parseFloat(feature.properties[key].replace(',', '.'));
    labels.push(partyDisplayNames[key] || key);
    dataValues.push((val * 100).toFixed(2));
    backgroundColors.push(getPartyColor(key));
  });
  resultChart.data.labels = labels;
  resultChart.data.datasets[0].data = dataValues;
  resultChart.data.datasets[0].backgroundColor = backgroundColors;
  var maxVal = Math.max(...dataValues.map(Number));
  resultChart.options.scales.y.max = Math.ceil(maxVal / 10) * 10 || 100;
  resultChart.update();
}

/***********************
 * Interaktive Karte: Klick-Event, Marker, Chart aktualisieren
 ***********************/
var marker;
map.on('click', 'geojson-fill', function(e) {
  if (!e.features.length) return;
  var feature = e.features[0];
  updateResultChart(feature);
  if (marker) marker.remove();
  marker = new maplibregl.Marker({ color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() })
    .setLngLat(e.lngLat)
    .addTo(map);
});
map.on('mouseenter', 'geojson-fill', function() {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'geojson-fill', function() {
  map.getCanvas().style.cursor = '';
});

/***********************
 * Suchfeld: Filterung nach Bezirk und Adresse (nur innerhalb Berlins)
 ***********************/
document.getElementById('searchField').addEventListener('input', function(e) {
  var query = e.target.value.toLowerCase();
  if (query.includes("alexanderplatz")) {
    map.flyTo({ center: [13.411, 52.521], zoom: 13 });
  } else if (query.includes("potsdamer platz")) {
    map.flyTo({ center: [13.376, 52.509], zoom: 13 });
  } else {
    if (!geojsonData) return;
    var filtered = JSON.parse(JSON.stringify(geojsonData));
    filtered.features = filtered.features.filter(function(feature) {
      return feature.properties.UWB.toLowerCase().includes(query) ||
             (feature.properties.adresse && feature.properties.adresse.toLowerCase().includes(query));
    });
    if (map.getSource('geojson-layer')) {
      map.getSource('geojson-layer').setData(filtered);
    }
  }
});

/***********************
 * Parteiauswahl: Radio-Button-Gruppe (farblich codiert)
 ***********************/
var partyDisplayNames = {
  "SPDinkBW": "SPD",
  "GrueninkBW": "Grüne",
  "CDUinkBW": "CDU",
  "LINKEinkBW": "Die Linke",
  "LinkeinkBW": "Die Linke",
  "AfDinkBW": "AfD",
  "FDPinkBW": "FDP",
  "BSWinkBWB": "BSW",
  "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": "Tierschutz",
  "VoltDeutschlandinkBW": "Volt",
  "FWinkBW": "FW",
  "MLPDinkBW": "MLPD"
};

function populatePartyRadioGroup() {
  var container = document.getElementById('partyRadioGroup');
  container.innerHTML = "";
  // Option "Gewinner" als erste Option
  var label = document.createElement('label');
  label.innerHTML = `<input type="radio" name="party" value="Gewinner" checked> <span>Gewinner</span>`;
  container.appendChild(label);
  // Für jede Partei:
  currentDataset.availableParties.forEach(function(key) {
    var lbl = document.createElement('label');
    lbl.style.backgroundColor = hexToRGBA(getPartyColor(key), 0.15);
    lbl.innerHTML = `<input type="radio" name="party" value="${key}"> <span>${partyDisplayNames[key] || key}</span>`;
    container.appendChild(lbl);
  });
}
function hexToRGBA(hex, alpha) {
  var r = parseInt(hex.substring(1, 3), 16),
      g = parseInt(hex.substring(3, 5), 16),
      b = parseInt(hex.substring(5, 7), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}
populatePartyRadioGroup();
document.getElementById('partyRadioGroup').addEventListener('change', function(e) {
  currentParty = e.target.value;
  updateMapColors();
  if (!lastClickedFeature) {
    resultChart.data.labels = [];
    resultChart.data.datasets[0].data = [];
    resultChart.update();
  }
});
