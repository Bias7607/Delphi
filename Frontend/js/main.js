let ioLoaded = typeof io !== 'undefined';
let plotlyLoaded = typeof Plotly !== 'undefined';
let patternSelectionMode = false;
let showClassificationAnnotations = false;
let showPriceLine = true;
let showMomentumPPO = true;
let pauseChartUpdates = false;
let chartData = [];
let chartInstance = null;
let ppoChartInstance = null;
let lastSelectionRange = null;
const pattern_length = 5;
let offset = 0;
let currentRanges = { xaxis: null, yaxis: null, yaxis2: null };
let dataTimeout = null;
const dataTimeoutMs = 5000;
let currentTicker = null;
let isRelayoutInProgress = false;
const maxDataPoints = 1000;
let isDataLoaded = false;
let showSignals = true;
let showSessions = true;
let dataStatus = 'disconnected';
let trainStatus = 'disconnected';
let miscStatus = 'disconnected';
let currentChain = []; // New: Store active trade chain

const TA_FEATURES = [
    'open', 'high', 'low', 'close', 'volume', 'volume_adi', 'volume_obv', 'volume_cmf', 'volume_fi',
    'volume_em', 'volume_sma_em', 'volume_vpt', 'volume_vwap', 'volume_mfi', 'volume_nvi',
    'volatility_bbm', 'volatility_bbh', 'volatility_bbl', 'volatility_bbw', 'volatility_bbp',
    'volatility_bbhi', 'volatility_bbli', 'volatility_kcc', 'volatility_kch', 'volatility_kcl',
    'volatility_kcw', 'volatility_kcp', 'volatility_kchi', 'volatility_kcli', 'volatility_dcl',
    'volatility_dch', 'volatility_dcm', 'volatility_dcw', 'volatility_dcp', 'volatility_atr',
    'volatility_ui', 'trend_macd', 'trend_macd_signal', 'trend_macd_diff', 'trend_sma_fast',
    'trend_sma_slow', 'trend_ema_fast', 'trend_ema_slow', 'trend_vortex_ind_pos',
    'trend_vortex_ind_neg', 'trend_vortex_ind_diff', 'trend_trix', 'trend_mass_index',
    'trend_dpo', 'trend_kst', 'trend_kst_sig', 'trend_kst_diff', 'trend_ichimoku_conv',
    'trend_ichimoku_base', 'trend_ichimoku_a', 'trend_ichimoku_b', 'trend_stc', 'trend_adx',
    'trend_adx_pos', 'trend_adx_neg', 'trend_cci', 'trend_visual_ichimoku_a',
    'trend_visual_ichimoku_b', 'trend_aroon_up', 'trend_aroon_down', 'trend_aroon_ind',
    'trend_psar_up', 'trend_psar_down', 'trend_psar_up_indicator', 'trend_psar_down_indicator',
    'momentum_rsi', 'momentum_stoch_rsi', 'momentum_stoch_rsi_k', 'momentum_stoch_rsi_d',
    'momentum_tsi', 'momentum_uo', 'momentum_stoch', 'momentum_stoch_signal', 'momentum_wr',
    'momentum_ao', 'momentum_roc', 'momentum_ppo', 'momentum_ppo_signal', 'momentum_ppo_hist',
    'momentum_pvo', 'momentum_pvo_signal', 'momentum_pvo_hist', 'momentum_kama', 'others_dr',
    'others_dlr', 'others_cr', 'momentum_ppo_sm', 'momentum_ppo_deg', 'classified', 'classification'
];

function formatVolume(volume) {
    if (volume === null || volume === undefined) return '—';
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toLocaleString();
}

// New: Build trade chain for #trade-tracker
function buildTradeChain(data) {
    console.log(getTimestamp(), 'Building trade chain, data length:', data.length);
    $('#trade-tracker').empty();
    currentChain = [];

    if (!data || data.length === 0) {
        $('#trade-tracker').html('<span style="color: #aaaaaa; font-size: 12px;">No active buy</span>');
        return;
    }

    let lastBuyIndex = -1;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].signals === 1) {
            lastBuyIndex = i;
            break;
        }
    }

    if (lastBuyIndex === -1) {
        $('#trade-tracker').html('<span style="color: #aaaaaa; font-size: 12px;">No active buy</span>');
        return;
    }

    currentChain.push({
        type: 'buy',
        cpp: data[lastBuyIndex].cpp_smoothed,
        timestamp: data[lastBuyIndex].timestamp,
        date: data[lastBuyIndex].Date
    });

    let intermediateCount = 0;
    let prevCpp = data[lastBuyIndex].cpp_smoothed;
    let dipCount = 0;

    for (let i = lastBuyIndex + 1; i < data.length && intermediateCount < 4; i++) {
        const cpp = data[i].cpp_smoothed;
        const timestamp = data[i].timestamp;
        const date = data[i].Date;

        if (data[i].signals === 2) {
            currentChain.push({
                type: 'sell',
                cpp: cpp,
                timestamp: timestamp,
                date: date
            });
            break;
        }

        if (cpp > 70 && prevCpp <= 70) {
            currentChain.push({ type: 'rise', cpp: cpp, timestamp: timestamp, date: date });
            intermediateCount++;
        } else if (cpp >= 50 && cpp <= 70 && (prevCpp < 50 || prevCpp > 70)) {
            currentChain.push({ type: 'hover', cpp: cpp, timestamp: timestamp, date: date });
            intermediateCount++;
        } else if (cpp < 50 && prevCpp >= 50) {
            if (i + 1 < data.length && data[i + 1].cpp_smoothed >= 50) {
                currentChain.push({ type: 'dip', cpp: cpp, timestamp: timestamp, date: date });
                intermediateCount++;
            }
        } else if (cpp < 40 && prevCpp >= 40) {
            dipCount++;
            if (dipCount >= 3) {
                currentChain.push({ type: 'diminish', cpp: cpp, timestamp: timestamp, date: date });
                intermediateCount++;
            }
        }

        prevCpp = cpp;
    }

    currentChain.forEach((point, index) => {
        const time = new Date(parseInt(point.timestamp)).toLocaleTimeString();
        const tooltip = `${point.type.charAt(0).toUpperCase() + point.type.slice(1)}: CPP ${point.cpp.toFixed(2)} at ${time}`;
        $('#trade-tracker').append(`<span class="trade-dot ${point.type}" data-tooltip="${tooltip}"></span>`);
        if (index < currentChain.length - 1) {
            $('#trade-tracker').append('<span class="trade-line"></span>');
        }
    });

    console.log(getTimestamp(), 'Trade chain built:', currentChain);
}

if (!ioLoaded && !plotlyLoaded) {
    console.error(getTimestamp(), 'Both Socket.IO and Plotly libraries failed to load.');
    $('#errorMessage').text('Critical library loading failure').show();
    throw new Error('Required libraries not available');
} else if (!plotlyLoaded) {
    console.warn(getTimestamp(), 'Plotly library failed to load. Chart functionality will be disabled.');
    $('#errorMessage').text('Plotly library failed to load').show();
}

$(document).ready(() => {
    appSettings = loadSettings();
    applySettings();
    updateToolbarState();

    const initialLayout = {
        title: '',
        yaxis: { title: 'Price', autorange: true, gridcolor: '#666' },
        xaxis: { type: 'date', title: 'Date', autorange: true, gridcolor: '#666', rangeslider: { visible: false }, uirevision: 'custom-revision-key' },
        plot_bgcolor: '#2a2a2a',
        paper_bgcolor: '#2a2a2a',
        font: { color: '#ffffff' },
        dragmode: 'zoom',
        uirevision: 'custom-revision-key',
        margin: { r: 20, t: 20, b: 40, l: 50 },
        annotations: [],
        shapes: []
    };

    if (plotlyLoaded) {
        try {
            Plotly.newPlot('plotlyChart', [], initialLayout, {
                displayModeBar: false,
                responsive: true,
                scrollZoom: true,
                autosize: true,
                selectdirection: 'h'
            }).then(chart => {
                console.log(getTimestamp(), 'Candlestick chart initialized with gridcolor: #666');
                chartInstance = chart;
                setupEventListeners();
            }).catch(err => {
                console.error(getTimestamp(), 'Plotly initialization failed:', err);
                $('#errorMessage').text(`Error initializing chart: ${err.message || 'Unknown error'}`).show();
            });
        } catch (error) {
            console.error(getTimestamp(), 'Plotly initialization failed:', error);
            $('#errorMessage').text(`Error initializing chart: ${error.message || 'Unknown error'}`).show();
        }
    }

    updateConnectionStatus('data', 'disconnected');
    updateConnectionStatus('train', 'disconnected');
    updateConnectionStatus('misc', 'disconnected');

    socket.on('connect', () => {
        console.log(getTimestamp(), 'Socket.IO connected to /data:', socket.id);
        updateConnectionStatus('data', 'connected');
        if (currentTicker && !pauseChartUpdates) {
            console.log(getTimestamp(), 'Requesting ticker data on connect:', currentTicker);
            socket.emit('request_ticker_data', { ticker: currentTicker });
            startDataTimeout(currentTicker);
        }
    });

    socket.on('connect_error', (error) => {
        console.error(getTimestamp(), 'Connection error:', error.message);
        updateConnectionStatus('data', 'disconnected');
    });

    socket.on('disconnect', (reason) => {
        console.log(getTimestamp(), 'Disconnected from /data:', reason);
        updateConnectionStatus('data', 'disconnected');
    });

    socket.on('reconnect', () => {
        console.log(getTimestamp(), 'Reconnected to /data:', socket.id);
        updateConnectionStatus('data', 'connected');
        if (currentTicker && !pauseChartUpdates) {
            console.log(getTimestamp(), 'Re-requesting ticker data after reconnect:', currentTicker);
            socket.emit('request_ticker_data', { ticker: currentTicker });
            startDataTimeout(currentTicker);
        }
    });

    socket.on('ticker_data', (data) => {
        console.log(getTimestamp(), 'Received ticker_data, sample:',
            data.data ? data.data.slice(0, 5).map(item => ({
                Date: item.Date,
                signals: item.signals,
                signal_change_percentage: item.signal_change_percentage
            })) : 'No data');

        clearTimeout(dataTimeout);
        $('#tickerLoaderModal').hide();
        $('#errorMessage').hide();

        if (pauseChartUpdates) {
            console.log(getTimestamp(), 'Chart updates paused; storing ticker_data for later');
            return;
        }

        if (data && data.tickers && data.tickers.length > 0 && data.data && data.data.length > 0) {
            if (data.tickers[0] !== currentTicker) {
                console.warn(getTimestamp(), 'Ignoring stale ticker data for', data.tickers[0]);
                return;
            }

            currentTicker = data.tickers[0];
            chartData = data.data.map(item => {
                const formattedDate = validateDate(item.Date) || formatDate(item.timestamp);
                if (!formattedDate) {
                    console.warn(getTimestamp(), `Invalid Date for item: ${item.Date}, timestamp: ${item.timestamp}`);
                }
                const candle = {
                    timestamp: parseInt(item.timestamp),
                    Date: formattedDate,
                    open: parseFloat(item.open),
                    high: parseFloat(item.high),
                    low: parseFloat(item.low),
                    close: parseFloat(item.close),
                    volume: parseInt(item.volume),
                    prediction: parseInt(item.prediction) || 0,
                    prediction_values: parseFloat(item.prediction_values) || 0,
                    classified: parseInt(item.classified) || 0,
                    classification: parseInt(item.classification) || 0,
                    signals: parseInt(item.signals) || 0,
                    signal_change_percentage: item.signal_change_percentage != null ? parseFloat(item.signal_change_percentage) : 0.0,
                    momentum_ppo_sm: item.momentum_ppo_sm !== null && item.momentum_ppo_sm !== undefined ? parseFloat(item.momentum_ppo_sm) : null,
                    safe_buy: parseInt(item.safe_buy) || 0,
                    cpp_smoothed: parseFloat(item.cpp_smoothed) || 0.0 // New: Add cpp_smoothed
                };
                TA_FEATURES.forEach(feature => {
                    if (feature !== 'momentum_ppo_sm') {
                        candle[feature] = parseFloat(item[feature]) || 0.0;
                    }
                });
                return candle;
            }).filter(item => item.Date !== null);

            console.log(getTimestamp(), 'Processed chartData length:', chartData.length, 'sample:', chartData.slice(0, 2));
            updateTickerInfo(currentTicker, chartData, data.ticker_info ? data.ticker_info[currentTicker] : {});
            if (plotlyLoaded) {
                updateChart(chartData, 'plotlyChart');
                buildTradeChain(chartData); // New: Build trade chain on data load
            }
        } else {
            console.warn(getTimestamp(), 'Invalid or empty ticker_data:', data);
            $('#errorMessage').text('No valid data received').show();
            updateTickerInfo(currentTicker, [], {});
            $('#trade-tracker').html('<span style="color: #aaaaaa; font-size: 12px;">No active buy</span>');
            isDataLoaded = false;
            updateToolbarState();
        }
    });

    socket.on('ticker_info', (data) => {
        console.log(getTimestamp(), 'Received ticker_info:', data);
        if (data && data.ticker === currentTicker) {
            updateTickerInfo(currentTicker, chartData);
        } else {
            console.warn(getTimestamp(), 'Received ticker_info for wrong ticker:', data);
        }
    });

    $('#togglePatternButton').on('click', (e) => {
        e.stopPropagation();
        togglePatternSelectionMode();
    });

    $('#toggleClassificationsButton').on('click', (e) => {
        e.stopPropagation();
        toggleClassificationAnnotations();
    });

    $('#togglePriceLineButton').on('click', (e) => {
        e.stopPropagation();
        togglePriceLine();
    });

    $('#toggleMomentumPPOButton').on('click', (e) => {
        e.stopPropagation();
        toggleMomentumPPO();
    });

    $('#toggleSignalsButton').on('click', (e) => {
        e.stopPropagation();
        toggleSignals();
    });

    $('#toggleSessionsButton').on('click', (e) => {
        e.stopPropagation();
        toggleSessions();
    });

    trainSocket.on('progress_update', (data) => {
        console.log(getTimestamp(), 'Received progress_update:', data);
        const progressContainer = $('.progress-container');
        const progressBar = $('#progressBar');
        if (data.total_patterns > 0) {
            progressContainer.show();
            const progress = data.progress || 0;
            progressBar.css('width', progress + '%').text(Math.round(progress) + '%');
        } else {
            progressContainer.hide();
            progressBar.css('width', '0%').text('0%');
            resetModalAndUI();
        }
    });

    trainSocket.on('train_complete', (data) => {
        console.log(getTimestamp(), 'Received train_complete:', data);
        try {
            const progressContainer = $('.progress-container');
            const progressBar = $('#progressBar');
            if (data.status === 'success') {
                progressBar.css('width', '100%').text('100%');
            } else if (data.status === 'cancelled') {
                progressBar.css('width', '0%').text('Cancelled');
                alert('Pattern saving cancelled');
            } else {
                progressBar.css('width', '100%').text('Failed');
                $('#errorMessage').text(data.message || 'Pattern saving failed').show();
                alert(`Error: ${data.message || 'Pattern saving failed'}`);
            }
            setTimeout(() => {
                resetModalAndUI();
                if (currentTicker) {
                    console.log(getTimestamp(), 'Requesting updated ticker data:', currentTicker);
                    socket.emit('request_ticker_data', { ticker: currentTicker });
                    startDataTimeout(currentTicker);
                }
            }, 500);
        } catch (err) {
            console.error(getTimestamp(), 'Error handling train_complete:', err);
            $('#errorMessage').text(`Error processing train complete: ${err.message || 'Unknown error'}`).show();
            alert('Error processing train complete');
            resetModalAndUI();
        }
    });

    trainSocket.on('connect', () => {
        console.log(getTimestamp(), 'Socket.IO connected to /train:', trainSocket.id);
        updateConnectionStatus('train', 'connected');
    });

    trainSocket.on('connect_error', (error) => {
        console.error(getTimestamp(), 'Train socket connection error:', error.message);
        updateConnectionStatus('train', 'disconnected');
    });

    trainSocket.on('disconnect', () => {
        console.log(getTimestamp(), 'Disconnected from /train');
        updateConnectionStatus('train', 'disconnected');
    });

    trainSocket.on('reconnect', () => {
        console.log(getTimestamp(), 'Reconnected to /train:', trainSocket.id);
        updateConnectionStatus('train', 'connected');
    });

    $('#cancelBtn').on('click', () => {
        console.log(getTimestamp(), 'Cancel clicked, sending cancel_save');
        trainSocket.emit('cancel_save', {});
        resetModalAndUI();
    });

    $('#sendPatternsBtn').on('click', () => {
        const selectedPattern = $('input[name="patternType"]:checked').val();
        if (!selectedPattern) {
            console.warn(getTimestamp(), 'No pattern type selected');
            $('#errorMessage').text('Please select a pattern type').show();
            return;
        }
        const selectedData = chartData
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => {
                const itemDate = new Date(item.timestamp);
                return lastSelectionRange && itemDate >= new Date(lastSelectionRange[0]) && itemDate <= new Date(lastSelectionRange[1]);
            })
            .map(({ item, index }) => ({ item, index }));
        if (selectedData.length < 1) {
            console.warn(getTimestamp(), 'No candlesticks selected');
            $('#errorMessage').text('Select at least 1 candlestick').show();
            return;
        }
        const patterns = [];
        const labels = [];
        const validationErrors = [];
        selectedData.forEach(({ item, index }, i) => {
            if (index < pattern_length - 1) {
                validationErrors.push(`Pattern for candlestick at index ${index} skipped: Need ${pattern_length} prior candlesticks`);
                return;
            }
            const pattern = chartData.slice(index - pattern_length + 1, index + 1);
            if (pattern.length !== pattern_length) {
                validationErrors.push(`Pattern for candlestick at index ${index} skipped: Only ${pattern.length} candlesticks available, need ${pattern_length}`);
                return;
            }
            const validation = validatePattern(pattern, i);
            if (!validation.valid) {
                validationErrors.push(...validation.errors);
                return;
            }
            patterns.push(pattern);
            labels.push(parseInt(selectedPattern));
        });
        if (validationErrors.length > 0) {
            console.warn(getTimestamp(), 'Validation errors:', validationErrors);
            $('#validationErrors').text(validationErrors.join('; ')).show();
            return;
        }
        if (patterns.length === 0) {
            console.warn(getTimestamp(), 'No valid patterns to send');
            $('#errorMessage').text('No valid patterns to send').show();
            return;
        }
        console.log(getTimestamp(), 'Sending', patterns.length, 'patterns with labels:', labels);
        $('#sendPatternsBtn').prop('disabled', true);
        $('.progress-container').show();
        $('#progressBar').css('width', '0%').text('0%');
        trainSocket.emit('save_patterns', {
            ticker: currentTicker,
            patterns: patterns,
            labels: labels
        });
    });

    $('#addButton').on('click', () => {
        const ticker = $('#tickerInput').val().trim().toUpperCase();
        requestNewTicker(ticker);
    });

    $('#tickerInput').on('keypress', (e) => {
        if (e.which === 13) {
            $('#addButton').click();
        }
    });

    miscSocket.on('connect', () => {
        console.log(getTimestamp(), 'Socket.IO connected to /misc:', miscSocket.id);
        updateConnectionStatus('misc', 'connected');
    });

    miscSocket.on('connect_error', (error) => {
        console.error(getTimestamp(), 'Misc socket connection error:', error.message);
        updateConnectionStatus('misc', 'disconnected');
    });

    miscSocket.on('disconnect', () => {
        console.log(getTimestamp(), 'Disconnected from /misc');
        updateConnectionStatus('misc', 'disconnected');
    });

    miscSocket.on('reconnect', () => {
        console.log(getTimestamp(), 'Reconnected to /misc:', miscSocket.id);
        updateConnectionStatus('misc', 'connected');
    });

    miscSocket.on('misc_update', (data) => {
        console.log(getTimestamp(), 'Received misc_update:', data);
        populateGainersTable('premarket', data.premarket || []);
        populateGainersTable('normal', data.normal || []);
        populateGainersTable('aftermarket', data.aftermarket || []);
        if (data.report) {
            const report = data.report;
            let html = `
                <div class="stats-container">
                    <div class="stat-item">
                        <span class="stat-label">Total Classifications</span>
                        <span class="stat-value">${report.total_classifications.toLocaleString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Database Size</span>
                        <span class="stat-value">${report.total_size}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value unique-tickers-link" style="cursor: pointer; color: #3498db;">${report.unique_tickers.toLocaleString()}</span>
                    </div>
                </div>
                <div class="class-ratios-container" style="margin-left:20px;">
                    <div class="ratios-list">
                        <div class="ratio-item up">
                            <i class="fas fa-arrow-up"></i>
                            <span>Up (1): ${report.class_counts['1'].toLocaleString()} (${report.class_percentages['1']}%) </span>
                        </div>
                        <div class="ratio-item down">
                            <i class="fas fa-arrow-down"></i>
                            <span>Down (2): ${report.class_counts['2'].toLocaleString()} (${report.class_percentages['2']}%) </span>
                        </div>
                        <div class="ratio-item neutral">
                            <i class="fas fa-minus"></i>
                            <span>Neutral (3): ${report.class_counts['3'].toLocaleString()} (${report.class_percentages['3']}%) </span>
                        </div>
                    </div>
                </div>
            `;
            if (report.training_report && report.training_report.training_datetime) {
                function formatDuration(seconds) {
                    if (seconds < 60) {
                        return `${Math.round(seconds)}s`;
                    }
                    const days = Math.floor(seconds / (3600 * 24));
                    seconds %= (3600 * 24);
                    const hours = Math.floor(seconds / 3600);
                    seconds %= 3600;
                    const minutes = Math.floor(seconds / 60);
                    seconds = Math.round(seconds % 60);
                    let result = '';
                    if (days > 0) result += `${days}d `;
                    if (hours > 0 || days > 0) result += `${hours}h `;
                    if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
                    if (seconds > 0 || (days === 0 && hours === 0 && minutes === 0)) result += `${seconds}s`;
                    return result.trim();
                }
                const durationText = formatDuration(report.training_report.training_duration_seconds);
                html += `
                    <div class="stats-container" style="margin-left:20px;border-left:1px solid #4a4a4a; padding-left:15px; border-right:none; padding-right:0;">
                        <div class="stat-item">
                            <span class="stat-label">Last training date:</span>
                            <span class="stat-value">${new Date(report.training_report.training_datetime).toLocaleString()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Accuracy:</span>
                            <span class="stat-value">${(report.training_report.accuracy * 100).toFixed(2)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Training time:</span>
                            <span class="stat-value">${durationText}</span>
                        </div>
                    </div>
                `;
            }
            $('.bottom-panel').html(html);
        } else {
            $('.bottom-panel').empty();
        }
    });

    miscSocket.on('unique_tickers_list', function(data) {
        $('#tickersLoader').hide();
        if (data.error) {
            $('#uniqueTickersList').html(`<p style="text-align: center; color: #ff5555;">Error: ${data.error}</p>`);
            return;
        }
        const tickersData = data.tickers || [];
        if (tickersData.length === 0) {
            $('#uniqueTickersList').html('<p style="text-align: center; color: #aaaaaa;">No unique tickers found. Classify some patterns!</p>');
            return;
        }
        tickersData.forEach(item => {
            const section = $('<div class="ticker-section">');
            const header = $('<h3 class="ticker-header">').text(item.ticker).append('<i class="fas fa-chevron-down"></i>');
            const ul = $('<ul class="date-list hidden">');
            item.dates.forEach(dateItem => {
                ul.append(`<li>${dateItem.date}: ${dateItem.count} classifications</li>`);
            });
            header.on('click', () => {
                ul.toggleClass('hidden');
                header.find('i').toggleClass('fa-chevron-down fa-chevron-up');
            });
            section.append(header, ul);
            $('#uniqueTickersList').append(section);
        });
    });

    function populateGainersTable(tabId, gainers) {
        const tbody = $(`#${tabId}-body`);
        tbody.empty();
        gainers.forEach(gainer => {
            const changeClass = gainer.change_percentage > 0 ? 'positive' : gainer.change_percentage < 0 ? 'negative' : '';
            const row = `
                <tr class="gainer-row" data-ticker="${gainer.ticker}">
                    <td>${gainer.ticker || '—'}</td>
                    <td>${gainer.name || '—'}</td>
                    <td align="right" class="${changeClass}">${gainer.change_percentage !== null ? gainer.change_percentage.toFixed(2) + '%' : '—'}</td>
                    <td align="right">${gainer.price !== null ? gainer.price.toFixed(2) : '—'}</td>
                    <td align="right">${formatVolume(gainer.volume)}</td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    function requestNewTicker(ticker) {
        if (!ticker) {
            console.warn(getTimestamp(), 'No ticker provided for request');
            $('#errorMessage').text('Please enter a valid ticker symbol').show();
            return;
        }
        console.log(getTimestamp(), 'Requesting new ticker:', ticker);
        $('#tickerLoaderModal').css({ display: 'block', zIndex: 1000 });
        $('#errorMessage').hide();
        chartData = [];
        if (plotlyLoaded && chartInstance) {
            const emptyLayout = {
                ...initialLayout,
                annotations: [],
                shapes: []
            };
            Plotly.newPlot('plotlyChart', [], emptyLayout).then(() => {
                console.log(getTimestamp(), 'Chart cleared for new ticker');
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to clear chart:', err);
            });
        }
        isDataLoaded = false;
        updateToolbarState();
        updateTickerInfo('Loading...', [], {});
        $('#trade-tracker').html('<span style="color: #aaaaaa; font-size: 12px;">No active buy</span>');
        currentTicker = ticker;
        socket.emit('request_ticker_data', { ticker: ticker });
        startDataTimeout(ticker);
    }

    $('.tab-button').on('click', function() {
        const tabId = $(this).data('tab');
        $('.tab-button').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');
    });

    $(document).on('click', '.gainer-row', function() {
        const ticker = $(this).data('ticker');
        if (!ticker || ticker === 'Unknown') {
            console.warn(getTimestamp(), 'No valid ticker selected from gainer row');
            $('#errorMessage').text('Invalid ticker selected').show();
            return;
        }
        $('#tickerInput').val(ticker);
        requestNewTicker(ticker);
    });

    $(document).on('click', '.unique-tickers-link', function() {
        $('#uniqueTickersModal').show();
        $('#tickersLoader').show();
        $('#uniqueTickersList').empty();
        miscSocket.emit('request_unique_tickers', {});
    });

    $(document).on('click', '#uniqueTickersModal .close-panel', function() {
        $('#uniqueTickersModal').hide();
        $('#uniqueTickersList').empty();
    });
});