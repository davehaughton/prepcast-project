from flask import Flask, jsonify, request, render_template
import sqlite3
import pandas as pd
from datetime import datetime

import forecasting as fc

app = Flask(__name__)
DB = "prepcast.db"

def query(sql, params=()):
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(sql, conn, params=params)
    conn.close()
    return df



@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/centres")
def centres():
    df = query("SELECT centre_id, centre_type "
        "FROM centre ORDER BY centre_id")
    return jsonify(df.to_dict(orient="records"))

@app.route("/api/forecast")
def forecast():
    centre_id = request.args.get("centre_id", type=int)
    promo = request.args.get("promo", type=int) 
    discount = request.args.get("discount", default=0.0, type=float)
    service_level = request.args.get("service_level", default=0.95, type=float)

    rows = fc.forecast_centre(centre_id, promo=promo, discount=discount, service_level=service_level)
   
   # merge save plans
    if rows:
        week = rows[0]["week"]
        saved = query(
            "SELECT meal_id, planned_prep FROM prep_plan WHERE centre_id = ? AND week = ?",
            (centre_id, week))
        planned_by_meal = dict(zip(saved["meal_id"], saved["planned_prep"]))
        for r in rows:
            r["planned_prep"] = planned_by_meal.get(r["meal_id"], r["recommended_prep"])
   
    return jsonify(rows)


@app.route("/api/plan", methods=["POST"])
def save_plan():
    data = request.get_json()
    centre_id = data["centre_id"]
    week = data["week"]
    items = data["items"]
    saved_at = datetime.now().isoformat(timespec="seconds")

    conn = sqlite3.connect(DB)

    # remove any existing plan from this row
    conn.execute("DELETE FROM prep_plan WHERE centre_id = ? AND week = ?",
                 (centre_id, week))
    
    # insert each row 
    for it in items:
        conn.execute(
            "INSERT INTO prep_plan "
            "(centre_id, meal_id, week, recommended_prep, planned_prep, status, saved_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (centre_id, it["meal_id"], week,
             it["recommended_prep"], it["planned_prep"], "saved", saved_at))


    conn.commit()
    conn.close()
    return jsonify({"status":"ok","saved":len(items)})

if __name__ == "__main__":
    app.run(debug=True, port=5003)


