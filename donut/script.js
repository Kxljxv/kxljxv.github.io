// script.js
am5.ready(function() {

    // Get query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const year = urlParams.get('year');

    // CSV file URLs and party lists
    const csvUrl2021 = 'http://kxljxv.github.io/wahlergebnisse/wahlergebnisse2021(8).csv';
    const csvUrl2025 = 'http://kxljxv.github.io/wahlergebnisse/wahlergebnisse2025(8).csv';
    let csvUrl = csvUrl2025; // Default to 2025
    if (year === '2021') {
        csvUrl = csvUrl2021;
    } else if (year !== '2025' && year) {
        alert('Invalid year parameter. Using 2025 data.'); // Optional: User feedback for invalid year
    }

    const parties2021 = ["SPD", "Gruen", "CDU", "LINKE", "AfD", "FDP", "PMUT", "FW", "Volt"];
    const parties2025 = [...parties2021, "BSW"];
    let partiesToDisplay = (year === '2025') ? parties2025 : parties2021;

    fetch(csvUrl)
        .then(response => response.text())
        .then(csvData => {
            const lines = csvData.trim().split('\n');
            const headers = lines[0].split(',');
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const currentLine = lines[i].split(',');
                const obj = {};
                for (let j = 0; j < headers.length; j++) {
                    obj[headers[j].trim()] = currentLine[j] ? currentLine[j].trim() : null; // Handle empty values
                }
                data.push(obj);
            }

            // Find data for the specified ID
            const selectedData = data.find(item => item.ID === id);

            if (!selectedData) {
                document.getElementById('chartdiv').innerText = 'Data not found for ID: ' + id;
                return;
            }

            const turnout = selectedData["Wahlbeteiligung"];
            const chartData = [];

            partiesToDisplay.forEach(party => {
                const percentage = selectedData[party];
                if (percentage !== null && percentage !== undefined && percentage !== "") { // Check if percentage is valid
                    chartData.push({ party: party, percentage: parseFloat(percentage.replace('%', '').replace(',', '.')) }); // Parse percentage value
                }
            });


            // Create root element
            // https://www.amcharts.com/docs/v5/getting-started/#Root_element
            var root = am5.Root.new("chartdiv");

            // Set themes
            // https://www.amcharts.com/docs/v5/themes/
            root.setThemes([
              am5themes_Animated.new(root)
            ]);


            // Create chart
            // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/
            var chart = root.container.children.push(am5percent.PieChart.new(root, {
              layout: root.verticalLayout,
              innerRadius: am5.percent(50)
            }));


            // Create series
            // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/#Series
            var series = chart.series.push(am5percent.PieSeries.new(root, {
              name: "Series",
              valueField: "percentage",
              categoryField: "party"
            }));

            series.data.setAll(chartData);


            // Add legend
            // https://www.amcharts.com/docs/v5/charts/percent-charts/pie-chart/#Legend
            var legend = am5.Legend.new(root, {
              centerY: am5.percent(50),
              y: am5.percent(50),
              marginLeft: 10
            });

            chart.set("legend", legend);
            legend.data.setAll(series.dataItems);

            // Add центру label
            var centerLabel = am5.Label.new(root, {
                fontSize: 20,
                fontWeight: "bold",
                textAlign: "center",
                centerY: am5.percent(50),
                centerX: am5.percent(50),
                text: "Turnout\n" + turnout + "%"
            })
            chart.seriesContainer.children.push(centerLabel);


            // Configure tooltips
            series.slices.template.set("tooltipText", "{category}: {valuePercentTotal.formatNumber('#.00')}%");


        })
        .catch(error => {
            document.getElementById('chartdiv').innerText = 'Error loading CSV data.';
            console.error('Error fetching CSV:', error);
        });

}); // end am5.ready()
