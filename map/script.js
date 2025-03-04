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
    "Volt": { min: 0.0, max: 0.029 },
    "FWinkBW": { min: 0.0, max: 0.034937014 },
    "MLPDinkBW": { min: 0.0, max: 0.012658228 }
  },
  availableParties: [
    "SPDinkBW", "GrueninkBW", "CDUinkBW", "LINKEinkBW",
    "AfDinkBW", "FDPinkBW", "BSWinkBWB", "PARTEIMENSCHUMWELTTIERSCHUTZinkBW",
    "Volt", "FWinkBW", "MLPDinkBW"
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

// Alias: In dataset2021 soll "VoltinkBW" als "Volt" behandelt werden
function normalizePartyKey(key) {
  if(key === "VoltinkBW") return "Volt";
  return key;
}

var currentDataset = dataset2025;
var currentParty = "Gewinner"; // Standard: Gewinner-Modus
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
 * Jahresauswahl: Buttongroup unter der Karte
 ***********************/
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    var selectedYear = this.getAttribute('data-year');
    // Beim Wechsel: Wenn Volt als Partei gewählt war, prüfen wir den Alias
    if(currentParty !== "Gewinner") {
      var normKey = normalizePartyKey(currentParty);
      // Wenn der ausgewählte Key in dem neuen Dataset nicht existiert, setzen wir auf Gewinner
      var available = (selectedYear === "2025") ? dataset2025.availableParties : dataset2021.availableParties;
      if(!available.includes(normKey)) {
        currentParty = "Gewinner";
      }
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
        var normalizedKey = normalizePartyKey(key);
        var val = parseFloat(feature.properties[key].replace(',', '.'));
        if (val > winningValue) {
          winningValue = val;
          winningParty = normalizedKey;
        }
      });
      // Gewinner-Modus: Einheitliche Farbe (Platzhalterfarbe)
      fillColor = getExtraColor(winningParty, "winner");
    } else {
      var val = parseFloat(feature.properties[currentParty].replace(',', '.'));
      var range = currentDataset.partyRanges[currentParty];
      var norm = (val - range.min) / (range.max - range.min);
      norm = Math.max(0, Math.min(norm, 1));
      fillColor = interpolateColor("#f0f0f0", getExtraColor(currentParty, "regular"), norm);
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
 * Extra Farben pro Partei – Platzhalterwerte
 * Format: getExtraColor(partyKey, mode) mode: "regular", "winner", "selection", "chart"
 ***********************/
function getExtraColor(key, mode) {
  // Platzhalter: Ersetzen Sie diese Werte durch Ihre gewünschten Farben
  var colors = {
    "SPDinkBW": { regular: "#8a0000", winner: "#aa0000", selection: "#b30000", chart: "#cc0000" },
    "GrueninkBW": { regular: "#007f00", winner: "#009900", selection: "#00b300", chart: "#00cc00" },
    "CDUinkBW": { regular: "#222222", winner: "#333333", selection: "#444444", chart: "#555555" },
    "LINKEinkBW": { regular: "#a02080", winner: "#b03090", selection: "#c040a0", chart: "#d050b0" },
    "AfDinkBW": { regular: "#001f3f", winner: "#002f4f", selection: "#003f5f", chart: "#004f6f" },
    "FDPinkBW": { regular: "#805500", winner: "#996600", selection: "#b37700", chart: "#cc8800" },
    "BSWinkBWB": { regular: "#5a0099", winner: "#6a00aa", selection: "#7a00bb", chart: "#8a00cc" },
    "PARTEIMENSCHUMWELTTIERSCHUTZinkBW": { regular: "#005757", winner: "#006868", selection: "#007979", chart: "#008a8a" },
    "Volt": { regular: "#4b2e83", winner: "#5b3e93", selection: "#6b4ea3", chart: "#7b5eb3" },
    "FWinkBW": { regular: "#8a5a00", winner: "#9a6a10", selection: "#aa7a20", chart: "#bb8a30" },
    "MLPDinkBW": { regular: "#7a112f", winner: "#8a223f", selection: "#9a334f", chart: "#aa445f" }
  };
  // Falls der Schlüssel in dataset2021 als "VoltinkBW" kommt, normalisieren:
  key = normalizePartyKey(key);
  if(colors[key] && colors[key][mode]) return colors[key][mode];
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
}

/***********************
 * Chart.js – Interaktives Column Chart
 ***********************/
var lastClickedFeature = null;
var ctx = document.getElementById('resultChart').getContext('2d');
var resultChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: [],  // Dynamisch befüllt
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
  // Falls in der Eigenschaft "Wahlbezirk" ein Code vorhanden ist, verwenden wir ihn
  var bezirk = feature.properties.UWB || "Unbekannt";
  document.getElementById('resultTitle').innerText = "Ergebnisse - " + bezirk;
  
  var labels = [];
  var dataValues = [];
  var backgroundColors = [];
  currentDataset.availableParties.forEach(function(key) {
    var val = parseFloat(feature.properties[key].replace(',', '.'));
    labels.push(partyDisplayNames[key] || key);
    dataValues.push((val * 100).toFixed(2));
    backgroundColors.push(getExtraColor(key, "chart"));
  });
  resultChart.data.labels = labels;
  resultChart.data.datasets[0].data = dataValues;
  resultChart.data.datasets[0].backgroundColor = backgroundColors;
  var maxVal = Math.max(...dataValues.map(Number));
  resultChart.options.scales.y.max = Math.ceil(maxVal / 10) * 10 || 100;
  resultChart.update();
}

/***********************
 * Interaktive Karte: Marker und Klick-Event
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
map.on('mouseenter', 'geojson-fill', function() { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'geojson-fill', function() { map.getCanvas().style.cursor = ''; });

/***********************
 * Suchfeld-Funktionalität: Suche nach Bezirken und Adressen
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
  "Volt": "Volt",
  "VoltinkBW": "Volt",
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
    lbl.style.backgroundColor = hexToRGBA(getExtraColor(key, "selection"), 0.15);
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
