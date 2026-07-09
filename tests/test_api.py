# unit tests 2: api integration

CENTRE_ID = 10


# forecast rows -> plan payload
def _plan_items(rows):
    return [{
        "meal_id":          r["meal_id"],
        "predicted_demand": r["predicted_demand"],
        "safety_stock":     r["safety_stock"],
        "recommended_prep": r["recommended_prep"],
        "planned_prep":     r["recommended_prep"],
    } for r in rows]


def _get_forecast(client):
    resp = client.get(f"/api/forecast?centre_id={CENTRE_ID}&promo=0&discount=0&service_level=0.95")
    assert resp.status_code == 200
    rows = resp.get_json()
    assert rows, "forecast returned no rows for this centre"
    return rows


# commit a plan, read it back
def test_commit_plan_round_trip(client):
    rows = _get_forecast(client)
    week = rows[0]["week"]

    resp = client.post("/api/plan", json={
        "centre_id": CENTRE_ID, "week": week, "items": _plan_items(rows),
    })
    assert resp.get_json()["status"] == "ok"

    back = client.get(f"/api/actuals?centre_id={CENTRE_ID}").get_json()
    assert back["state"] == "open"
    assert len(back["items"]) == len(rows)
    first = back["items"][0]
    assert first["predicted_demand"] is not None
    assert first["safety_stock"] is not None
    assert first["actual_sales"] is None               


# saving actuals rolls the week forward
def test_saving_actuals_rolls_the_week(client):
    rows = _get_forecast(client)
    week = rows[0]["week"]

    client.post("/api/plan", json={
        "centre_id": CENTRE_ID, "week": week, "items": _plan_items(rows),
    })

    actuals = [{"meal_id": r["meal_id"], "actual_sales": round(r["recommended_prep"])} for r in rows]
    resp = client.post("/api/actuals", json={
        "centre_id": CENTRE_ID, "week": week, "items": actuals,
    })
    body = resp.get_json()
    assert body["status"] == "ok"
    assert body["next_week"] == week + 1

    # week advanced
    after = client.get(f"/api/actuals?centre_id={CENTRE_ID}").get_json()
    assert after["week"] == week + 1
