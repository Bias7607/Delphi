function updateConnectionStatus(namespace, status) {
    console.log(getTimestamp(), `Updating ${namespace} status to: ${status}`);
    if (namespace === 'data') {
        dataStatus = status;
    } else if (namespace === 'train') {
        trainStatus = status;
    } else if (namespace === 'misc') {
        miscStatus = status;
    }
    const colorData = dataStatus === 'connected' ? '#00cc00' : '#ff3333';
    const colorTrain = trainStatus === 'connected' ? '#00cc00' : '#ff3333';
    const colorMisc = miscStatus === 'connected' ? '#00cc00' : '#ff3333';
    $('#connectionStatus').css('background', `conic-gradient(${colorData} 0deg 120deg, ${colorTrain} 120deg 240deg, ${colorMisc} 240deg 360deg)`);
}

function updateToolbarState() {
    console.log(getTimestamp(), `Updating toolbar state, isDataLoaded: ${isDataLoaded}`);
    $('#chartToolbar i').each(function() {
        if (isDataLoaded) {
            $(this).removeClass('disabled');
        } else {
            $(this).addClass('disabled');
        }
    });
    $('#togglePriceLineButton').toggleClass('active', showPriceLine);
    $('#toggleMomentumPPOButton').toggleClass('active', showMomentumPPO);
    $('#toggleSignalsButton').toggleClass('active', showSignals);
    // New: Toggle class for session backgrounds
    $('#toggleSessionsButton').toggleClass('active', showSessions);
}

// ui.js updates (replace updateTickerInfo function)

function updateTickerInfo(ticker, candleData, info = {}) {
    console.log(getTimestamp(), 'Updating tickerInfo UI for:', ticker, 'with info:', info);
    $('.ticker-symbol').text(ticker || 'No Ticker Selected');
    $('.ticker-name').text(info.longName || info.shortName || '');
    
    if (candleData && candleData.length > 0) {
        const lastCandle = candleData[candleData.length - 1];
        const lastClose = parseFloat(lastCandle.close);
        $('#currentPrice').text(isNaN(lastClose) ? 'N/A' : `$${lastClose.toFixed(2)}`);

        // New: Compute total normal-hours volume for the day (exclude pre/aftermarket)
        let dayVolume = 0;
        candleData.forEach(candle => {
            const candleTime = new Date(candle.timestamp);  // ms timestamp
            const utcHour = candleTime.getUTCHours() + candleTime.getUTCMinutes() / 60;
            if (utcHour >= 15.5 && utcHour < 22) {  // Normal: 15:30-22:00 UTC (~9:30-16:00 ET)
                dayVolume += candle.volume || 0;
            }
        });
        $('#currentVolume').text(dayVolume ? dayVolume.toLocaleString() : 'N/A');
    } else {
        $('#currentPrice').text('N/A');
        $('#currentVolume').text('N/A');
    }
    
    // Updated: Bid/Ask with sizes
    const bidAskText = (info.bid && info.ask && info.bidSize && info.askSize) 
        ? `${info.bid.toFixed(2)} x ${info.bidSize} / ${info.ask.toFixed(2)} x ${info.askSize}` 
        : 'N/A';
    $('#bidAsk').text(bidAskText);
    
    $('#sector').text(info.sector || 'N/A').toggleClass('na', !info.sector);
    $('#industry').text(info.industry || 'N/A').toggleClass('na', !info.industry);
    $('#country').text(info.country || 'N/A').toggleClass('na', !info.country);
    $('#exchange').text(info.exchange || 'N/A').toggleClass('na', !info.exchange);
    // $('#market').text(info.market || 'N/A').toggleClass('na', !info.market); // Assuming not in info
    $('#quoteType').text(info.quoteType || 'N/A').toggleClass('na', !info.quoteType);
    $('#currency').text(info.currency || 'N/A').toggleClass('na', !info.currency);
    $('#previousClose').text(info.previousClose != null ? info.previousClose.toFixed(2) : 'N/A').toggleClass('na', info.previousClose == null);
    $('#open').text(info.open != null ? info.open.toFixed(2) : 'N/A').toggleClass('na', info.open == null);
    $('#dayHigh').text(info.dayHigh != null ? info.dayHigh.toFixed(2) : 'N/A').toggleClass('na', info.dayHigh == null);
    $('#dayLow').text(info.dayLow != null ? info.dayLow.toFixed(2) : 'N/A').toggleClass('na', info.dayLow == null);
    $('#averageVolume').text(info.averageVolume ? info.averageVolume.toLocaleString() : 'N/A').toggleClass('na', !info.averageVolume);
    $('#bidSize').text(info.bidSize || 'N/A').toggleClass('na', !info.bidSize);
    $('#askSize').text(info.askSize || 'N/A').toggleClass('na', !info.askSize);
    $('#beta').text(info.beta != null ? info.beta.toFixed(2) : 'N/A').toggleClass('na', info.beta == null);
}
function resetModalAndUI() {
    try {
        console.log(getTimestamp(), 'Resetting modal and UI');
        $('.progress-container').hide();
        $('#progressBar').css('width', '0%').text('0%');
        $('#selectionModal').hide();
        $('#tickerLoaderModal').hide();
        $('#validationErrors').hide().empty();
        $('#sendPatternsBtn').prop('disabled', false);
        $('#errorMessage').hide();
        pauseChartUpdates = false;
        exitPatternSelectionMode();
    } catch (err) {
        console.error(getTimestamp(), 'Error in resetModalAndUI:', err);
        $('#errorMessage').text(`Error resetting UI: ${err.message || 'Unknown error'}`).show();
        exitPatternSelectionMode();
    }
}

function startDataTimeout(ticker) {
    clearTimeout(dataTimeout);
    dataTimeout = setTimeout(() => {
        console.warn(getTimestamp(), `Timeout waiting for ticker_data for ${ticker}`);
        $('#tickerLoaderModal').hide();
        $('#errorMessage').text(`No data received for ${ticker}`).show();
        isDataLoaded = false;
        updateToolbarState();
    }, dataTimeoutMs);
}