import asyncio
import socketio
import mysql.connector
from mysql.connector import pooling
import numpy as np
from datetime import datetime
import uvicorn

# MySQL connection pool
DB_CONFIG = {
    "host": "192.168.1.6",
    "user": "bias76sql",
    "password": "TestPassword123",
    "database": "stocksocket",
    "pool_size": 5
}
try:
    db_pool = mysql.connector.pooling.MySQLConnectionPool(**DB_CONFIG)
except Exception as e:
    raise

# Columns to save, matching frontend data
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

# Training data manager
class TrainManager:
    def __init__(self, sio):
        self.sio = sio
        self.cancel_flags = {}

    async def save_signal_pattern(self, ticker, pattern_data, direction, timestamp, pattern_length, pattern_offset, sid, pattern_index, total_patterns):
        if sid is not None and self.cancel_flags.get(sid, False):
            return 0
        connection = None
        cursor = None
        try:
            connection = db_pool.get_connection()
            cursor = connection.cursor()
            # Handle timestamp (either datetime or string)
            if isinstance(timestamp, datetime):
                datetimestamp = timestamp.replace(second=0, microsecond=0)
            elif isinstance(timestamp, str):
                try:
                    datetimestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S').replace(microsecond=0)
                except ValueError:
                    datetimestamp = datetime.now().replace(second=0, microsecond=0)
            else:
                try:
                    datetimestamp = datetime.fromtimestamp(timestamp / 1000.0).replace(second=0, microsecond=0)
                except (ValueError, TypeError):
                    datetimestamp = datetime.now().replace(second=0, microsecond=0)
    
            # Cast ints to python types for DB safety
            direction = int(direction)
            pattern_length = int(pattern_length)
            pattern_offset = int(pattern_offset)
    
            # Check for existing classification
            check_query = """
                SELECT cid FROM classifications_tb 
                WHERE ticker = %s AND datetimestamp = %s AND pattern_length = %s AND pattern_offset = %s
            """
            cursor.execute(check_query, (ticker, datetimestamp, pattern_length, pattern_offset))
            result = cursor.fetchone()
    
            if result:
                cid = int(result[0])  # Cast to python int
                update_query = """
                    UPDATE classifications_tb 
                    SET classification = %s, has_training = 0
                    WHERE cid = %s
                """
                cursor.execute(update_query, (direction, cid))
                delete_patterns_query = """
                    DELETE FROM patterns_tb WHERE cid = %s
                """
                cursor.execute(delete_patterns_query, (cid,))
            else:
                insert_query = """
                    INSERT INTO classifications_tb (ticker, datetimestamp, classification, has_training, pattern_length, pattern_offset) 
                    VALUES (%s, %s, %s, 0, %s, %s)
                """
                cursor.execute(insert_query, (ticker, datetimestamp, direction, pattern_length, pattern_offset))
                cid = int(cursor.lastrowid)  # Cast to python int
    
            # Insert patterns with all allowed columns
            if not isinstance(pattern_data, (list, tuple)) or len(pattern_data) != pattern_length:
                return 0
            skipped_features = set()
            inserted_values = 0
            for i, candle in enumerate(pattern_data):
                i = int(i)  # Cast candle_index to python int
                for feature_name, feature_value in candle.items():
                    if feature_name in ALLOWED_COLUMNS:
                        try:
                            col_value = float(feature_value) if feature_value is not None else None
                            if col_value is not None and not np.isnan(col_value) and not np.isinf(col_value):
                                cursor.execute(
                                    "INSERT INTO patterns_tb (cid, candle_index, col_name, col_value) "
                                    "VALUES (%s, %s, %s, %s)",
                                    (cid, i, feature_name, col_value)
                                )
                                inserted_values += 1
                            else:
                                skipped_features.add(feature_name)
                        except (ValueError, TypeError):
                            skipped_features.add(feature_name)
            if inserted_values == 0:
                connection.rollback()
                return 0
            connection.commit()
            if sid is not None:
                progress = ((pattern_index + 1) / total_patterns) * 100
                await self.sio.emit('progress_update', {
                    'progress': round(progress, 2),
                    'message': f'Processed pattern {pattern_index + 1} of {total_patterns}',
                    'total_patterns': total_patterns
                }, namespace='/train', to=sid)
            return 1
        except Exception as e:
            print(f"Save error for {ticker} at pattern_index {pattern_index}: {str(e)}")
            if connection:
                connection.rollback()
            return 0
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    async def add_to_db(self, sid, data):
        self.cancel_flags[sid] = False
        connection = None
        cursor = None
        try:
            connection = db_pool.get_connection()
            cursor = connection.cursor()
            patterns = data.get('patterns', [])
            labels = data.get('labels', [])
            ticker = data.get('ticker', 'unknown')
            metadata = data.get('metadata', {})
            pattern_length = metadata.get('pattern_length', 5)
            pattern_offset = metadata.get('offset', 0)
            if not patterns:
                await self.sio.emit('progress_update', {
                    'progress': 0,
                    'message': 'No patterns found',
                    'total_patterns': 0
                }, namespace='/train', to=sid)
                return 0
            if len(patterns) != len(labels):
                await self.sio.emit('train_complete', {
                    'status': 'failure',
                    'message': 'Mismatch between patterns and labels'
                }, namespace='/train', to=sid)
                return 0

            await self.sio.emit('progress_update', {
                'progress': 0,
                'message': 'Starting pattern processing',
                'total_patterns': len(patterns)
            }, namespace='/train', to=sid)

            inserted_count = 0
            for i, (pattern, label) in enumerate(zip(patterns, labels)):
                if self.cancel_flags.get(sid, False):
                    break
                if not isinstance(pattern, (list, tuple)) or len(pattern) != pattern_length:
                    continue
                direction = int(label) if label in [1, 2, 3] else 1
                last_timestamp = pattern[-1].get('timestamp', None)
                last_date = pattern[-1].get('Date', None)
                if last_date:
                    try:
                        last_datetime = datetime.strptime(last_date, '%Y-%m-%d %H:%M:%S').replace(second=0, microsecond=0)
                    except (ValueError, TypeError):
                        last_datetime = None
                if last_datetime is None and last_timestamp is not None:
                    try:
                        last_datetime = datetime.fromtimestamp(last_timestamp / 1000.0).replace(second=0, microsecond=0)
                    except (ValueError, TypeError):
                        last_datetime = datetime.now().replace(second=0, microsecond=0)
                elif last_datetime is None:
                    last_datetime = datetime.now().replace(second=0, microsecond=0)

                inserted_count += await self.save_signal_pattern(ticker, pattern, direction, last_datetime, pattern_length, pattern_offset, sid, i, len(patterns))

            if inserted_count == 0:
                await self.sio.emit('train_complete', {
                    'status': 'failure',
                    'message': 'No patterns were saved'
                }, namespace='/train', to=sid)
                return 0

            connection.commit()
            return inserted_count
        except Exception:
            if connection:
                connection.rollback()
            await self.sio.emit('train_complete', {
                'status': 'failure',
                'message': 'Database error'
            }, namespace='/train', to=sid)
            return 0
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    async def get_full_report(self, sid):
        connection = None
        cursor = None
        try:
            connection = db_pool.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            # Query classifications_tb for all classifications
            classifications_query = """
                SELECT cid, ticker, datetimestamp, classification, pattern_length, pattern_offset
                FROM classifications_tb
                ORDER BY ticker, datetimestamp
            """
            cursor.execute(classifications_query)
            classifications = cursor.fetchall()

            # Initialize report structure
            report = {
                "patterns": []
            }

            # For each classification, fetch associated patterns from patterns_tb
            for cls in classifications:
                patterns_query = """
                    SELECT candle_index, col_name, col_value
                    FROM patterns_tb
                    WHERE cid = %s
                    ORDER BY candle_index, col_name
                """
                cursor.execute(patterns_query, (cls['cid'],))
                patterns_data = cursor.fetchall()

                # Organize patterns by candle_index
                candlesticks = {}
                for pattern in patterns_data:
                    candle_idx = pattern['candle_index']
                    if candle_idx not in candlesticks:
                        candlesticks[candle_idx] = {}
                    candlesticks[candle_idx][pattern['col_name']] = float(pattern['col_value'])

                # Convert candlesticks to list format
                pattern_list = [
                    candlesticks[i] for i in sorted(candlesticks.keys())
                ]

                # Add classification and pattern data to report
                report["patterns"].append({
                    "cid": cls['cid'],
                    "ticker": cls['ticker'],
                    "datetimestamp": cls['datetimestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                    "classification": cls['classification'],
                    "pattern_length": cls['pattern_length'],
                    "pattern_offset": cls['pattern_offset'],
                    "candlesticks": pattern_list
                })

            # Emit report to frontend
            await self.sio.emit('full_report', {
                'status': 'success',
                'data': report
            }, namespace='/train', to=sid)

            return len(report["patterns"])
        except Exception:
            await self.sio.emit('full_report', {
                'status': 'failure',
                'message': 'Failed to generate report'
            }, namespace='/train', to=sid)
            return 0
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

# Initialize Socket.IO server
try:
    sio = socketio.AsyncServer(
        async_mode='asgi',
        cors_allowed_origins=["https://aktier.ddns.net"]
    )
except Exception:
    raise

try:
    app = socketio.ASGIApp(sio, socketio_path="/socket.io")
except Exception:
    raise

train_manager = TrainManager(sio)

@sio.event(namespace='/train')
async def connect(sid, environ):
    await sio.emit('train_status', {'status': 'connected'}, namespace='/train', to=sid)

@sio.event(namespace='/train')
async def disconnect(sid):
    train_manager.cancel_flags.pop(sid, None)

@sio.event(namespace='/train')
async def save_patterns(sid, data):
    if not data or 'patterns' not in data or 'labels' not in data:
        await sio.emit('train_complete', {
            'status': 'failure',
            'message': 'Missing or empty patterns or labels'
        }, namespace='/train', to=sid)
        return
    
    patterns = data['patterns']
    labels = data['labels']
    
    if not patterns or not labels:
        await sio.emit('train_complete', {
            'status': 'failure',
            'message': 'Empty patterns or labels received'
        }, namespace='/train', to=sid)
        return
    
    inserted_count = await train_manager.add_to_db(sid, data)
    await sio.emit('train_complete', {
        'status': 'success' if inserted_count > 0 else 'failure',
        'message': f'Saved {inserted_count} patterns' if inserted_count > 0 else 'No patterns were saved'
    }, namespace='/train', to=sid)

@sio.event(namespace='/train')
async def get_full_report(sid, data):
    inserted_count = await train_manager.get_full_report(sid)
    if inserted_count == 0:
        await sio.emit('full_report', {
            'status': 'failure',
            'message': 'No patterns found in database'
        }, namespace='/train', to=sid)

# Run the server
if __name__ == '__main__':
    try:
        uvicorn.run(app, host='0.0.0.0', port=8001, log_level='critical')
    except Exception:
        raise