function toggleSignals() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle signals: no data loaded');
            return;
        }
        showSignals = !showSignals;
        console.log(getTimestamp(), 'Toggling signals to:', showSignals);
        const $button = $('#toggleSignalsButton');
        if (showSignals) {
            $button.addClass('active').attr('title', 'Hide Buy/Sell Signals');
        } else {
            $button.removeClass('active').attr('title', 'Show Buy/Sell Signals');
        }
        if (chartInstance && chartData.length > 0) {
            const annotations = [
                ...(showSignals ? getSignalAnnotations(chartData) : []),
                ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
            ];
            // Updated: Use getAllShapes for consistent shapes (including sessions if shown)
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Plotly.relayout('plotlyChart', { 
                annotations: annotations,
                shapes: shapes,
                uirevision: 'custom-revision-key'
            }).then(() => {
                console.log(getTimestamp(), 'Signal visibility updated');
                isRelayoutInProgress = false;
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to update signals:', err);
                $('#errorMessage').text(`Failed to update signals: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in toggleSignals:', err);
        $('#errorMessage').text(`Error toggling signals: ${err.message || 'Unknown error'}`).show();
    }
}

function togglePriceLine() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle price line: no data loaded');
            return;
        }
        showPriceLine = !showPriceLine;
        console.log(getTimestamp(), 'Toggling price line to:', showPriceLine);
        const $button = $('#togglePriceLineButton');
        if (showPriceLine) {
            $button.addClass('active').attr('title', 'Hide Price Line');
        } else {
            $button.removeClass('active').attr('title', 'Show Price Line');
        }
        if (chartInstance && chartData.length > 0) {
            const annotations = [
                ...(showSignals ? getSignalAnnotations(chartData) : []),
                ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
            ];
            // Updated: Use getAllShapes instead of just getPriceLineShape
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Plotly.relayout('plotlyChart', { 
                annotations: annotations,
                shapes: shapes,
                uirevision: 'custom-revision-key'
            }).then(() => {
                console.log(getTimestamp(), 'Price line visibility updated');
                isRelayoutInProgress = false;
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to update price line:', err);
                $('#errorMessage').text(`Failed to update price line: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in togglePriceLine:', err);
        $('#errorMessage').text(`Error toggling price line: ${err.message || 'Unknown error'}`).show();
    }
}

function toggleClassificationAnnotations() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle classification annotations: no data loaded');
            return;
        }
        showClassificationAnnotations = !showClassificationAnnotations;
        console.log(getTimestamp(), 'Toggling classification annotations to:', showClassificationAnnotations);
        const $button = $('#toggleClassificationsButton');
        if (showClassificationAnnotations) {
            $button.addClass('active').attr('title', 'Hide Saved Patterns');
        } else {
            $button.removeClass('active').attr('title', 'Show Saved Patterns');
        }
        if (chartInstance && chartData.length > 0) {
            const annotations = [
                ...(showSignals ? getSignalAnnotations(chartData) : []),
                ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
            ];
            // Updated: Use getAllShapes instead of getPriceLineShape
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Plotly.relayout('plotlyChart', { 
                annotations: annotations,
                shapes: shapes,
                uirevision: 'custom-revision-key'
            }).then(() => {
                console.log(getTimestamp(), 'Classification annotations and price line updated');
                isRelayoutInProgress = false;
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to update annotations or price line:', err);
                $('#errorMessage').text(`Failed to update annotations: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in toggleClassificationAnnotations:', err);
        $('#errorMessage').text(`Error toggling classification annotations: ${err.message || 'Unknown error'}`).show();
    }
}

function toggleMomentumPPO() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle momentum PPO: no data loaded');
            return;
        }
        showMomentumPPO = !showMomentumPPO;
        console.log(getTimestamp(), 'Toggling momentum PPO to:', showMomentumPPO);
        const $button = $('#toggleMomentumPPOButton');
        if (showMomentumPPO) {
            $button.addClass('active').attr('title', 'Hide Momentum PPO');
        } else {
            $button.removeClass('active').attr('title', 'Show Momentum PPO');
        }
        // Redraw the main chart to add/remove PPO overlay
        if (chartData.length > 0) {
            updateChart(chartData, 'plotlyChart');
        } else {
            console.warn(getTimestamp(), 'No chart data available for PPO toggle');
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in toggleMomentumPPO:', err);
        $('#errorMessage').text(`Error toggling momentum PPO: ${err.message || 'Unknown error'}`).show();
    }
}

// New: Toggle function for session backgrounds
function toggleSessions() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle session backgrounds: no data loaded');
            return;
        }
        showSessions = !showSessions;
        console.log(getTimestamp(), 'Toggling session backgrounds to:', showSessions);
        const $button = $('#toggleSessionsButton');
        if (showSessions) {
            $button.addClass('active').attr('title', 'Hide Session Backgrounds');
        } else {
            $button.removeClass('active').attr('title', 'Show Session Backgrounds');
        }
        if (chartInstance && chartData.length > 0) {
            const annotations = [
                ...(showSignals ? getSignalAnnotations(chartData) : []),
                ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
            ];
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Plotly.relayout('plotlyChart', { 
                annotations: annotations,
                shapes: shapes,
                uirevision: 'custom-revision-key'
            }).then(() => {
                console.log(getTimestamp(), 'Session backgrounds visibility updated');
                isRelayoutInProgress = false;
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to update session backgrounds:', err);
                $('#errorMessage').text(`Failed to update session backgrounds: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in toggleSessions:', err);
        $('#errorMessage').text(`Error toggling session backgrounds: ${err.message || 'Unknown error'}`).show();
    }
}

function exitPatternSelectionMode() {
    try {
        console.log(getTimestamp(), 'Exiting pattern selection mode');
        patternSelectionMode = false;
        pauseChartUpdates = false;
        $('#togglePatternButton').removeClass('active').attr('title', 'Toggle Pattern Selection');
        lastSelectionRange = null;
        $('#preds').text('');
        if (chartInstance) {
            const layout = chartInstance.layout || {};
            currentRanges.xaxis = layout.xaxis?.range || null;
            currentRanges.yaxis = layout.yaxis?.range || null;
            console.log(getTimestamp(), 'Stored ranges:', currentRanges);
            // Updated: Use getAllShapes
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Promise.all([
                Plotly.restyle('plotlyChart', { selectedpoints: null, opacity: 1 }, [0, 1, 2, 3]),
                Plotly.relayout('plotlyChart', {
                    dragmode: 'zoom',
                    'xaxis.range': currentRanges.xaxis,
                    'yaxis.range': currentRanges.yaxis,
                    shapes: shapes,
                    annotations: [
                        ...getSignalAnnotations(chartData),
                        ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
                    ],
                    uirevision: 'custom-revision-key'
                })
            ]).then(() => {
                console.log(getTimestamp(), 'Chart successfully reset to zoom mode');
                isRelayoutInProgress = false;
                if (currentTicker) {
                    console.log(getTimestamp(), 'Requesting updated ticker data after exiting pattern selection:', currentTicker);
                    socket.emit('request_ticker_data', { ticker: currentTicker });
                    startDataTimeout(currentTicker);
                }
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to reset chart:', err);
                $('#errorMessage').text(`Failed to reset chart: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        } else if (currentTicker) {
            console.log(getTimestamp(), 'Requesting ticker data for:', currentTicker);
            socket.emit('request_ticker_data', { ticker: currentTicker });
            startDataTimeout(currentTicker);
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in exitPatternSelectionMode:', err);
        $('#errorMessage').text(`Error exiting pattern selection mode: ${err.message || 'Unknown error'}`).show();
        isRelayoutInProgress = false;
    }
}

function togglePatternSelectionMode() {
    try {
        if (!isDataLoaded) {
            console.warn(getTimestamp(), 'Cannot toggle pattern selection: no data loaded');
            return;
        }
        patternSelectionMode = !patternSelectionMode;
        pauseChartUpdates = patternSelectionMode;
        console.log(getTimestamp(), 'Toggling pattern selection mode to:', patternSelectionMode, 'pauseChartUpdates:', pauseChartUpdates);
        const $button = $('#togglePatternButton');
        if (patternSelectionMode) {
            $button.addClass('active').attr('title', 'Exit Pattern Selection');
            if (chartInstance && chartData.length > 0) {
                // Updated: Use getAllShapes
                const shapes = getAllShapes(chartData);
                if (isRelayoutInProgress) {
                    console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                    return;
                }
                isRelayoutInProgress = true;
                Plotly.relayout('plotlyChart', { 
                    dragmode: 'select',
                    shapes: shapes,
                    uirevision: 'custom-revision-key'
                }).then(() => {
                    console.log(getTimestamp(), 'Dragmode set to select');
                    lastSelectionRange = null;
                    isRelayoutInProgress = false;
                }).catch(err => {
                    console.error(getTimestamp(), 'Failed to set dragmode to select:', err);
                    $('#errorMessage').text(`Failed to set selection mode: ${err.message || 'Unknown error'}`).show();
                    isRelayoutInProgress = false;
                });
            }
        } else {
            exitPatternSelectionMode();
        }
    } catch (err) {
        console.error(getTimestamp(), 'Error in togglePatternSelectionMode:', err);
        $('#errorMessage').text(`Error toggling pattern selection mode: ${err.message || 'Unknown error'}`).show();
    }
}

function handleSelection(eventData) {
    console.log(getTimestamp(), 'Handling selection:', eventData);
    if (!patternSelectionMode) {
        console.warn(getTimestamp(), 'Selection ignored: not in pattern selection mode');
        return;
    }

    let selectedDatetimes = [];
    let selectedIndices = [];
    if (eventData.range && eventData.range.x && chartData.length > 0) {
        const [startDate, endDate] = eventData.range.x;
        lastSelectionRange = [startDate, endDate];
        console.log(getTimestamp(), 'Selection range:', { startDate, endDate });
        selectedDatetimes = chartData
            .map((item, index) => ({ timestamp: item.timestamp, index }))
            .filter(({ timestamp }) => {
                const itemDate = new Date(timestamp);
                return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
            })
            .map(({ timestamp, index }) => ({ timestamp, index }));
        selectedIndices = selectedDatetimes.map(item => item.index);
    } else {
        console.warn(getTimestamp(), 'No valid range for selection');
    }

    $('#predsLoader').hide();
    $('#preds').text('');

    if (selectedDatetimes.length >= 1) {
        const validIndices = selectedIndices.filter(index => index >= pattern_length - 1);
        if (validIndices.length === 0) {
            console.warn(getTimestamp(), `No selected candlesticks can form a pattern; need indices >= ${pattern_length - 1}`);
            $('#errorMessage').text(`Select candlesticks with indices >= ${pattern_length - 1} to include ${pattern_length} candlesticks`).show();
            exitPatternSelectionMode();
            return;
        }
        console.log(getTimestamp(), 'Showing modal, selected candlesticks:', validIndices.length);
        $('#modalMessage').text(`Process ${validIndices.length} pattern${validIndices.length > 1 ? 's' : ''}?`);
        $('#selectionModal').css({ display: 'block', zIndex: 1000 });
        $('input[name="patternType"]').prop('checked', false);
        $('.progress-container').hide();
        $('#progressBar').css('width', '0%').text('0%');
        $('#validationErrors').hide().empty();
        $('#sendPatternsBtn').prop('disabled', false);
    } else {
        console.warn(getTimestamp(), 'No candlesticks selected');
        $('#errorMessage').text('Select at least 1 candlestick').show();
        exitPatternSelectionMode();
    }
}

// New: Function to toggle the settings panel
function toggleSettingsPanel() {
    $('#settingsPanel').toggleClass('open');
    if ($('#settingsPanel').hasClass('open')) {
        populateSettingsPanel(); // Populate settings when opening the panel
    }
}

function setupEventListeners() {
    console.log(getTimestamp(), 'Setting up event listeners');
    if (chartInstance) {
        chartInstance.removeAllListeners('plotly_selecting');
        chartInstance.removeAllListeners('plotly_selected');
        chartInstance.removeAllListeners('plotly_relayout');
        let lastSelectionUpdate = 0;
        const debounceDelay = 100;
        chartInstance.on('plotly_selecting', function(eventData) {
            console.log(getTimestamp(), 'plotly_selecting event:', eventData);
            if (patternSelectionMode && eventData.range && eventData.range.x) {
                const now = Date.now();
                if (now - lastSelectionUpdate < debounceDelay) {
                    console.log(getTimestamp(), 'Debouncing plotly_selecting');
                    return;
                }
                lastSelectionUpdate = now;
                const [startDate, endDate] = eventData.range.x;
                const startIndex = chartData.findIndex(item => new Date(item.timestamp) >= new Date(startDate));
                if (startIndex < pattern_length - 1) {
                    console.warn(getTimestamp(), `Selection starts too early at index ${startIndex}; need at least ${pattern_length} candlesticks`);
                    $('#errorMessage').text(`Selection starts too early; select candlesticks with indices >= ${pattern_length - 1}`).show();
                    if (!isRelayoutInProgress) {
                        isRelayoutInProgress = true;
                        // Updated: Use getAllShapes
                        Plotly.relayout('plotlyChart', { shapes: getAllShapes(chartData) }).then(() => {
                            isRelayoutInProgress = false;
                        }).catch(err => {
                            console.error(getTimestamp(), 'Failed to clear selection shape:', err);
                            $('#errorMessage').text(`Failed to clear selection shape: ${err.message || 'Unknown error'}`).show();
                            isRelayoutInProgress = false;
                        });
                    }
                    return;
                }
                lastSelectionRange = [startDate, endDate];
                console.log(getTimestamp(), 'Selection range captured:', lastSelectionRange);
                $('#predsLoader').show();
                // Updated: Use getAllShapes
                const shapes = getAllShapes(chartData);
                if (isRelayoutInProgress) {
                    console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                    return;
                }
                isRelayoutInProgress = true;
                Plotly.relayout('plotlyChart', {
                    shapes: shapes,
                    annotations: [
                        ...getSignalAnnotations(chartData),
                        ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
                    ]
                }).then(() => {
                    console.log(getTimestamp(), 'Selection shape and price line updated');
                    isRelayoutInProgress = false;
                }).catch(err => {
                    console.error(getTimestamp(), 'Failed to add selection shape:', err);
                    $('#errorMessage').text(`Failed to add selection shape: ${err.message || 'Unknown error'}`).show();
                    isRelayoutInProgress = false;
                });
            }
        });
        chartInstance.on('plotly_selected', function(eventData) {
            console.log(getTimestamp(), 'plotly_selected event:', eventData);
            if (patternSelectionMode) {
                handleSelection(eventData);
            } else {
                console.warn(getTimestamp(), 'Selection ignored: not in pattern selection mode');
            }
        });
        chartInstance.on('plotly_relayout', function(eventData) {
            console.log(getTimestamp(), 'plotly_relayout event:', eventData);
            if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
                currentRanges.xaxis = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
                if (ppoChartInstance && showMomentumPPO) {
                    console.log(getTimestamp(), 'Syncing PPO chart x-axis range:', currentRanges.xaxis);
                    Plotly.relayout('ppoChart', {
                        'xaxis.range': currentRanges.xaxis
                    }).catch(err => {
                        console.error(getTimestamp(), 'Failed to sync PPO chart x-axis:', err);
                    });
                }
            }
            if (eventData['yaxis.range[0]'] && eventData['yaxis.range[1]']) {
                currentRanges.yaxis = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
            }
            console.log(getTimestamp(), 'Updated currentRanges:', currentRanges);
            // Updated: Use getAllShapes
            const shapes = getAllShapes(chartData);
            if (isRelayoutInProgress) {
                console.log(getTimestamp(), 'Skipping relayout due to in-progress relayout');
                return;
            }
            isRelayoutInProgress = true;
            Plotly.relayout('plotlyChart', {
                shapes: shapes,
                annotations: [
                    ...getSignalAnnotations(chartData),
                    ...(showClassificationAnnotations ? getClassificationAnnotations(chartData) : [])
                ]
            }).then(() => {
                console.log(getTimestamp(), 'Shapes and annotations updated on relayout');
                isRelayoutInProgress = false;
            }).catch(err => {
                console.error(getTimestamp(), 'Failed to update shapes on relayout:', err);
                $('#errorMessage').text(`Failed to update shapes: ${err.message || 'Unknown error'}`).show();
                isRelayoutInProgress = false;
            });
        });
    }
    
    // NEW: User menu and settings handlers
    $('#userMenuButton').on('click', function(e) {
        e.stopPropagation();
        toggleSettingsPanel();
    });

    // Close panel on outside click
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#userMenuButton, #settingsPanel').length && $('#settingsPanel').hasClass('open')) {
            $('#settingsPanel').removeClass('open');
        }
    });

    // Close button in panel
    $('.close-panel').on('click', function() {
        $('#settingsPanel').removeClass('open');
    });

    // Tab switching
    $('.settings-tabs .tab-button').on('click', function() {
        const tabId = $(this).data('tab');
        $('.settings-tabs .tab-button').removeClass('active');
        $(this).addClass('active');
        $('.settings-tabs .tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');
    });
}