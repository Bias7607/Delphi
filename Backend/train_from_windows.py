# -*- coding: utf-8 -*-
"""
Advanced Training Script for Stock Signal Classification
Created on Sun Jul 06 01:28 AM CEST 2025
@author: tobia
"""
import mysql.connector
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from skopt import BayesSearchCV
from skopt.space import Real, Integer
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import logging
import argparse
from datetime import datetime
import json
import time
from collections import Counter
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("train_advanced")

ALLOWED_COLUMNS = ['open', 'high', 'low', 'close', 'volume', 'volume_adi', 'volume_obv', 'volume_cmf',
                   'volume_fi', 'volume_em', 'volume_sma_em', 'volume_vpt', 'volume_vwap', 'volume_mfi',
                   'volume_nvi', 'volatility_bbm', 'volatility_bbh', 'volatility_bbl', 'volatility_bbw',
                   'volatility_bbp', 'volatility_bbhi', 'volatility_bbli', 'volatility_kcc', 'volatility_kch',
                   'volatility_kcl', 'volatility_kcw', 'volatility_kcp', 'volatility_kchi', 'volatility_kcli',
                   'volatility_dcl', 'volatility_dch', 'volatility_dcm', 'volatility_dcw', 'volatility_dcp',
                   'volatility_atr', 'volatility_ui', 'trend_macd', 'trend_macd_signal', 'trend_macd_diff',
                   'trend_sma_fast', 'trend_sma_slow', 'trend_ema_fast', 'trend_ema_slow', 'trend_vortex_ind_pos',
                   'trend_vortex_ind_neg', 'trend_vortex_ind_diff', 'trend_trix', 'trend_mass_index', 'trend_dpo',
                   'trend_kst', 'trend_kst_sig', 'trend_kst_diff', 'trend_ichimoku_conv', 'trend_ichimoku_base',
                   'trend_ichimoku_a', 'trend_ichimoku_b', 'trend_stc', 'trend_adx', 'trend_adx_pos',
                   'trend_adx_neg', 'trend_cci', 'trend_visual_ichimoku_a', 'trend_visual_ichimoku_b',
                   'trend_aroon_up', 'trend_aroon_down', 'trend_aroon_ind', 'trend_psar_up', 'trend_psar_down',
                   'trend_psar_up_indicator', 'trend_psar_down_indicator', 'momentum_rsi', 'momentum_stoch_rsi',
                   'momentum_stoch_rsi_k', 'momentum_stoch_rsi_d', 'momentum_tsi', 'momentum_uo', 'momentum_stoch',
                   'momentum_stoch_signal', 'momentum_wr', 'momentum_ao', 'momentum_roc', 'momentum_ppo',
                   'momentum_ppo_signal', 'momentum_ppo_hist', 'momentum_pvo', 'momentum_pvo_signal',
                   'momentum_pvo_hist', 'momentum_kama', 'others_dr', 'others_dlr', 'others_cr',
                   'momentum_ppo_sm', 'momentum_ppo_deg']

DEFAULT_PATTERN_LENGTH = 5
DEFAULT_OFFSET = 0
MODEL_DIR = "Z:\\delphi\\models"
os.makedirs(MODEL_DIR, exist_ok=True)

def load_data_from_db(pattern_length, offset, db_config):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT p.cid, p.candle_index, p.col_name, p.col_value, c.classification, c.datetimestamp
            FROM patterns_tb p
            JOIN classifications_tb c ON p.cid = c.cid
            WHERE c.pattern_length = %s AND c.pattern_offset = %s
        """
        cursor.execute(query, (pattern_length, offset))
        records = cursor.fetchall()
        if not records:
            logger.error("No data found for pattern_length=%d, offset=%d", pattern_length, offset)
            return None
        data = {}
        for record in records:
            cid = record['cid']
            if cid not in data:
                data[cid] = {'pattern': [{} for _ in range(pattern_length)], 'classification': record['classification'], 'datetimestamp': record['datetimestamp']}
            if record['candle_index'] < pattern_length and record['col_name'] in ALLOWED_COLUMNS:
                data[cid]['pattern'][record['candle_index']][record['col_name']] = record['col_value']
        return data
    except mysql.connector.Error as e:
        logger.error("Database error: %s", str(e))
        return None
    finally:
        cursor.close()
        conn.close()

def filter_by_session(data):
    premarket = {}
    normal = {}
    aftermarket = {}
    for cid, item in data.items():
        dt = item['datetimestamp']
        hour = dt.hour
        minute = dt.minute
        if (hour == 10 and minute >= 0) or (10 < hour < 15) or (hour == 15 and minute <= 25):
            premarket[cid] = item
        elif (hour == 15 and minute >= 30) or (15 < hour < 22):
            normal[cid] = item
        elif (hour >= 22) or (hour < 2) or (hour == 2 and minute == 0):
            aftermarket[cid] = item
    return premarket, normal, aftermarket

def process_session_data(session_data, pattern_length):
    if not session_data:
        return None, None
    X = []
    y = []
    for cid, item in session_data.items():
        pattern = item['pattern']
        if len(pattern) == pattern_length and all(len(c) > 0 for c in pattern):
            flattened = [candle.get(col, np.nan) for candle in pattern for col in ALLOWED_COLUMNS]
            X.append(flattened)
            y.append(item['classification'])
    if not X:
        return None, None
    return np.array(X, dtype=float), np.array(y, dtype=int)

def preprocess_data(X, y):
    if X.size == 0 or y.size == 0:
        logger.error("Empty dataset after loading")
        return None, None, None
    X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)
    X = np.clip(X, -1e6, 1e6)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    unique_classes = np.unique(y)
    if not all(c in [1, 2, 3] for c in unique_classes):
        logger.warning("Unexpected classes found: %s", unique_classes)
    return X_scaled, y, scaler

def get_class_distribution(y):
    counts = Counter(y)
    return {str(k): counts.get(k, 0) for k in [1, 2, 3]}

def train_model(X, y):
    search_space = {
        'n_estimators': Integer(100, 300),
        'max_depth': Integer(5, 20),
        'min_samples_split': Integer(2, 10),
        'min_samples_leaf': Integer(1, 4),
        'max_features': Real(0.1, 0.9, 'uniform')
    }
    rf = RandomForestClassifier(class_weight='balanced', random_state=42, n_jobs=-1)
    opt = BayesSearchCV(
        rf, search_space, n_iter=20, cv=5, n_jobs=-1, random_state=42,
        scoring='accuracy', verbose=1
    )
    logger.info("Starting Bayesian optimization")
    opt.fit(X, y)
    logger.info("Best parameters: %s", opt.best_params_)
    return opt.best_estimator_, opt

def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True)
    cm = confusion_matrix(y_test, y_pred).tolist()
    logger.info("Accuracy: %.4f", accuracy)
    logger.info("Classification Report:\n%s", json.dumps(report, indent=2))
    logger.info("Confusion Matrix:\n%s", cm)
    return accuracy, report, cm

def plot_cm(cm, session_name):
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=[1,2,3], yticklabels=[1,2,3])
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.title(f'Confusion Matrix for {session_name}')
    plt.savefig(f'cm_{session_name}.png')
    plt.close()
    logger.info("Confusion Matrix plotted to cm_%s.png", session_name)

def get_feature_importances(model, pattern_length):
    importances = model.feature_importances_
    feature_names = [f"candle{i+1}_{col}" for i in range(pattern_length) for col in ALLOWED_COLUMNS]
    sorted_indices = np.argsort(importances)[::-1]
    return [{'feature': feature_names[idx], 'importance': float(importances[idx])} for idx in sorted_indices]

def summarize_cv_results(opt):
    cv_results = []
    for i in range(len(opt.cv_results_['params'])):
        cv_results.append({
            'params': opt.cv_results_['params'][i],
            'mean_test_score': float(opt.cv_results_['mean_test_score'][i]),
            'std_test_score': float(opt.cv_results_['std_test_score'][i])
        })
    return cv_results

def save_report_to_db(report, db_config):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        insert_query = """
            INSERT INTO training_reports (
                training_datetime, pattern_length, offset, total_samples, train_samples, test_samples,
                class_distribution_full, class_distribution_train, class_distribution_test,
                best_params, cv_results, feature_importances, accuracy, classification_report,
                confusion_matrix, training_duration_seconds, model_path, session
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        values = (
            report['training_datetime'],
            report['pattern_length'],
            report['offset'],
            report['total_samples'],
            report['train_samples'],
            report['test_samples'],
            json.dumps(report['class_distribution_full']),
            json.dumps(report['class_distribution_train']),
            json.dumps(report['class_distribution_test']),
            json.dumps(report['best_params']),
            json.dumps(report['cv_results']),
            json.dumps(report['feature_importances']),
            report['accuracy'],
            json.dumps(report['classification_report']),
            json.dumps(report['confusion_matrix']),
            report['training_duration_seconds'],
            report['model_path'],
            report['session']
        )
        cursor.execute(insert_query, values)
        conn.commit()
        logger.info("Training report saved to database with ID: %s", cursor.lastrowid)
    except mysql.connector.Error as e:
        logger.error("Error saving report to DB: %s", str(e))
    finally:
        cursor.close()
        conn.close()

def save_model(model, scaler, pattern_length, offset, session_name):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = os.path.join(MODEL_DIR, f"delphi_stock_model_{session_name}.pkl")
    joblib.dump({"model": model, "scaler": scaler, "timestamp": timestamp}, model_path)
    logger.info("Model for %s saved to: %s", session_name, model_path)
    return model_path

def train_session(session_data, session_name, pattern_length, offset, db_config):
    X, y = process_session_data(session_data, pattern_length)
    if X is None or y is None:
        logger.warning("No data for %s session", session_name)
        return None
    logger.info("Preprocessing %s data", session_name)
    X_processed, y_processed, scaler = preprocess_data(X, y)
    if X_processed is None:
        return None
    X_train, X_test, y_train, y_test = train_test_split(
        X_processed, y_processed, test_size=0.2, stratify=y_processed, random_state=42
    )
    logger.info("%s split into %d train and %d test samples", session_name, len(y_train), len(y_test))
    class_dist_full = get_class_distribution(y_processed)
    class_dist_train = get_class_distribution(y_train)
    class_dist_test = get_class_distribution(y_test)
    start_time = time.time()
    model, opt = train_model(X_train, y_train)
    training_duration = time.time() - start_time
    logger.info("Evaluating %s model", session_name)
    accuracy, report, cm = evaluate_model(model, X_test, y_test)
    plot_cm(cm, session_name)
    model_path = save_model(model, scaler, pattern_length, offset, session_name)
    training_report = {
        'training_datetime': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'pattern_length': pattern_length,
        'offset': offset,
        'total_samples': len(y_processed),
        'train_samples': len(y_train),
        'test_samples': len(y_test),
        'class_distribution_full': class_dist_full,
        'class_distribution_train': class_dist_train,
        'class_distribution_test': class_dist_test,
        'best_params': opt.best_params_,
        'cv_results': summarize_cv_results(opt),
        'feature_importances': get_feature_importances(model, pattern_length),
        'accuracy': accuracy,
        'classification_report': report,
        'confusion_matrix': cm,
        'training_duration_seconds': training_duration,
        'model_path': model_path,
        'session': session_name
    }
    save_report_to_db(training_report, db_config)
    return model_path, accuracy, report

def main(pattern_length=DEFAULT_PATTERN_LENGTH, offset=DEFAULT_OFFSET):
    db_config = {
        'host': '192.168.1.6',
        'user': 'bias76sql',
        'password': 'TestPassword123',
        'database': 'stocksocket'
    }
    logger.info("Loading data with pattern_length=%d, offset=%d", pattern_length, offset)
    data = load_data_from_db(pattern_length, offset, db_config)
    if data is None:
        return
    premarket, normal, aftermarket = filter_by_session(data)
    for session_data, session_name in [(premarket, 'premarket'), (normal, 'normal_hours'), (aftermarket, 'aftermarket')]:
        logger.info("Training %s model", session_name)
        train_session(session_data, session_name, pattern_length, offset, db_config)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Advanced training script for stock signal classification.")
    parser.add_argument('--pattern_length', type=int, default=DEFAULT_PATTERN_LENGTH, help='Number of candlesticks (default: 5)')
    parser.add_argument('--offset', type=int, default=DEFAULT_OFFSET, help='Offset value (default: 0)')
    args = parser.parse_args()
    main(pattern_length=args.pattern_length, offset=args.offset)