import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from contextlib import asynccontextmanager
import asyncio
import yfinance as yf
import pandas as pd
import numpy as np
from ta import add_all_ta_features
from scipy.signal import savgol_filter
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
import joblib
from datetime import datetime, timedelta
import pytz
from concurrent.futures import ThreadPoolExecutor

# Configuration
FETCH_INTERVAL = 1.0
DB_CONFIG = {
    "host": "localhost",
    "user": "bias76sql",
    "password": "TestPassword123",
    "database": "stocksocket",
    "pool_size": 5
}
MODEL_PATH = "/home/bias76/delphi/models/delphi_stock_model.pkl"
FALLBACK_MODEL_PATH = "/home/bias76/delphi/models/delphi_stock_model.pkl"
PATTERN_LENGTH = 5
executor = ThreadPoolExecutor(max_workers=10)
try:
    db_pool = MySQLConnectionPool(**DB_CONFIG)
except Error as e:
    db_pool = None

MODEL = None
SCALER = None
try:
    model_data = joblib.load(MODEL_PATH)
    MODEL = model_data['model']
    SCALER = model_data['scaler']
except Exception as e:
    try:
        model_data = joblib.load(FALLBACK_MODEL_PATH)
        MODEL = model_data['model']
        SCALER = model_data['scaler']
    except Exception as fallback_e:
        MODEL = None
        SCALER = None

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://aktier.ddns.net"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["https://aktier.ddns.net"],
    logger=False,
    engineio_logger=False
)
sio_app = socketio.ASGIApp(sio, app)
client_tasks = {}
client_tickers = {}
ALLOWED_COLUMNS = [
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
    'others_dlr', 'others_cr', 'momentum_ppo_sm', 'momentum_ppo_deg'
]

def get_db_connection():
    if db_pool is None:
        return None
    try:
        conn = db_pool.get_connection()
        return conn
    except Error as e:
        return None

def smooth_out_curve(df, column, window, poly):
    if window <= poly:
        window = poly + 1
    if window % 2 == 0:
        window += 1
    if df[column].isna().sum() > 0 or np.isinf(df[column]).sum() > 0:
        df = df.dropna(subset=[column])
        df = df[np.isfinite(df[column])]
    if len(df[column]) < window:
        return df
    df[column + '_sm'] = savgol_filter(df[column], window_length=window, polyorder=poly)
    return df

def calculate_momentum_ppo_deg(df):
    df['momentum_ppo_diff'] = df['momentum_ppo_sm'].diff()
    df['momentum_ppo_deg'] = np.degrees(np.arctan(df['momentum_ppo_diff']))
    df['momentum_ppo_deg'] = df['momentum_ppo_deg'] * (50 / 45)
    df.drop(columns=['momentum_ppo_diff'], inplace=True)
    return df

def check_existing_candlesticks(symbol, df):
    conn = get_db_connection()
    if not conn:
        df['classified'] = 0
        df['classification'] = 0
        return df
    try:
        cursor = conn.cursor(dictionary=True)
        timestamps = df['date'].tolist()
        if not timestamps:
            df['classified'] = 0
            df['classification'] = 0
            cursor.close()
            conn.close()
            return df
        placeholders = ','.join(['%s'] * len(timestamps))
        query = f"""
            SELECT datetimestamp, classification
            FROM classifications_tb
            WHERE ticker = %s AND datetimestamp IN ({placeholders})
        """
        cursor.execute(query, [symbol] + timestamps)
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        classifications_df = pd.DataFrame(results)
        if classifications_df.empty:
            df['classified'] = 0
            df['classification'] = 0
            return df
        classifications_df['datetimestamp'] = classifications_df['datetimestamp'].astype(str)
        df['date'] = df['date'].astype(str)
        df = df.merge(
            classifications_df[['datetimestamp', 'classification']],
            how='left',
            left_on='date',
            right_on='datetimestamp'
        )
        df['classified'] = df['classification'].notna().astype(int)
        df['classification'] = df['classification'].fillna(0).astype(int)
        df = df.drop(columns=['datetimestamp'], errors='ignore')
        return df
    except Exception as e:
        df['classified'] = 0
        df['classification'] = 0
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()
        return df

def predict_patterns(df):
    if MODEL is None or SCALER is None:
        df['prediction'] = 0
        df['prediction_values'] = 0.0
        return df
    if len(df) < PATTERN_LENGTH:
        df['prediction'] = 0
        df['prediction_values'] = 0.0
        return df
    df['prediction'] = 0
    df['prediction_values'] = 0.0
    patterns = []
    valid_indices = []
    for i in range(PATTERN_LENGTH - 1, len(df)):
        pattern = df.iloc[i - PATTERN_LENGTH + 1:i + 1][ALLOWED_COLUMNS].values
        if pattern.shape == (PATTERN_LENGTH, len(ALLOWED_COLUMNS)):
            patterns.append(pattern.flatten())
            valid_indices.append(i)
    if not patterns:
        return df
    X = np.array(patterns, dtype=float)
    X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)
    X = np.clip(X, -1e6, 1e6)
    X_scaled = SCALER.transform(X)
    try:
        predictions = MODEL.predict(X_scaled)
        probabilities = MODEL.predict_proba(X_scaled)
        max_probs = np.max(probabilities, axis=1)
        for idx, pred, prob in zip(valid_indices, predictions, max_probs):
            df.loc[df.index[idx], 'prediction'] = int(pred)
            df.loc[df.index[idx], 'prediction_values'] = float(prob)
    except Exception as e:
        df['prediction'] = 0
        df['prediction_values'] = 0.0
    return df

def generate_signals(df, peek_mode=False, prob_threshold=0.7):
    df = df.assign(signals=0, signal_change_percentage=0.0, safe_buy=0)
    if 'prediction' not in df.columns or 'date' not in df.columns or 'close' not in df.columns:
        return df
    if df['close'].isna().any() or not df['close'].apply(lambda x: isinstance(x, (int, float))).all() or (df['close'] <= 0).any():
        df['close'] = df['close'].fillna(method='ffill').fillna(method='bfill').astype(float)
        valid_mean = df['close'][df['close'] > 0].mean() if (df['close'] > 0).any() else 1.0
        df['close'] = df['close'].clip(lower=valid_mean or 1.0)
        df.loc[df['close'] <= 0, 'signals'] = 0
    holding = False
    last_buy_price = None
    current_time = datetime.now()
    end_idx = len(df) - 1 if peek_mode else len(df) - 2
    for i in range(1, end_idx + 1):
        current_pred = int(df.iloc[i]['prediction'])
        current_date = pd.to_datetime(df.iloc[i]['date'])
        close_price = float(df.iloc[i]['close'])
        prediction_prob = float(df.iloc[i]['prediction_values']) if 'prediction_values' in df.columns else 0.0
        cpp_value = float(df.iloc[i]['cpp']) if 'cpp' in df.columns else 0.0
        momentum_ppo_deg = float(df.iloc[i]['momentum_ppo_deg'])
        is_last_candlestick = i == len(df) - 1
        is_incomplete = is_last_candlestick and (current_time - current_date) < timedelta(minutes=5)
        if is_incomplete and not peek_mode:
            df.loc[df.index[i], 'signals'] = 0
            continue
        if peek_mode and is_last_candlestick and prediction_prob < prob_threshold:
            df.loc[df.index[i], 'signals'] = 0
            continue
        if current_pred == 1 and not holding and close_price > 0:
            df.loc[df.index[i], 'signals'] = 1
            holding = True
            last_buy_price = close_price
            df.loc[df.index[i], 'signal_change_percentage'] = 0.0
        elif holding and current_pred != 1 and close_price > 0 and last_buy_price is not None:
            df.loc[df.index[i], 'signals'] = 2
            signal_change_percentage = ((close_price - last_buy_price) / last_buy_price) * 100
            signal_change_percentage = max(round(signal_change_percentage, 4), 0.01)
            df.loc[df.index[i], 'signal_change_percentage'] = float(signal_change_percentage)
            holding = False
            last_buy_price = None
        elif close_price <= 0:
            df.loc[df.index[i], 'signals'] = 0
        buy_mask = df['signals'] == 1
        df.loc[buy_mask & (df['cpp'] > 50), 'safe_buy'] = 1
    return df

def download_ticker_data(ticker, period="5d"):
    return yf.download(ticker, period=period, interval="5m", progress=False, timeout=10, prepost=True, ignore_tz=True, keepna=False, auto_adjust=True)

async def fetch_ticker_data(ticker, period="5d"):
    try:
        loop = asyncio.get_running_loop()
        df = await loop.run_in_executor(executor, download_ticker_data, ticker, period)
        if df.empty:
            return []
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
        df = df.reset_index().rename(columns={
            'Datetime': 'date',
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        if df['date'].isna().any():
            df = df.dropna(subset=['date'])
        if df.empty:
            return []
        tz = pytz.timezone('America/New_York')
        df['date'] = df['date'].dt.tz_localize(tz, ambiguous='infer').dt.tz_convert('UTC').dt.tz_localize(None)
        df['date'] = df['date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = add_all_ta_features(df, open="open", high="high", low="low", close="close", volume="volume", fillna=True)
        df = smooth_out_curve(df, 'momentum_ppo', window=1, poly=1)
        df = calculate_momentum_ppo_deg(df)
        df['avg_volume'] = df['volume'].rolling(window=20, min_periods=1).mean()
        df['volume_ratio'] = df['volume'] / df['avg_volume'].replace(0, np.nan)
        df['volume_ratio'] = df['volume_ratio'].fillna(1.0).clip(0, 10)
        df['ppo_positive'] = np.where(df['momentum_ppo_sm'] > 0, df['momentum_ppo_sm'], 0).clip(0, 5)
        df['cpp'] = (df['volume_cmf'] * 10) + (df['volume_ratio'] * 10) + (df['ppo_positive'] * 10)
        df['cpp'] = df['cpp'].fillna(0).clip(0, 100)
        df['cpp_smoothed'] = df['cpp'].ewm(span=3, adjust=False).mean()  # New: Smooth CCP for chain
        df = check_existing_candlesticks(ticker, df)
        df = predict_patterns(df)
        df = generate_signals(df)
        trading_days = pd.to_datetime(df['date']).dt.date.unique()
        last_three_days = trading_days[-3:] if len(trading_days) >= 3 else trading_days
        df = df[pd.to_datetime(df['date']).dt.date.isin(last_three_days)]
        if 'signal_change_percentage' not in df.columns:
            df['signal_change_percentage'] = 0.0
        df['signal_change_percentage'] = df['signal_change_percentage'].astype(float)
        data = []
        for index, row in df.iterrows():
            signal_change_percentage = float(row['signal_change_percentage']) if pd.notnull(row['signal_change_percentage']) else 0.0
            row_dict = {
                "timestamp": int(pd.to_datetime(row["date"]).timestamp() * 1000),
                "Date": row["date"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": int(row["volume"]),
                "classified": int(row["classified"]),
                "classification": int(row["classification"]),
                "prediction": int(row["prediction"]),
                "prediction_values": float(row["prediction_values"]),
                "signals": int(row["signals"]),
                "signal_change_percentage": signal_change_percentage,
                "safe_buy": int(row["safe_buy"]),
                "cpp_smoothed": float(row["cpp_smoothed"])  # New: Include smoothed CCP
            }
            for col in ALLOWED_COLUMNS:
                row_dict[col] = float(row[col]) if pd.notnull(row[col]) else 0.0
            data.append(row_dict)
        info = {}
        try:
            ticker_obj = yf.Ticker(ticker)
            full_info = ticker_obj.info
            relevant_keys = [
                'sector', 'industry', 'country', 'exchange', 'quoteType', 'currency',
                'previousClose', 'open', 'dayHigh', 'dayLow', 'averageVolume',
                'bidSize', 'askSize', 'beta', 'bid', 'ask', 'longName', 'shortName'
            ]
            info = {key: full_info.get(key) for key in relevant_keys if key in full_info}
        except Exception as e:
            logging.error(f"Error fetching detailed info for {ticker}: {e}")
        return data, info
    except Exception as e:
        logging.error(f"Error in fetch_ticker_data for {ticker}: {e}")
        return [], {}

async def background_fetch(sid, ticker):
    try:
        while sid in client_tickers and client_tickers[sid] == ticker:
            data, info = await fetch_ticker_data(ticker)
            if sid in client_tickers and client_tickers[sid] == ticker:
                await sio.emit('ticker_data', {
                    'tickers': [ticker],
                    'data': data,
                    'ticker_info': {ticker: info}
                }, namespace='/data', to=sid)
            await asyncio.sleep(FETCH_INTERVAL)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        pass
    finally:
        pass

@asynccontextmanager
async def lifespan(app):
    try:
        yield
    finally:
        for sid, task in client_tasks.items():
            task.cancel()
        client_tasks.clear()
        client_tickers.clear()
        if db_pool:
            for conn in db_pool._pool:
                try:
                    conn.close()
                except:
                    pass

app = FastAPI(lifespan=lifespan)

@sio.on('connect', namespace='/data')
async def connect(sid, environ):
    await sio.emit('data_status', {'status': 'connected'}, namespace='/data', to=sid)

@sio.on('disconnect', namespace='/data')
async def disconnect(sid):
    if sid in client_tasks:
        client_tasks[sid].cancel()
        del client_tasks[sid]
    if sid in client_tickers:
        del client_tickers[sid]

@sio.on('request_ticker_data', namespace='/data')
async def request_ticker_data(sid, data):
    ticker = data.get('ticker', '').strip().upper()
    print(ticker)
    if not ticker:
        await sio.emit('ticker_data', {
            'tickers': [],
            'data': [],
            'ticker_info': {}
        }, namespace='/data', to=sid)
        return
    if sid in client_tasks:
        client_tasks[sid].cancel()
        del client_tasks[sid]
    client_tickers[sid] = ticker
    task = asyncio.create_task(background_fetch(sid, ticker))
    client_tasks[sid] = task

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(sio_app, host="0.0.0.0", port=8000, log_level="critical")
    except Exception as e:
        raise