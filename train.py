import sqlite3
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from features import build_features, learn_categories

DB = "prepcast.db"

# connect to db and query
def load_data():
    conn = sqlite3.connect(DB)
    raw = pd.read_sql_query("""
        SELECT d.centre_id, d.meal_id, d.week, d.num_orders,
            d.checkout_price, d.base_price, d.emailer_for_promotion, d.homepage_featured,
            c.city_code, c.region_code, c.centre_type, c.op_area,
            m.category, m.cuisine
        FROM demand_history d
        JOIN centre c ON c.centre_id = d.centre_id
        JOIN meal   m ON m.meal_id   = d.meal_id
    """, conn)
    conn.close()
    return raw

# featured engineering
def build():
    df = load_data()
    cats = learn_categories(df)
    df = build_features(df,cats)
    df = df.dropna(subset=["lag_1", "lag_2", "lag_3", "lag_5", "roll_3", "roll_10"])
    return df, cats

# time split
def split(df):
    cutoff = df['week'].max() - 10
    train = df[df['week'] <= cutoff]
    test = df[df['week'] > cutoff]
    return train, test

# evaluate models
def evaluate(train,test):
    drop_cols = ['num_orders', 'id', 'category', 'cuisine', 'centre_type']
    feature_cols = [c for c in df.columns if c not in drop_cols]
    X_train, y_train = train[feature_cols], train['num_orders']
    X_test,  y_test  = test[feature_cols],  test['num_orders']

    models = {
        'LinearRegression': LinearRegression(),
        'RandomForest': RandomForestRegressor(n_estimators=100, max_depth=18,
                            max_samples=0.5, n_jobs=-1, random_state=42),
        'GradientBoosting': HistGradientBoostingRegressor(max_iter=300, random_state=42),
    }

    model = models['RandomForest']
    model.fit(X_train, y_train)   
    print("trained on", len(X_train), "rows")
    joblib.dump(model, 'model.joblib')