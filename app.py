from flask import Flask, jsonify, request, render_template, session, redirect, url_for
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

app.secret_key = "kf9$2mLpQ7zR1xV8wadhg3Nc0"

# login form
@app.route("/login") 
def login():
    centres = query("SELECT centre_id, centre_name FROM centre ORDER BY centre_id").to_dict(orient="records")
    return render_template("login.html", centres=centres)
# process form
@app.route("/login", methods=["POST"]) 
def do_login():
    session["centre_id"] = request.form["centre_id"]
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/")
def index():
    if "centre_id" not in session:
        return redirect(url_for("login"))
    row = query("SELECT centre_name FROM centre WHERE centre_id = ?", (session["centre_id"],))
    centre_name = row["centre_name"][0]
    return render_template("index.html", centre_id=session["centre_id"], centre_name=centre_name)

   


@app.route("/sales")
def sales():
    if "centre_id" not in session:
        return redirect(url_for("login"))
    row = query("SELECT centre_name FROM centre WHERE centre_id = ?", (session["centre_id"],))
    centre_name = row["centre_name"][0]
    return render_template("sales.html", centre_id=session["centre_id"], centre_name=centre_name)


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
            "(centre_id, meal_id, week, predicted_demand, safety_stock, "
            "recommended_prep, planned_prep, status, saved_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (centre_id, it["meal_id"], week,
             it["predicted_demand"], it["safety_stock"],
             it["recommended_prep"], it["planned_prep"], "saved", saved_at))


    conn.commit()
    conn.close()
    return jsonify({"status":"ok","saved":len(items)})


# read the committed plan for the current (not-yet-closed) week
@app.route("/api/actuals")
def get_actuals():
    centre_id = request.args.get("centre_id", type=int)

    # current week = the week we are forecasting = last actual week + 1
    wk = query("SELECT MAX(week) AS m FROM demand_history WHERE centre_id = ?",
               (centre_id,))
    last_week = int(wk["m"][0])
    week = last_week + 1

    rows = query(
        "SELECT p.meal_id, m.category, m.cuisine, "
        "p.predicted_demand, p.safety_stock, p.recommended_prep, "
        "p.planned_prep, p.actual_sales "
        "FROM prep_plan p JOIN meal m ON m.meal_id = p.meal_id "
        "WHERE p.centre_id = ? AND p.week = ? "
        "ORDER BY p.meal_id",
        (centre_id, week))

    items = rows.to_dict(orient="records")
    # states: no committed plan, open for entry, or already closed
    if not items:
        state = "no_plan"
    elif all(it["actual_sales"] is not None for it in items):
        state = "closed"
    else:
        state = "open"

    # last 6 weeks of actual demand per meal -> drives the plan-vs-actual chart
    HIST_WEEKS = 6
    hist_weeks = list(range(week - HIST_WEEKS, week))
    if items and hist_weeks:
        ph = ",".join("?" * len(hist_weeks))
        hist_df = query(
            f"SELECT meal_id, week, num_orders FROM demand_history "
            f"WHERE centre_id = ? AND week IN ({ph}) ORDER BY meal_id, week",
            tuple([centre_id] + hist_weeks))
        hist_by_meal = {
            mid: dict(zip(g["week"], g["num_orders"]))
            for mid, g in hist_df.groupby("meal_id")
        }
        for it in items:
            wk = hist_by_meal.get(it["meal_id"], {})
            it["history"] = [int(wk[w]) if w in wk else None for w in hist_weeks]

    return jsonify({"centre_id": centre_id, "week": week, "state": state,
                    "hist_weeks": hist_weeks, "items": items})


# save actual sales: write history (rolls the week) + record on the plan
@app.route("/api/actuals", methods=["POST"])
def save_actuals():
    data = request.get_json()
    centre_id = data["centre_id"]
    week = data["week"]
    items = data["items"]       

    conn = sqlite3.connect(DB)
    try:
        for it in items:
            # carry forward this meal's most recent price/promo values
            prev = conn.execute(
                "SELECT checkout_price, base_price, emailer_for_promotion, homepage_featured "
                "FROM demand_history WHERE centre_id = ? AND meal_id = ? AND week < ? "
                "ORDER BY week DESC LIMIT 1",
                (centre_id, it["meal_id"], week)).fetchone()
            checkout_price, base_price, promo, featured = prev if prev else (None, None, 0, 0)

            # actual sales become a real demand_history row -> MAX(week) advances
            conn.execute(
                "INSERT INTO demand_history "
                "(centre_id, meal_id, week, num_orders, checkout_price, base_price, "
                "emailer_for_promotion, homepage_featured) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (centre_id, it["meal_id"], week, it["actual_sales"],
                 checkout_price, base_price, promo, featured))

            # record the actual against the plan for plan-vs-actual comparison
            conn.execute(
                "UPDATE prep_plan SET actual_sales = ? "
                "WHERE centre_id = ? AND meal_id = ? AND week = ?",
                (it["actual_sales"], centre_id, it["meal_id"], week))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 400

    conn.close()
    return jsonify({"status": "ok", "saved": len(items), "next_week": week + 1})


if __name__ == "__main__":
    app.run(debug=True, port=5003)


