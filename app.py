from flask import Flask, jsonify, request
import sqlite3
import pandas as pd

app = Flask(__name__)
DB = "prepcast.db"

def query(sql, params=()):
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(sql, conn, params=params)
    conn.close()
    return df



@app.route("/")
def index():
    df = query("SELECT * FROM forecast WHERE centre_id = 10")
    return jsonify(df.to_dict(orient="records"))

@app.route("/api/centres")
def centres():
    df = query("SELECT centre_id, centre_type "
        "FROM centre ORDER BY centre_id")
    return jsonify(df.to_dict(orient="records"))

@app.route("/api/forecast")
def forecast():
    centre_id = request.args.get("centre_id", type=int)
    df = query(
        "SELECT f.meal_id, m.category, m.cuisine, "
            "f.last_week_orders, f.predicted_demand, f.safety_stock, f.recommended_prep "
            "FROM forecast f "
            "JOIN meal m ON m.meal_id = f.meal_id "
            "WHERE f.centre_id = ? "
            "ORDER BY f.last_week_orders DESC", (centre_id,)
        )
    return jsonify(df.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True, port=5003)


