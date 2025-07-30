<?php
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delphi</title>
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"
            onerror="console.error('Socket.IO CDN failed, attempting local fallback'); this.onerror=null; this.src='/js/socket.io.min.js';"></script>
    <script src="https://cdn.plot.ly/plotly-3.0.1.min.js"
            onerror="console.error('Plotly CDN failed'); this.onerror=null;"></script>
</head>
<body>
    <div class="top-bar">
        <div class="logo-container">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" stroke="#3498db" stroke-width="2"/>
                <path d="M16 8L16 16L20 20" stroke="#3498db" stroke-width="2" stroke-linecap="round"/>
                <path d="M16 8C17.1046 8 18 8.89543 18 10C18 11.1046 17.1046 12 16 12C14.8954 12 14 11.1046 14 10C14 8.89543 14.8954 8 16 8Z" fill="#e0e0e0"/>
                <path d="M16 20C17.1046 20 18 20.8954 18 22C18 23.1046 17.1046 24 16 24C14.8954 24 14 23.1046 14 22C14 20.8954 14 20 16 20Z" fill="#e0e0e0"/>
            </svg>
            <span class="logo-text">Delphi</span>
        </div>
        <div class="ticker-input-wrapper"></div>
        <div id="connectionStatus"></div>
        <i class="fas fa-user" id="userMenuButton" title="User Menu" style="margin-left: 10px; cursor: pointer; color: #e0e0e0;"></i>
    </div>
    <div class="container">
        <div class="left-panel">
            <div class="ticker-input-container">
                <input type="text" id="tickerInput" placeholder="Enter ticker (e.g., AAPL)">
                <button id="addButton">Set Ticker</button>
            </div>
            <div class="tabs">
                <div class="tab-buttons">
                    <button class="tab-button active" data-tab="premarket">Premarket</button>
                    <button class="tab-button" data-tab="normal">Normal Hours</button>
                    <button class="tab-button" data-tab="aftermarket">Aftermarket</button>
                </div>
                <div class="tab-content active" id="premarket">
                    <div class="table-wrapper">
                        <table class="gainers-table">
                            <thead>
                                <tr>
                                    <th>Ticker</th>
                                    <th>Name</th>
                                    <th>%</th>
                                    <th>Price</th>
                                    <th>Volume</th>
                                </tr>
                            </thead>
                            <tbody id="premarket-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" id="normal">
                    <div class="table-wrapper">
                        <table class="gainers-table">
                            <thead>
                                <tr>
                                    <th>Ticker</th>
                                    <th>Name</th>
                                    <th>%</th>
                                    <th>Price</th>
                                    <th>Volume</th>
                                </tr>
                            </thead>
                            <tbody id="normal-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" id="aftermarket">
                    <div class="table-wrapper">
                        <table class="gainers-table">
                            <thead>
                                <tr>
                                    <th>Ticker</th>
                                    <th>Name</th>
                                    <th>%</th>
                                    <th>Price</th>
                                    <th>Volume</th>
                                </tr>
                            </thead>
                            <tbody id="aftermarket-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <div class="middle-panel">
            <div id="chartContainer">
                <div id="chartToolbar">
                    <i class="fas fa-hand-pointer disabled" id="togglePatternButton" title="Toggle Pattern Selection"></i>
                    <i class="fas fa-arrow-up disabled" id="toggleClassificationsButton" title="Toggle Saved Patterns"></i>
                    <i class="fas fa-ruler-horizontal active" id="togglePriceLineButton" title="Hide Price Line"></i>
                    <i class="fas fa-chart-line active" id="toggleMomentumPPOButton" title="Hide Momentum PPO"></i>
                    <i class="fas fa-bell active" id="toggleSignalsButton" title="Hide Buy/Sell Signals"></i>
                    <i class="fas fa-business-time active" id="toggleSessionsButton" title="Hide Session Backgrounds"></i>
                </div>
                <div id="errorMessage"></div>
                <div id="plotlyChart"></div>
                <div id="trade-tracker"></div>
            </div>
        </div>
        <div class="right-panel">
            <div id="tickerInfo">
                <div class="ticker-header">
                    <h3 class="ticker-symbol">No Ticker Selected</h3>
                    <p class="ticker-name"></p>
                </div>
                <div class="ticker-tabs">
                    <div class="ticker-tab-buttons">
                        <button class="ticker-tab-button active" data-tab="info">Info</button>
                        <button class="ticker-tab-button" data-tab="patterns">Patterns</button>
                    </div>
                    <div class="ticker-tab-content active" id="info">
                        <div class="ticker-section">
                            <h4 class="section-title"><i class="fas fa-chart-line"></i> Market Prices</h4>
                            <div class="ticker-metrics">
                                <div>
                                    <div class="label">Current Price</div>
                                    <div class="value" id="currentPrice">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Open</div>
                                    <div class="value" id="open">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Previous Close</div>
                                    <div class="value" id="previousClose">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Day High</div>
                                    <div class="value" id="dayHigh">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Day Low</div>
                                    <div class="value" id="dayLow">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Bid / Ask</div>
                                    <div class="value" id="bidAsk">N/A</div>
                                </div>
                            </div>
                        </div>
                        <div class="ticker-section">
                            <h4 class="section-title"><i class="fas fa-chart-bar"></i> Volume & Averages</h4>
                            <div class="ticker-metrics">
                                <div>
                                    <div class="label">Day Volume</div>
                                    <div class="value" id="currentVolume">N/A</div>
                                </div>
                                <div>
                                    <div class="label">Average Volume</div>
                                    <div class="value" id="averageVolume">N/A</div>
                                </div>
                            </div>
                        </div>
                        <div class="ticker-section">
                            <h4 class="section-title"><i class="fas fa-building"></i> Company Info</h4>
                            <dl class="ticker-details">
                                <dt>Sector</dt><dd id="sector" class="na">N/A</dd>
                                <dt>Industry</dt><dd id="industry" class="na">N/A</dd>
                                <dt>Country</dt><dd id="country" class="na">N/A</dd>
                                <dt>Exchange</dt><dd id="exchange" class="na">N/A</dd>
                                <dt>Market</dt><dd id="market" class="na">N/A</dd>
                                <dt>Quote Type</dt><dd id="quoteType" class="na">N/A</dd>
                                <dt>Currency</dt><dd id="currency" class="na">N/A</dd>
                            </dl>
                        </div>
                        <div class="ticker-section">
                            <h4 class="section-title"><i class="fas fa-chart-pie"></i> Advanced Stats</h4>
                            <dl class="ticker-details">
                                <dt>Bid Size</dt><dd id="bidSize" class="na">N/A</dd>
                                <dt>Ask Size</dt><dd id="askSize" class="na">N/A</dd>
                                <dt>Beta</dt><dd id="beta" class="na">N/A</dd>
                            </dl>
                        </div>
                        <ul id="selectedDatetimes"></ul>
                        <div id="preds" style="position:relative;">
                            <div class="loader" id="predsLoader"></div>
                        </div>
                    </div>
                    <div class="ticker-tab-content" id="patterns">
                        <div id="patterns-placeholder">Patterns coming soon!</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="bottom-panel"></div>
    <div id="selectionModal" class="modal">
        <div class="modal-content">
            <p id="modalMessage">Process selected pattern?</p>
            <div class="radio-group">
                <input type="radio" name="patternType" id="patternUp" value="1"><label for="patternUp"> Up</label>
                <input type="radio" name="patternType" id="patternDown" value="2"><label for="patternDown"> Down</label>
                <input type="radio" name="patternType" id="patternNeutral" value="3"><label for="patternNeutral"> Neutral</label>
            </div>
            <div class="progress-container">
                <div class="progress-bar" id="progressBar">0%</div>
            </div>
            <div id="validationErrors"></div>
            <div class="modal-buttons">
                <button id="sendPatternsBtn">Send Patterns</button>
                <button id="cancelBtn">Cancel</button>
            </div>
        </div>
    </div>
    <div id="tickerLoaderModal" class="modal">
        <div class="modal-content">
            <div class="loader-spinner"></div>
            <p class="loader-text">Loading ticker data...</p>
        </div>
    </div>
    <div id="uniqueTickersModal" class="modal" style="display: none; width: 50vw; height: 90vh; left: 25vw; top: 5vh; background-color: #2a2a2a; border: 1px solid #4a4a4a; border-radius: 5px; overflow: hidden; position: fixed; z-index: 1001;">

        <div class="modal-content" style="height: 100%; position: relative; padding: 0;">
            <i class="fas fa-times close-panel" style="position: absolute; top: 10px; right: 10px; cursor: pointer; color: #e0e0e0; z-index: 1002;"></i>
            <div id="tickersLoader" class="loader-spinner" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: none;"></div>
            <div id="uniqueTickersList" style="height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box;">
                <!-- List will be populated here -->
            </div>
        </div>
    </div>
    <div id="settingsPanel" class="settings-panel">
        <i class="fas fa-times close-panel" style="position: absolute; top: 10px; right: 10px; cursor: pointer; color: #e0e0e0;"></i>
        <div class="settings-content">
            <h2>User Settings</h2>
            <div class="settings-tabs">
                <ul class="tab-buttons">
                    <li class="tab-button active" data-tab="general">General</li>
                    <li class="tab-button" data-tab="account">Account</li>
                    <li class="tab-button" data-tab="chart">Chart</li>
                    <li class="tab-button" data-tab="signals">Signals</li>
                </ul>
                <div class="tab-content active" id="general">
                    <p>General app settings (e.g., theme, units) coming soon.</p>
                </div>
                <div class="tab-content" id="account">
                    <p>Account settings coming soon.</p>
                </div>
                <div class="tab-content" id="chart">
                    <h3>Chart Defaults</h3>
                    <label><input type="checkbox" id="showSessionsDefault"> Show Session Backgrounds</label><br>
                    <label><input type="checkbox" id="showSignalsDefault"> Show Buy/Sell Signals</label><br>
                    <label><input type="checkbox" id="showPriceLineDefault"> Show Price Line</label><br>
                    <label><input type="checkbox" id="showMomentumPPODefault"> Show Momentum PPO</label><br>
                    <label><input type="checkbox" id="colorByPredictionsDefault"> Color Candlesticks by Predictions</label><br>
                    <h3>Colors</h3>
                    <label>Up: <input type="color" id="colorUp"></label><br>
                    <label>Down: <input type="color" id="colorDown"></label><br>
                    <label>Neutral: <input type="color" id="colorNeutral"></label><br>
                    <label>PPO Line: <input type="color" id="colorPpoLine"></label><br>
                </div>
                <div class="tab-content" id="signals">
                    <h3>Signal Options</h3>
                    <label>Safe Buy Threshold (CPP > X): <input type="range" id="safeBuyThreshold" min="0" max="100" step="1"><span id="safeBuyValue">50</span></label><br>
                    <label>Prediction Probability Threshold: <input type="range" id="probThreshold" min="0" max="1" step="0.05"><span id="probValue">0.7</span></label><br>
                    <label>Confirmation Candles for Buy: <input type="number" id="confirmationCandles" min="1" max="5" step="1"></label><br>
                </div>
            </div>
        </div>
    </div>
    <script src="js/main.js"></script>
    <script src="js/utils.js"></script>
    <script src="js/ui.js"></script>
    <script src="js/chart.js"></script>
    <script src="js/events.js"></script>
    <script src="js/sockets.js"></script>
    <script src="js/settings.js"></script>
    <script>
        $(document).ready(function() {
            $('.ticker-tab-button').on('click', function() {
                const tabId = $(this).data('tab');
                $('.ticker-tab-button').removeClass('active');
                $(this).addClass('active');
                $('.ticker-tab-content').removeClass('active').hide();
                $(`#${tabId}`).addClass('active').fadeIn(300);
            });
        });
    </script>
</body>
</html>