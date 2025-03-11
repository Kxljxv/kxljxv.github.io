am5.ready(function() {

    // Party Colors - Keep your color definitions here
    const partyColors = {
        "CDU": "#767576",
        "LINKE": "#C72DC1",
        "SPD": "#D63C3C",
        "Gruen": "#028902",
        "AfD": "#4667FA",
        "FDP": "#6b4c00",
        "PMUT": "#005c5c",
        "FW": "#8a5a00",
        "MLPD": "#7a112f",
        "Volt": "#4b2e83",
        "BSW": "#6a0dad"
    };

    const dataKeys = {
        "Wahlbeteiligung": "Wahlbeteiligung",
        "CDU": "CDU",
        "LINKE": "LINKE",
        "SPD": "SPD",
        "Gruen": "Gruen",
        "AfD": "AfD",
        "FDP": "FDP",
        "PMUT": "PMUT",
        "FW": "FW",
        "MLPD": "MLPD",
        "Volt": "Volt",
        "BSW": "BSW"
    };

    let currentYear = "2025";
    let currentDataKey = "Wahlbeteiligung";
    let geojsonData, electionData2021, electionData2025;
    let currentChart;
    let lastClickedFeatureId = null;


    // Function to load data
    async function loadData(year) {
        const geoJsonUrl = `https://kxljxv.github.io/wahlergebnisse/wahlergebnisse${year}nurID.json`;
        const csvUrl = `https://kxljxv.github.io/wahlergebnisse/wahlergebnisse${year}(8).csv`;

        const [geoJsonResp, csvResp] = await Promise.all([
            fetch(geoJsonUrl),
            fetch(csvUrl)
        ]);
        geojsonData = await geoJsonResp.json();

        const csvText = await csvResp.text();
        const csvData = parseCSV(csvText);

        if (year === "2021") {
            electionData2021 = csvData;
        } else {
            electionData2025 = csvData;
        }
        updateMapData();
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split('\t');
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            if (!values[0]) continue; // Skip empty lines
            const entry = {};
            for (let j = 0; j < headers.length; j++) {
                entry[headers[j].trim()] = values[j] ? values[j].trim() : "0"; // Default to "0" if value is empty
            }
            data.push(entry);
        }
        return data;
    }


    function getElectionResultsForDistrict(districtId, year) {
        const data = year === "2021" ? electionData2021 : electionData2025;
        return data.find(item => item.ID === districtId);
    }


    function updateMapData() {
        if (!geojsonData) return;

        geojsonData.features.forEach(feature => {
            const districtId = feature.properties.ID;
            const electionResults = getElectionResultsForDistrict(districtId, currentYear);
            if (electionResults) {
                feature.properties.electionData = electionResults; // Attach all election data
                let dataValue = parseFloat(electionResults[currentDataKey].replace(',', '.'));
                feature.properties.dataValue = isNaN(dataValue) ? 0 : dataValue; // Use selected data value for coloring
            } else {
                feature.properties.electionData = {};
                feature.properties.dataValue = 0;
            }
        });

        if (map.getSource('geojson-layer')) {
            map.getSource('geojson-layer').setData(geojsonData);
        }
        if(lastClickedFeatureId) {
            updateInfoBox(lastClickedFeatureId);
        }
    }


    function updateMapColors() {
        if (!geojsonData || !currentDataKey) return;

        geojsonData.features.forEach(feature => {
            let color = '#f0f0f0'; // Default color
            if (feature.properties.electionData) {
                let dataValue = feature.properties.dataValue;

                if (!isNaN(dataValue)) {
                    // Simple coloring based on value - adjust as needed
                    let normalizedValue = Math.min(1, Math.max(0, dataValue)); // Clamp value between 0 and 1

                    if (currentDataKey !== "Wahlbeteiligung") {
                        const partyName = dataKeys[currentDataKey];
                        if (partyName && partyColors[partyName]) {
                             color = partyColors[partyName];
                         }
                    } else {
                        //Grey scale for Wahlbeteiligung
                        let grayScale = Math.round(255 - (normalizedValue * 255));
                        color = `rgb(${grayScale}, ${grayScale}, ${grayScale})`;
                    }

                }
            }
             feature.properties.fillColor = color;

        });

        if (map.getSource('geojson-layer')) {
            map.getSource('geojson-layer').setData(geojsonData);
        }
    }


    function createDonutChart(districtId) {
        if (currentChart) {
            currentChart.dispose();
        }

        let root = am5.Root.new("chartdiv");
        root.setThemes([
            am5.Theme.new(root),
            am5themes_Animated.Animated.new(root)
        ]);


        let chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout
        }));

        let series = chart.series.push(am5percent.PieSeries.new(root, {
            name: "Series",
            valueField: "value",
            categoryField: "party"
        }));

        series.slices.template.set("tooltipText", "{category}: {valuePercentTotal.formatNumber('#.00')}%");


        series.data.setAll(getChartDataForDistrict(districtId));


        series.appear(1000, 100);
        currentChart = chart;
    }


    function getChartDataForDistrict(districtId) {
        const districtResults = getElectionResultsForDistrict(districtId, currentYear);
        if (!districtResults) return [];

        const chartData = [];
        for (const party in partyColors) {
            const value = parseFloat(districtResults[party].replace(',', '.'));
            if (!isNaN(value) && value > 0) { // Ensure valid and positive values
                chartData.push({ party: party, value: value * 100, color: partyColors[party] });
            }
        }
        return chartData;
    }


    function updateInfoBox(districtId) {
        const infoBox = document.getElementById('infoBox');
        const districtIdDisplay = document.getElementById('districtId');

        if (!districtId) {
            infoBox.classList.add('hidden');
            return;
        }

        infoBox.classList.remove('hidden');
        districtIdDisplay.textContent = `Wahlbezirk ID: ${districtId}`;

        createDonutChart(districtId);
    }


    // --- Map Setup ---
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://kxljxv.github.io/bm_web_gry_7.json', // Your map style URL
        center: [13.40, 52.52], // Berlin coordinates
        zoom: 9,
        attributionControl: false
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();


    map.on('load', () => {
        loadData(currentYear).then(() => {
             map.addSource('geojson-layer', {
                type: 'geojson',
                data: geojsonData
            });

            map.addLayer({
                id: 'geojson-fill',
                type: 'fill',
                source: 'geojson-layer',
                paint: {
                    'fill-color': ['get', 'fillColor'],
                    'fill-opacity': 0.8,
                    'fill-outline-color': '#888'
                }
            });
            updateMapColors();
        });
    });


    map.on('click', 'geojson-fill', (e) => {
        if (!e.features.length) return;
        const feature = e.features[0];
        const districtId = feature.properties.ID;
        lastClickedFeatureId = districtId;
        updateInfoBox(districtId);

    });

    map.on('mouseenter', 'geojson-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'geojson-fill', () => {
        map.getCanvas().style.cursor = '';
    });


    // --- Event Listeners for Select Boxes ---
    document.getElementById('dataSelect').addEventListener('change', (e) => {
        currentDataKey = e.target.value;
        updateMapData();
        updateMapColors();
    });

    document.getElementById('yearSelect').addEventListener('change', (e) => {
        currentYear = e.target.value;
        loadData(currentYear).then(() => {
            updateMapColors();
        });
    });

     // Initially hide infoBox
     updateInfoBox(null);

}); // end am5.ready()
