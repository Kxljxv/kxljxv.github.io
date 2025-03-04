/***********************
 * Konfiguration und Datensätze
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

var currentDataset = dataset2025;
var currentParty = "Gewinner"; // Standardmäßig Gewinner-Modus
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
  maxBounds: [[12.5, 51.5], [14.5, 53]]
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

/***********************
 * Jahresauswahl (Buttongroup unter der Karte)
 ***********************/
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    var selectedYear = this.getAttribute('data-year');
    // Erhalte aktuelle Partei, falls vorhanden, sonst beibehalten
    if (currentDataset.availableParties.indexOf(currentParty) === -1) {
      currentParty = "Gewinner";
    }
    currentDataset = (selectedYear === "2025") ? dataset2025 : dataset2021;
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
      fillColor = getPartyColor(winningParty, "winner");
    } else {
      var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
      var range = currentDataset.partyRanges[currentParty];
      var norm = (val - range.min) / (range.max - range.min);
      norm = Math.max(0, Math.min(norm, 1));
      fillColor = interpolateColor("#f0f0f0", getPartyColor(currentParty, "regular"), norm);
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

/***********************
 * Farbkonfiguration für Parteien (Platzhalterfarben)
 * type: "regular", "winner", "button", "chart"
 ***********************/
function getPartyColor(key, type) {
  // Platzhalterwerte – ersetzen Sie diese mit Ihren Wunschfarben
  var colors = {
    "SPDinkBW": { regular: "#680000", winner: "#ff0000", button: "#7a0000", chart: "#a30000" },
    "GrueninkBW": { regular: "#006400", winner: "#00cc00", button: "#008000", chart: "#009900" },
    "CDUinkBW": { regular: "#1a1a1a", winner: "#4d4d4d", button: "#333333", chart: "#666666" },
    "LINKEinkBW": { regular: "#9f1d64", winner: "#ff66cc", button: "#c2185b", chart: "#e91e63" },
    "AfDinkBW": { regular: "#003399", winner: "#3366ff", button: "#002266", chart: "#0044cc" },
    "FDPinkBW": { regular: "#6b4c00", winner: "#b38f00", button: "#8c6600", chart: "#a17c00" },
    "BSWinkBWB": { regular: "#5a2d82", winner: "#8a4fcf", button: "#6e3ab5", chart: "#7f4dbd" },
    "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { regular: "#005c5c", winner: "#00cccc", button: "#006666", chart: "#007a7a" },
    "VoltDeutschlandinkBW": { regular: "#4b2e83", winner: "#7f57b3", button: "#56307a", chart: "#6c4490" },
    "FWinkBW": { regular: "#8a5a00", winner: "#e6b800", button: "#a27c00", chart: "#bf9000" },
    "MLPDinkBW": { regular: "#7a112f", winner: "#d6294f", button: "#931442", chart: "#b2233c" }
  };
  var party = colors[key] || { regular: "#a3512b", winner: "#a3512b", button: "#a3512b", chart: "#a3512b" };
  return party[type] || party.regular;
}

/***********************
 * Chart.js – Interaktives Column Chart
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
    backgroundColors.push(getPartyColor(key, "chart"));
  });
  resultChart.data.labels = labels;
  resultChart.data.datasets[0].data = dataValues;
  resultChart.data.datasets[0].backgroundColor = backgroundColors;
  var maxVal = Math.max(...dataValues.map(Number));
  resultChart.options.scales.y.max = Math.ceil(maxVal / 10) * 10 || 100;
  resultChart.update();
  // Aktualisiere den Header im Ergebnisbereich mit dem Wahlbezirk (z.B. UWB)
  var wb = feature.properties.UWB || "Unbekannt";
  document.getElementById('resultHeader').innerText = "Ergebnisse - " + wb;
}

/***********************
 * Interaktive Karte: Klick-Event, Marker und Chart
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
 * Parteiauswahl als farbige Radio-Button-Gruppe (unter der Karte)
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
    lbl.style.backgroundColor = hexToRGBA(getPartyColor(key, "button"), 0.15);
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
  // Erhalte den aktuell ausgewählten Radiobutton und setze den Hightlight
  updateMapColors();
  if (!lastClickedFeature) {
    resultChart.data.labels = [];
    resultChart.data.datasets[0].data = [];
    resultChart.update();
  }
});
