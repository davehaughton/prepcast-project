from flask import Flask, jsonify, request, render_template
import sqlite3
import pandas as pd

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
    return jsonify(rows)


if __name__ == "__main__":
    app.run(debug=True, port=5003)


