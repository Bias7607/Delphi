import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from contextlib import asynccontextmanager
import asyncio
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
from tradingview_scraper import get_gainers
import json

# Configuration
FETCH_INTERVAL = 10  # Adjusted for gainers push every 30 seconds
DB_CONFIG = {
    "host": "localhost",
    "user": "bias76sql",
    "password": "TestPassword123",
    "database": "stocksocket",
    "pool_size": 5
}

try:
    db_pool = MySQLConnectionPool(**DB_CONFIG)
except Error as e:
    db_pool = None

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
client_ids = {}  # Track connected clients if needed for targeted pushes

def get_db_connection():
    if db_pool is None:
        return None
    try:
        conn = db_pool.get_connection()
        return conn
    except Error as e:
        return None


# Updated get_classification_report function to include latest training report
def get_classification_report():
    conn = get_db_connection()
    if not conn:
        return {
            'total_classifications': 0,
            'total_size': '0 KB',
            'unique_tickers': 0,
            'class_counts': {'1': 0, '2': 0, '3': 0},
            'class_percentages': {'1': 0.0, '2': 0.0, '3': 0.0},
            'training_report': None
        }
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Total classifications
        cursor.execute("SELECT COUNT(*) as total FROM classifications_tb")
        total = cursor.fetchone()['total']
        
        # Unique tickers
        cursor.execute("SELECT COUNT(DISTINCT ticker) as unique_tickers FROM classifications_tb")
        unique = cursor.fetchone()['unique_tickers']
        
        # Class counts
        cursor.execute("""
            SELECT classification, COUNT(*) as count
            FROM classifications_tb
            GROUP BY classification
        """)
        class_rows = cursor.fetchall()
        class_counts = {'1': 0, '2': 0, '3': 0}
        for row in class_rows:
            cls = str(row['classification'])
            if cls in class_counts:
                class_counts[cls] = row['count']
        
        # Class percentages
        class_percentages = {}
        for cls, count in class_counts.items():
            class_percentages[cls] = round((count / total * 100) if total > 0 else 0.0, 2)
        
        # Total size in KB
        cursor.execute("""
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024, 2) AS size_kb
            FROM information_schema.TABLES 
            WHERE table_schema = %s 
            AND table_name IN ('classifications_tb', 'patterns_tb')
        """, (DB_CONFIG['database'],))
        size_kb = cursor.fetchone()['size_kb'] or 0.0
        
        # Format size
        if size_kb < 1024:
            total_size = f"{size_kb:.2f} KB"
        elif size_kb < 1024 * 1024:
            total_size = f"{size_kb / 1024:.2f} MB"
        elif size_kb < 1024 * 1024 * 1024:
            total_size = f"{size_kb / (1024 * 1024):.2f} GB"
        else:
            total_size = f"{size_kb / (1024 * 1024 * 1024):.2f} TB"
        
        # Fetch latest training report - updated to include full classification_report JSON
        cursor.execute("""
            SELECT training_datetime, accuracy, training_duration_seconds, classification_report
            FROM training_reports
            ORDER BY training_datetime DESC
            LIMIT 1
        """)
        training_row = cursor.fetchone()
        training_report = None
        if training_row:
            classification_report_dict = json.loads(training_row['classification_report']) if training_row['classification_report'] else None
            training_report = {
                'training_datetime': training_row['training_datetime'].isoformat(),
                'accuracy': training_row['accuracy'],
                'training_duration_seconds': training_row['training_duration_seconds'],
                'classification_report': classification_report_dict  # New: Full dict for per-class
            }
        
        return {
            'total_classifications': total,
            'total_size': total_size,
            'unique_tickers': unique,
            'class_counts': class_counts,
            'class_percentages': class_percentages,
            'training_report': training_report
        }
    except Exception as e:
        logging.error(f"Error fetching classification report: {e}")
        return {
            'total_classifications': 0,
            'total_size': '0 KB',
            'unique_tickers': 0,
            'class_counts': {'1': 0, '2': 0, '3': 0},
            'class_percentages': {'1': 0.0, '2': 0.0, '3': 0.0},
            'training_report': None
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

def get_classification_report_():
    conn = get_db_connection()
    if not conn:
        return {
            'total_classifications': 0,
            'total_size': '0 KB',
            'unique_tickers': 0,
            'class_counts': {'1': 0, '2': 0, '3': 0},
            'class_percentages': {'1': 0.0, '2': 0.0, '3': 0.0}
        }
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Total classifications
        cursor.execute("SELECT COUNT(*) as total FROM classifications_tb")
        total = cursor.fetchone()['total']
        
        # Unique tickers
        cursor.execute("SELECT COUNT(DISTINCT ticker) as unique_tickers FROM classifications_tb")
        unique = cursor.fetchone()['unique_tickers']
        
        # Class counts
        cursor.execute("""
            SELECT classification, COUNT(*) as count
            FROM classifications_tb
            GROUP BY classification
        """)
        class_rows = cursor.fetchall()
        class_counts = {'1': 0, '2': 0, '3': 0}
        for row in class_rows:
            cls = str(row['classification'])
            if cls in class_counts:
                class_counts[cls] = row['count']
        
        # Class percentages
        class_percentages = {}
        for cls, count in class_counts.items():
            class_percentages[cls] = round((count / total * 100) if total > 0 else 0.0, 2)
        
        # Total size in KB
        cursor.execute("""
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024, 2) AS size_kb
            FROM information_schema.TABLES 
            WHERE table_schema = %s 
            AND table_name IN ('classifications_tb', 'patterns_tb')
        """, (DB_CONFIG['database'],))
        size_kb = cursor.fetchone()['size_kb'] or 0.0
        
        # Format size
        if size_kb < 1024:
            total_size = f"{size_kb:.2f} KB"
        elif size_kb < 1024 * 1024:
            total_size = f"{size_kb / 1024:.2f} MB"
        elif size_kb < 1024 * 1024 * 1024:
            total_size = f"{size_kb / (1024 * 1024):.2f} GB"
        else:
            total_size = f"{size_kb / (1024 * 1024 * 1024):.2f} TB"
        
        return {
            'total_classifications': total,
            'total_size': total_size,
            'unique_tickers': unique,
            'class_counts': class_counts,
            'class_percentages': class_percentages
        }
    except Exception as e:
        logging.error(f"Error fetching classification report: {e}")
        return {
            'total_classifications': 0,
            'total_size': '0 KB',
            'unique_tickers': 0,
            'class_counts': {'1': 0, '2': 0, '3': 0},
            'class_percentages': {'1': 0.0, '2': 0.0, '3': 0.0}
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

async def background_push(sid):
    try:
        while sid in client_ids:
            normal = get_gainers('normal')
            premarket = get_gainers('premarket')
            aftermarket = get_gainers('aftermarket')
            report = get_classification_report()
            await sio.emit('misc_update', {
                'normal': normal,
                'premarket': premarket,
                'aftermarket': aftermarket,
                'report': report
            }, namespace='/misc', to=sid)
            await asyncio.sleep(FETCH_INTERVAL)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        pass
    finally:
        if sid in client_tasks:
            del client_tasks[sid]

@asynccontextmanager
async def lifespan(app):
    try:
        yield
    finally:
        for sid, task in client_tasks.items():
            task.cancel()
        client_tasks.clear()
        client_ids.clear()
        if db_pool:
            for conn in db_pool._pool:
                try:
                    conn.close()
                except:
                    pass

app = FastAPI(lifespan=lifespan)


@sio.on('request_unique_tickers', namespace='/misc')
async def request_unique_tickers(sid, data):
    conn = get_db_connection()
    if not conn:
        await sio.emit('unique_tickers_list', {'tickers': [], 'error': 'DB connection failed'}, namespace='/misc', to=sid)
        return
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT ticker, DATE(datetimestamp) AS date, COUNT(*) AS count 
            FROM classifications_tb 
            GROUP BY ticker, DATE(datetimestamp) 
            ORDER BY ticker ASC, date DESC
        """)
        rows = cursor.fetchall()
        tickers_data = {}
        for row in rows:
            ticker = row['ticker']
            if ticker not in tickers_data:
                tickers_data[ticker] = []
            tickers_data[ticker].append({'date': row['date'].strftime('%Y-%m-%d'), 'count': row['count']})
        sorted_tickers = [{'ticker': t, 'dates': tickers_data[t]} for t in sorted(tickers_data)]
        await sio.emit('unique_tickers_list', {'tickers': sorted_tickers}, namespace='/misc', to=sid)
    except Exception as e:
        logging.error(f"Error fetching unique tickers/dates: {e}")
        await sio.emit('unique_tickers_list', {'tickers': [], 'error': str(e)}, namespace='/misc', to=sid)
    finally:
        cursor.close()
        conn.close()


@sio.on('connect', namespace='/misc')
async def connect(sid, environ):
    client_ids[sid] = True
    await sio.emit('misc_status', {'status': 'connected'}, namespace='/misc', to=sid)
    task = asyncio.create_task(background_push(sid))
    client_tasks[sid] = task

@sio.on('disconnect', namespace='/misc')
async def disconnect(sid):
    if sid in client_tasks:
        client_tasks[sid].cancel()
        del client_tasks[sid]
    if sid in client_ids:
        del client_ids[sid]

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(sio_app, host="0.0.0.0", port=8002, log_level="critical")
    except Exception as e:
        raise