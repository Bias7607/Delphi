function getTimestamp() {
    return new Date().toISOString();
}

function formatDate(timestamp) {
    try {
        const date = new Date(parseInt(timestamp));
        if (isNaN(date.getTime())) {
            throw new Error('Invalid timestamp');
        }
        return date.getFullYear() + '-' +
               String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0') + ' ' +
               String(date.getHours()).padStart(2, '0') + ':' +
               String(date.getMinutes()).padStart(2, '0') + ':' +
               String(date.getSeconds()).padStart(2, '0');
    } catch (err) {
        console.warn(getTimestamp(), `Error formatting timestamp ${timestamp}: ${err.message}`);
        return null;
    }
}

function validateDate(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime()) || dateStr.match(/NaN/)) {
            throw new Error('Invalid date string');
        }
        return dateStr;
    } catch (err) {
        console.warn(getTimestamp(), `Invalid date string ${dateStr}: ${err.message}`);
        return null;
    }
}

function validatePattern(pattern, patternIndex) {
    const missingFeatures = [];
    pattern.forEach((candle, candleIndex) => {
        if (!candle || !candle.Date || validateDate(candle.Date) === null) {
            missingFeatures.push(`Invalid or missing Date at candle ${candleIndex} (Date: ${candle?.Date || 'undefined'})`);
        }
        TA_FEATURES.forEach(feature => {
            if (candle && (candle[feature] === null || candle[feature] === undefined || isNaN(candle[feature]))) {
                missingFeatures.push(`Invalid ${feature} at candle ${candleIndex} (Value: ${candle[feature]})`);
            }
        });
    });
    if (missingFeatures.length > 0) {
        console.warn(getTimestamp(), `Issues in pattern ${patternIndex}: ${missingFeatures.join(', ')}`);
        return { valid: false, errors: missingFeatures };
    }
    return { valid: true, errors: [] };
}