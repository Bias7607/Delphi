function getTimestamp() {
    return new Date().toISOString();
}

// Load settings from LocalStorage or use defaults
function loadSettings() {
    try {
        const stored = localStorage.getItem('delphiSettings');
        const defaults = {
            version: 1,
            safeBuyThreshold: 50,
            colors: { up: '#00ff00', down: '#ff0000', neutral: '#d3d3d3', ppoLine: '#00ff00' },
            chartDefaults: { 
                showSessions: true, 
                showSignals: true, 
                showPriceLine: true, 
                showMomentumPPO: true, 
                colorByPredictions: true 
            },
            signalOptions: { probThreshold: 0.7, confirmationCandles: 1 }
        };
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge stored settings with defaults to handle new fields
            return {
                ...defaults,
                ...parsed,
                colors: { ...defaults.colors, ...parsed.colors },
                chartDefaults: { ...defaults.chartDefaults, ...parsed.chartDefaults },
                signalOptions: { ...defaults.signalOptions, ...parsed.signalOptions }
            };
        }
        return defaults;
    } catch (err) {
        console.error(getTimestamp(), 'Error loading settings:', err);
        return {
            version: 1,
            safeBuyThreshold: 50,
            colors: { up: '#00ff00', down: '#ff0000', neutral: '#d3d3d3', ppoLine: '#00ff00' },
            chartDefaults: { 
                showSessions: true, 
                showSignals: true, 
                showPriceLine: true, 
                showMomentumPPO: true, 
                colorByPredictions: true 
            },
            signalOptions: { probThreshold: 0.7, confirmationCandles: 1 }
        };
    }
}

// Save settings to LocalStorage
function saveSettings() {
    try {
        localStorage.setItem('delphiSettings', JSON.stringify(appSettings));
        console.log(getTimestamp(), 'Settings saved:', appSettings);
    } catch (err) {
        console.error(getTimestamp(), 'Error saving settings:', err);
        $('#errorMessage').text(`Error saving settings: ${err.message || 'Unknown error'}`).show();
    }
}

// Apply settings to UI, global state, chart, and backend
function applySettings() {
    try {
        console.log(getTimestamp(), 'Applying settings:', appSettings);
        
        // Update global state
        showSessions = appSettings.chartDefaults.showSessions;
        showSignals = appSettings.chartDefaults.showSignals;
        showPriceLine = appSettings.chartDefaults.showPriceLine;
        showMomentumPPO = appSettings.chartDefaults.showMomentumPPO;
        colorByPredictions = appSettings.chartDefaults.colorByPredictions;

        // Update CSS variables
        $(':root').css({
            '--color-up': appSettings.colors.up,
            '--color-down': appSettings.colors.down,
            '--color-neutral': appSettings.colors.neutral,
            '--color-ppo': appSettings.colors.ppoLine
        });

        // Update toolbar state
        updateToolbarState();

        // Send signal settings to backend
        if (currentTicker && socket) {
            socket.emit('request_ticker_data', { 
                ticker: currentTicker, 
                settings: { 
                    safeBuyThreshold: appSettings.safeBuyThreshold,
                    probThreshold: appSettings.signalOptions.probThreshold,
                    confirmationCandles: appSettings.signalOptions.confirmationCandles
                } 
            });
            console.log(getTimestamp(), 'Sent signal settings to backend for ticker:', currentTicker);
        }

        // Redraw chart if data is loaded
        if (chartData.length > 0 && plotlyLoaded) {
            console.log(getTimestamp(), 'Redrawing chart with new settings');
            updateChart(chartData, 'plotlyChart');
        } else {
            console.warn(getTimestamp(), 'No chart data or Plotly not loaded; settings applied but chart not redrawn');
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error applying settings:', err);
        $('#errorMessage').text(`Error applying settings: ${err.message || 'Unknown error'}`).show();
    }
}

// Populate settings panel with current values and attach event listeners
function populateSettingsPanel() {
    try {
        console.log(getTimestamp(), 'Populating settings panel with:', appSettings);

        // Chart defaults
        $('#showSessionsDefault').prop('checked', appSettings.chartDefaults.showSessions).off('change').on('change', function() {
            appSettings.chartDefaults.showSessions = $(this).prop('checked');
            saveSettings();
            applySettings();
        });

        $('#showSignalsDefault').prop('checked', appSettings.chartDefaults.showSignals).off('change').on('change', function() {
            appSettings.chartDefaults.showSignals = $(this).prop('checked');
            saveSettings();
            applySettings();
        });

        $('#showPriceLineDefault').prop('checked', appSettings.chartDefaults.showPriceLine).off('change').on('change', function() {
            appSettings.chartDefaults.showPriceLine = $(this).prop('checked');
            saveSettings();
            applySettings();
        });

        $('#showMomentumPPODefault').prop('checked', appSettings.chartDefaults.showMomentumPPO).off('change').on('change', function() {
            appSettings.chartDefaults.showMomentumPPO = $(this).prop('checked');
            saveSettings();
            applySettings();
        });

        $('#colorByPredictionsDefault').prop('checked', appSettings.chartDefaults.colorByPredictions).off('change').on('change', function() {
            appSettings.chartDefaults.colorByPredictions = $(this).prop('checked');
            saveSettings();
            applySettings();
            console.log(getTimestamp(), 'Color by predictions set to:', appSettings.chartDefaults.colorByPredictions);
        });

        // Colors (updated to 'input change' for real-time updates)
        $('#colorUp').val(appSettings.colors.up).off('input change').on('input change', function() {
            appSettings.colors.up = $(this).val();
            saveSettings();
            applySettings();
        });

        $('#colorDown').val(appSettings.colors.down).off('input change').on('input change', function() {
            appSettings.colors.down = $(this).val();
            saveSettings();
            applySettings();
        });

        $('#colorNeutral').val(appSettings.colors.neutral).off('input change').on('input change', function() {
            appSettings.colors.neutral = $(this).val();
            saveSettings();
            applySettings();
        });

        $('#colorPpoLine').val(appSettings.colors.ppoLine).off('input change').on('input change', function() {
            appSettings.colors.ppoLine = $(this).val();
            saveSettings();
            applySettings();
        });

        // Signal options
        $('#safeBuyThreshold').val(appSettings.safeBuyThreshold).off('input change').on('input', function() {
            $('#safeBuyValue').text($(this).val());
        }).on('change', function() {
            appSettings.safeBuyThreshold = parseInt($(this).val(), 10);
            saveSettings();
            applySettings();
        });

        $('#probThreshold').val(appSettings.signalOptions.probThreshold).off('input change').on('input', function() {
            $('#probValue').text($(this).val());
        }).on('change', function() {
            appSettings.signalOptions.probThreshold = parseFloat($(this).val());
            saveSettings();
            applySettings();
        });

        $('#confirmationCandles').val(appSettings.signalOptions.confirmationCandles).off('change').on('change', function() {
            appSettings.signalOptions.confirmationCandles = parseInt($(this).val(), 10);
            saveSettings();
            applySettings();
        });

        // Update displayed values
        $('#safeBuyValue').text(appSettings.safeBuyThreshold);
        $('#probValue').text(appSettings.signalOptions.probThreshold);

    } catch (err) {
        console.error(getTimestamp(), 'Error populating settings panel:', err);
        $('#errorMessage').text(`Error populating settings: ${err.message || 'Unknown error'}`).show();
    }
}

// Initialize settings
let appSettings = loadSettings();
applySettings();