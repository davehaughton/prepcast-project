# import joblib

# bundle = joblib.load('model.joblib')
# model = bundle["model"]
# cats  = bundle["categories"]

# import train as tr

# df = tr.load_data()
# df = tr.build_features(df,cats)
# df = df.dropna(subset=["lag_1", "lag_2", "lag_3", "lag_5", "roll_3", "roll_10"])
   
# drop_cols = ['num_orders', 'id', 'category', 'cuisine', 'centre_type']
# feature_cols = [c for c in df.columns if c not in drop_cols]

# X = df[feature_cols]
# preds = model.predict(X)
# print(df[['week','num_orders']].head(10).assign(pred=preds[:10].round()))

import numpy as np
import pandas as pd
import joblib
from datetime import datetime


from db import load_data
from features import build_features

MODEL_OUT = "model.joblib"

bundle       = joblib.load(MODEL_OUT)
model        = bundle["model"]
categories   = bundle["categories"]
feature_cols = bundle["features"]
model_name   = bundle.get("model_name", "RandomForest")

DROP_NA = ["lag_1", "lag_2", "lag_3", "lag_5", "roll_3", "roll_10"]

def predict_next_week(promo=None, service_level=None):     # to do : promo/service_level
    hist = load_data()

    last_week = hist["week"].max()
    next_week = last_week +1

    # carry forward latest row value to next week
    latest = hist.sort_values("week").groupby(["centre_id", "meal_id"]).tail(1).copy()
    latest = latest[latest["week"] == last_week]
    latest["week"]       = next_week
    latest["num_orders"] = np.nan

    
    feat = build_features(pd.concat([hist, latest], ignore_index=True), categories)
    fut  = feat[feat["week"] == next_week].copy()
    fut  = fut.dropna(subset=DROP_NA)

    fut["predicted_demand"] = np.clip(model.predict(fut[feature_cols]), 0, None).round()

    # To do : real safety stock from formula
    fut["safety_stock"]     = 0
    fut["recommended_prep"] = fut["predicted_demand"] + fut["safety_stock"]

    fut["last_week_orders"] = fut["lag_1"].round()
    fut["model_name"]       = model_name
    fut["generated_at"]     = datetime.now().isoformat(timespec="seconds")

    cols = ["centre_id", "meal_id", "week", "predicted_demand", "safety_stock",
            "recommended_prep", "model_name", "generated_at", "last_week_orders"]
    return fut[cols]

# predict selected centre
def forecast_centre(centre_id, promo=None, discount=0.0, service_level=None):
    hist = load_data()
    hist = hist[hist["centre_id"] == centre_id]

    last_week = hist["week"].max()
    next_week = last_week +1

    # carry forward latest row value to next week
    latest = hist.sort_values("week").groupby(["centre_id", "meal_id"]).tail(1).copy()
    latest = latest[latest["week"] == last_week]
    latest["week"]       = next_week
    latest["num_orders"] = np.nan

    if promo is not None:
        latest["emailer_for_promotion"] = int(promo)

    if discount:
        latest["checkout_price"] = latest["base_price"] * (1 - discount)


    
    feat = build_features(pd.concat([hist, latest], ignore_index=True), categories)
    fut  = feat[feat["week"] == next_week].copy()
    fut  = fut.dropna(subset=DROP_NA)

    fut["predicted_demand"] = np.clip(model.predict(fut[feature_cols]), 0, None).round()

    # To do : real safety stock from formula
    fut["safety_stock"]     = 0
    fut["recommended_prep"] = fut["predicted_demand"] + fut["safety_stock"]

    fut["last_week_orders"] = fut["lag_1"].round()
    fut["model_name"]       = model_name
    fut["generated_at"]     = datetime.now().isoformat(timespec="seconds")

    cols = ["centre_id", "meal_id", "category", "cuisine", "week", "predicted_demand",
        "safety_stock", "recommended_prep", "model_name", "generated_at", "last_week_orders"]
    return fut[cols].to_dict("records")



pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)

if __name__ == "__main__":
    df = predict_next_week()
    #print(df.shape)
    #print(df.head())
    print(forecast_centre(10)[:3])          # first 3 meals, no promo
    print(forecast_centre(10, promo=1)[:3]) # same, promo ON

