import sqlite3
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

DB = "prepcast.db"

# connect to db and query
def load_data():
    conn = sqlite3.connect(DB)
    raw = pd.read_sql_query("""
        SELECT *
        FROM demand_history d
        JOIN centre c ON c.centre_id = d.centre_id
        JOIN meal   m ON m.meal_id   = d.meal_id
    """, conn)
    conn.close()
    return raw

