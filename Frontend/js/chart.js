function getClassificationAnnotations(data) {
    return data.map((item, i) => {
        if (item.classified === 1) {
            const x = new Date(parseInt(item.timestamp));
            let y, text, yref, yanchor, ay;
            if (item.classification === 1) {
                y = item.low * 0.98;
                text = '';
                yref = 'y';
                yanchor = 'top';
                ay = 20;
            } else if (item.classification === 2) {
                y = item.high * 1.02;
                text = '';
                yref = 'y';
                yanchor = 'bottom';
                ay = -20;
            } else if (item.classification === 3) {
                y = item.low * 0.98;
                text = '-';
                yref = 'y';
                yanchor = 'top';
                ay = 0;
            } else {
                return [];
            }
            return [{
                x: x,
                y: y,
                xref: 'x',
                yref: yref,
                text: text,
                showarrow: item.classification !== 3,
                arrowhead: item.classification !== 3 ? 2 : 0,
                ax: 0,
                ay: ay,
                font: {
                    color: item.classification === 3 ? '#d3d3d3' : '#ffff00',
                    size: 10
                },
                arrowcolor: '#ffff00',
                yanchor: yanchor
            }];
        }
        return [];
    }).flat();
}

function getSignalAnnotations(data) {
    console.log(getTimestamp(), 'Processing signals for annotations, data length:', data.length);
    if (!showSignals) {
        console.log(getTimestamp(), 'Signals hidden due to showSignals = false');
        return [];
    }
    return data.map((item, i) => {
        const x = new Date(parseInt(item.timestamp));
        let annotationsForItem = [];
        if (item.signals === 1 || item.signals === 2) {
            console.log(getTimestamp(), `Signal at ${item.Date}: signals=${item.signals}, signal_change_percentage=${item.signal_change_percentage}`);
        }
        if (item.signals === 1) {
            const safeBuy = item.safe_buy === 1 ? 'Safe ' : '';  // New: Prefix if safe
            annotationsForItem.push({
                x: x,
                y: item.low,
                xref: 'x',
                yref: 'y',
                text: safeBuy + 'Buy',  // "Safe Buy" or just "Buy"
                showarrow: true,
                arrowhead: 2,
                arrowsize: 0.5,
                arrowwidth: 1,
                arrowcolor: '#FFFFFF',
                ax: 0,
                ay: 10,
                font: {
                    color: '#000000',
                    size: 9
                },
                bgcolor: safeBuy ? '#00FF00' : '#90EE90',  // Brighter green for safe
                bordercolor: '#000000',
                borderwidth: 1,
                borderpad: 4,
                yanchor: 'top',
                xanchor: 'center'
            });
        } else if (item.signals === 2) {
            const percentage = (item.signal_change_percentage != null && !isNaN(item.signal_change_percentage))
                ? Number(item.signal_change_percentage).toFixed(2)
                : '0.00';
            const sellText = `Sell (${percentage}%)`;
            annotationsForItem.push({
                x: x,
                y: item.high,
                xref: 'x',
                yref: 'y',
                text: sellText,
                showarrow: true,
                arrowhead: 2,
                arrowsize: 0.5,
                arrowwidth: 1,
                arrowcolor: '#FFFFFF',
                ax: 0,
                ay: -10,
                font: {
                    color: '#000000',
                    size: 9
                },
                bgcolor: '#FFB6C1',
                bordercolor: '#000000',
                borderwidth: 1,
                borderpad: 6,
                yanchor: 'bottom',
                xanchor: 'center'
            });
        }
        return annotationsForItem;
    }).flat();
}

function getPriceLineShape(data) {
    if (!showPriceLine) {
        console.log(getTimestamp(), 'Price line hidden due to showPriceLine = false');
        return [];
    }
    let lastClosePrice = null;
    if (data && data.length > 0 && data[data.length - 1].close !== null && data[data.length - 1].close !== undefined) {
        lastClosePrice = parseFloat(data[data.length - 1].close);
        if (isNaN(lastClosePrice)) {
            console.warn(getTimestamp(), 'Invalid last close price:', data[data.length - 1].close);
            lastClosePrice = null;
        }
    } else {
        console.warn(getTimestamp(), 'Last close price is null or undefined:', data && data[data.length - 1]);
    }
    console.log(getTimestamp(), 'Calculated lastClosePrice:', lastClosePrice);
    return lastClosePrice !== null && !isNaN(lastClosePrice) ? [{
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        yref: 'y',
        y0: lastClosePrice,
        y1: lastClosePrice,
        line: {
            color: '#00ff00',
            width: 2,
            dash: 'dot',
            opacity: 0.3
        }
    }] : [];
}

function getSessionShapes(data) {
    const shapes = [];
    if (!data || data.length === 0) return shapes;

    const sessionTimes = {
        premarket: { start: '10:00:00', end: '15:30:00', color: 'rgba(173,216,230,0.1)' },
        normal: { start: '15:30:00', end: '22:00:00', color: 'rgba(144,238,144,0.1)' },
        aftermarket: { start: '22:00:00', end: '02:00:00', color: 'rgba(255,182,193,0.1)' }
    };

    const days = new Set();
    data.forEach(item => {
        const d = new Date(parseInt(item.timestamp));
        const dayStr = d.toISOString().slice(0, 10);
        days.add(dayStr);
    });

    const sortedDays = Array.from(days).sort();
    sortedDays.forEach((day) => {
        Object.keys(sessionTimes).forEach(session => {
            const x0 = new Date(`${day} ${sessionTimes[session].start}`);
            const x1 = new Date(`${day} ${sessionTimes[session].end}`);
            shapes.push({
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: x0,
                x1: x1,
                y0: 0,
                y1: 1,
                fillcolor: sessionTimes[session].color,
                opacity: 1,
                line: { width: 0 },
                layer: 'below'
            });
        });
    });

    return shapes;
}

function getAllShapes(data) {
    let shapes = [];
    if (showPriceLine) {
        shapes.push(...getPriceLineShape(data));
    }
    if (showSessions) {
        shapes.push(...getSessionShapes(data));
    }
    if (patternSelectionMode && lastSelectionRange) {
        shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: lastSelectionRange[0],
            x1: lastSelectionRange[1],
            y0: 0,
            y1: 1,
            fillcolor: '#3498db',
            opacity: 0.2,
            line: { width: 0 }
        });
    }
    return shapes;
}

function updateChart(data, chartId) {
    console.log(getTimestamp(), 'Entering updateChart with data length:', data.length);
    if (!plotlyLoaded || !Array.isArray(data) || data.length === 0) {
        console.error(getTimestamp(), 'Invalid or empty data or Plotly not loaded:', data);
        $('#tickerLoaderModal').hide();
        $('#errorMessage').text('No valid data to plot').show();
        isDataLoaded = false;
        updateToolbarState();
        return;
    }

    const limitedData = data.slice(-maxDataPoints);
    console.log(getTimestamp(), 'Processing chart data, limited to:', limitedData.length, 'points, raw data sample:', limitedData.slice(0, 2));
    const validData = limitedData.filter((item, index) => {
        if (!item || typeof item !== 'object') {
            console.warn(getTimestamp(), `Invalid row at index ${index}:`, item);
            return false;
        }
        const timestamp = parseInt(item.timestamp);
        const open = parseFloat(item.open);
        const high = parseFloat(item.high);
        const low = parseFloat(item.low);
        const close = parseFloat(item.close);
        const date = item.Date;
        const isValid = !isNaN(timestamp) && 
                        validateDate(date) !== null && 
                        !isNaN(open) && open !== null && open !== undefined &&
                        !isNaN(high) && high !== null && high !== undefined &&
                        !isNaN(low) && low !== null && low !== undefined &&
                        !isNaN(close) && close !== null && close !== undefined;
        if (!isValid) {
            console.warn(getTimestamp(), `Skipping invalid row at index ${index}:`, {
                timestamp: item.timestamp,
                date: item.Date,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close
            });
        }
        return isValid;
    });

    console.log(getTimestamp(), 'Valid data length after filtering:', validData.length);
    if (validData.length === 0) {
        console.error(getTimestamp(), 'No valid rows after filtering:', limitedData);
        $('#tickerLoaderModal').hide();
        $('#errorMessage').text('No valid data to plot after filtering').show();
        isDataLoaded = false;
        updateToolbarState();
        return;
    }

    const ppoDataSample = validData.slice(0, 5).map(item => ({
        timestamp: item.timestamp,
        momentum_ppo_sm: item.momentum_ppo_sm
    }));
    console.log(getTimestamp(), 'momentum_ppo_sm data sample:', ppoDataSample);

    const annotations = [
        ...(showSignals ? getSignalAnnotations(validData) : []),
        ...(showClassificationAnnotations ? getClassificationAnnotations(validData) : [])
    ];

    const traces = [];
    const predColors = {
        0: '#808080',
        1: appSettings.colors.up,
        2: appSettings.colors.down,
        3: appSettings.colors.neutral
    };

    console.log(getTimestamp(), 'Color by predictions mode:', appSettings.chartDefaults.colorByPredictions, 'Using colors:', predColors);

    if (appSettings.chartDefaults.colorByPredictions) {
        const predictionGroups = { 0: [], 1: [], 2: [], 3: [] };
        validData.forEach(item => {
            const pred = parseInt(item.prediction) || 0;
            if ([0, 1, 2, 3].includes(pred)) {
                predictionGroups[pred].push(item);
            }
        });
        Object.keys(predictionGroups).forEach(pred => {
            const group = predictionGroups[pred];
            if (group.length > 0) {
                const x = group.map(item => new Date(parseInt(item.timestamp)));
                const open = group.map(item => parseFloat(item.open));
                const high = group.map(item => parseFloat(item.high));
                const low = group.map(item => parseFloat(item.low));
                const close = group.map(item => parseFloat(item.close));
                if (x.some(v => v === null || isNaN(v.getTime())) ||
                    open.some(v => v === null || isNaN(v)) ||
                    high.some(v => v === null || isNaN(v)) ||
                    low.some(v => v === null || isNaN(v)) ||
                    close.some(v => v === null || isNaN(v))) {
                    console.warn(getTimestamp(), `Invalid trace data for prediction ${pred}:`, { x, open, high, low, close });
                    return;
                }
                traces.push({
                    x: x,
                    open: open,
                    high: high,
                    low: low,
                    close: close,
                    type: 'candlestick',
                    name: `${currentTicker || 'Candlestick'} (Pred: ${pred})`,
                    line: { color: predColors[pred] },
                    increasing: { line: { color: predColors[pred] } },
                    decreasing: { line: { color: predColors[pred] } },
                    hovertext: group.map(item => {
                        const classText = item.classified ? `CPP: ${item.cpp} Classification: ${item.classification} (${item.classification === 1 ? 'Up' : item.classification === 2 ? 'Down' : item.classification === 3 ? 'Neutral' : 'Unknown'})` : 'Not Classified';
                        const signalText = item.signals ? `Signal: ${item.signals} (${item.signals === 1 ? 'Buy' : item.signals === 2 ? 'Sell' : 'None'})` : 'Signal: None';
                        return `Prediction: ${item.prediction}, Value: ${item.prediction_values}, ${classText}, ${signalText}`;
                    }),
                    selectedpoints: null,
                    opacity: 1,
                    yaxis: 'y'
                });
            }
        });
    } else {
        const x = validData.map(item => new Date(parseInt(item.timestamp)));
        const open = validData.map(item => parseFloat(item.open));
        const high = validData.map(item => parseFloat(item.high));
        const low = validData.map(item => parseFloat(item.low));
        const close = validData.map(item => parseFloat(item.close));
        if (x.some(v => v === null || isNaN(v.getTime())) ||
            open.some(v => v === null || isNaN(v)) ||
            high.some(v => v === null || isNaN(v)) ||
            low.some(v => v === null || isNaN(v)) ||
            close.some(v => v === null || isNaN(v))) {
            console.warn(getTimestamp(), 'Invalid trace data for standard candlestick');
            return;
        }
        traces.push({
            x: x,
            open: open,
            high: high,
            low: low,
            close: close,
            type: 'candlestick',
            name: currentTicker || 'Candlestick',
            increasing: { line: { color: appSettings.colors.up } },
            decreasing: { line: { color: appSettings.colors.down } },
            hovertext: validData.map(item => {
                const classText = item.classified ? `CPP: ${item.cpp} Classification: ${item.classification} (${item.classification === 1 ? 'Up' : item.classification === 2 ? 'Down' : item.classification === 3 ? 'Neutral' : 'Unknown'})` : 'Not Classified';
                const signalText = item.signals ? `Signal: ${item.signals} (${item.signals === 1 ? 'Buy' : item.signals === 2 ? 'Sell' : 'None'})` : 'Signal: None';
                return `Prediction: ${item.prediction}, Value: ${item.prediction_values}, ${classText}, ${signalText}`;
            }),
            selectedpoints: null,
            opacity: 1,
            yaxis: 'y'
        });
    }

    if (traces.length === 0) {
        console.error(getTimestamp(), 'No valid traces generated');
        $('#tickerLoaderModal').hide();
        $('#errorMessage').text('No valid traces to plot').show();
        isDataLoaded = false;
        updateToolbarState();
        return;
    }

    if (showMomentumPPO) {
        const ppoValidData = validData.filter(item => item.momentum_ppo_sm !== null && !isNaN(parseFloat(item.momentum_ppo_sm)));
        if (ppoValidData.length > 0) {
            const ppoX = ppoValidData.map(item => new Date(parseInt(item.timestamp)));
            const ppoY = ppoValidData.map(item => parseFloat(item.momentum_ppo_sm));
            traces.push({
                x: ppoX,
                y: ppoY,
                type: 'scatter',
                mode: 'lines',
                name: 'Momentum PPO',
                line: { color: appSettings.colors.ppoLine, width: 2 },
                yaxis: 'y2',
                hovertext: ppoValidData.map(item => `PPO: ${parseFloat(item.momentum_ppo_sm).toFixed(2)}`)
            });
        }
    }

    const shapes = getAllShapes(validData);

    const layout = {
        title: '',
        xaxis: { 
            type: 'date', 
            title: 'Date', 
            showgrid: true, 
            zeroline: true, 
            gridcolor: '#666',
            rangeslider: { visible: false }, 
            uirevision: 'custom-revision-key',
            range: currentRanges.xaxis,
            domain: [0, 1]
        },
        yaxis: { 
            title: 'Price', 
            showgrid: true, 
            zeroline: false, 
            gridcolor: '#666',
            range: currentRanges.yaxis,
            side: 'left'
        },
        hovermode: 'closest',
        dragmode: patternSelectionMode ? 'select' : 'zoom',
        showlegend: false,
        uirevision: 'custom-revision-key',
        displayModeBar: false,
        margin: { r: 20, t: 20, b: 40, l: 50 },
        plot_bgcolor: '#2a2a2a',
        paper_bgcolor: '#2a2a2a',
        font: { color: '#ffffff' },
        shapes: shapes,
        annotations: annotations
    };

    if (showMomentumPPO) {
        layout.yaxis2 = {
            title: 'Momentum PPO',
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            zeroline: false
        };
    }

    try {
        console.log(getTimestamp(), 'Rendering candlestick chart with', validData.length, 'data points, traces:', traces.length, 'annotations:', annotations.length, 'shapes:', shapes.length);
        console.log(getTimestamp(), 'Shapes:', JSON.stringify(shapes, null, 2));
        if (isRelayoutInProgress) {
            console.log(getTimestamp(), 'Skipping newPlot due to in-progress relayout');
            $('#tickerLoaderModal').hide();
            return;
        }
        isRelayoutInProgress = true;
        Plotly.newPlot(chartId, traces, layout, {
            displayModeBar: false,
            responsive: true,
            scrollZoom: true,
            autosize: true,
            selectdirection: 'h'
        }).then(chart => {
            console.log(getTimestamp(), 'Candlestick chart rendered successfully');
            chartInstance = chart;
            isDataLoaded = true;
            updateToolbarState();
            $('#tickerLoaderModal').hide();
            $('#errorMessage').hide();
            isRelayoutInProgress = false;
            setTimeout(setupEventListeners, 100);
        }).catch(err => {
            console.error(getTimestamp(), 'Plotly.newPlot failed for candlestick:', err);
            $('#errorMessage').text(`Chart rendering error: ${err.message || 'Unknown Plotly error'}`).show();
            $('#tickerLoaderModal').hide();
            isRelayoutInProgress = false;
            isDataLoaded = false;
            updateToolbarState();
        });
    } catch (error) {
        console.error(getTimestamp(), 'Chart rendering failed:', error);
        $('#errorMessage').text(`Chart rendering error: ${error.message || 'Unknown error'}`).show();
        $('#tickerLoaderModal').hide();
        isRelayoutInProgress = false;
        isDataLoaded = false;
        updateToolbarState();
    }
}