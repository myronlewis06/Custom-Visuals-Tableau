'use strict';
/* global d3 */

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
  window.onload = tableau.extensions.initializeAsync().then(() => {
    // Get the worksheet that the Viz Extension is running in
    const worksheet = tableau.extensions.worksheetContent.worksheet;

    // Save these outside the scope below for handling resizing without refetching the data
    let summaryData = {};
    let encodingMap = {};

    // Use the extensions API to get the summary data and map of encodings to fields,
    // and render the connected scatterplot.
    const updateDataAndRender = async () => {
      // Use extensions API to update the table of data and the map from encodings to fields
      [summaryData, encodingMap] = await Promise.all([
        getSummaryDataTable(worksheet),
        getEncodingMap(worksheet)
      ]);
      console.log(summaryData)
      console.log(encodingMap)

      renderScatterplot(summaryData, encodingMap);
    };

    // Handle re-rendering when the page is resized
    onresize = () => renderScatterplot(summaryData, encodingMap);

    // Listen to event for when the summary data backing the worksheet has changed.
    // This tells us that we should refresh the data and encoding map.
    worksheet.addEventListener(
      tableau.TableauEventType.SummaryDataChanged,
      updateDataAndRender
    );

    // Do the initial update and render
    updateDataAndRender();
  });

  // Takes a page of data, which has a list of DataValues (dataTablePage.data)
  // and a list of columns and puts the data in a list where each entry is an
  // object that maps from field names to DataValues
  // (example of a row being: { SUM(Sales): ..., SUM(Profit): ..., Ship Mode: ..., })
  function convertToListOfNamedRows (dataTablePage) {
    const rows = [];
    const columns = dataTablePage.columns;
    const data = dataTablePage.data;
    console.log(data)
    for (let i = data.length - 1; i >= 0; --i) {
      const row = {};
      for (let j = 0; j < columns.length; ++j) {
        row[columns[j].fieldName] = data[i][columns[j].index];
      }
      rows.push(row);
    }
    console.log(rows)
    return rows;
  }

  // Gets each page of data in the summary data and returns a list of rows of data
  // associated with field names.
  async function getSummaryDataTable (worksheet) {
    let rows = [];

    // Fetch the summary data using the DataTableReader
    const dataTableReader = await worksheet.getSummaryDataReaderAsync(
      undefined,
      { ignoreSelection: true }
    );
    for (
      let currentPage = 0;currentPage < dataTableReader.pageCount;currentPage++
    ) {
      const dataTablePage = await dataTableReader.getPageAsync(currentPage);
      rows = rows.concat(convertToListOfNamedRows(dataTablePage));
    }
    await dataTableReader.releaseAsync();

    return rows;
  }

  // Uses getVisualSpecificationAsync to build a map of encoding identifiers (specified in the .trex file)
  // to fields that the user has placed on the encoding's shelf.
  // Only encodings that have fields dropped on them will be part of the encodingMap.
  async function getEncodingMap (worksheet) {
    const visualSpec = await worksheet.getVisualSpecificationAsync();

    const encodingMap = {};

    if (visualSpec.activeMarksSpecificationIndex < 0) return encodingMap;

    const marksCard =
      visualSpec.marksSpecifications[visualSpec.activeMarksSpecificationIndex];
    for (const encoding of marksCard.encodings) { encodingMap[encoding.id] = encoding.field; }

    return encodingMap;
  }

  // A convenience function for using a possibly undefined encoding to access something dependent on it being defined.
  function useOptionalEncoding (encoding, valFunc) {
    if (encoding) {
      return valFunc(encoding);
    }

    return undefined;
  }

  // Renders the scatterplot to the content area of the Viz Extensions given the data and mapping from encodings to fields.
  function renderScatterplot (data, encodings) {
    // Clear the content region before we render
    const content = document.getElementById('content');
    content.innerHTML = '';



    // Render the LineChart using the data and the mapping of encodings to fields.
    // LineChart can render content when encodings are missing so pass in null
    // for an encoding when the user has not mapped a field to it
    const chart = LineChart(data, {
      x: (d) =>
        useOptionalEncoding(encodings.x, (encoding) => d[encoding.name].value),
      y: (d) =>
        useOptionalEncoding(encodings.y, (encoding) => d[encoding.name].value),
      text: (d) =>
        useOptionalEncoding(encodings.text, (encoding) => d[encoding.name].value)
      
    });

    content.appendChild(chart);
  }

  

  // Below is a LineChart implementation that has been showcased in the d3 gallery.
  // Some slight modifications have been made to make it able to be used with WorkbookFormatting.

  // Copyright 2021 Observable, Inc.
  // Released under the ISC license.
  // https://observablehq.com/@d3/connected-scatterplot
  function LineChart (
    data,
    {
      x = ([x]) => x, // given d in data, returns the (quantitative) x-value
      y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
      text = ([x]) => x
   
    } = {}
  ) {

  
    // Compute values.
    const X = d3.map(data, x);
    const Y = d3.map(data, y);
    const Z = d3.map(data, text);
    console.log(X)
    console.log(Y)
    console.log(Z)

    
  
    // Process data to group by category
    var dataByCategory = {};
    for (var i = 0; i < X.length; i++) {
        var category = Z[i];
        if (!dataByCategory[category]) {
            dataByCategory[category] = [];
        }
        dataByCategory[category].push([X[i], Y[i]]);
    }

    // Convert data to series format
    var seriesData = [];
    for (var category in dataByCategory) {
        seriesData.push({
            name: category,
            data: dataByCategory[category]
        });
    }

    // Create the Highcharts chart
    Highcharts.chart('content', {
        chart: {
            type: 'line'
        },
        title: {
            text: 'Sales by Category'
        },
        xAxis: {
            Z: X,
            title: {
                text: 'Date'
            }
        },
        yAxis: {
            title: {
                text: 'Sales'
            }
        },
        legend: {
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'middle'
        },
        series: seriesData,
        responsive: {
            rules: [{
                condition: {
                    maxWidth: 500
                },
                chartOptions: {
                    legend: {
                        layout: 'horizontal',
                        align: 'center',
                        verticalAlign: 'bottom'
                    }
                }
            }]
        }
    }); 

}
})();
