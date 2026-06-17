PRAGMA foreign_keys = ON;


CREATE TABLE meal (
    meal_id  INTEGER PRIMARY KEY,
    category TEXT,
    cuisine  TEXT
);
CREATE TABLE centre (
    centre_id INTEGER PRIMARY KEY,
    city_code INTEGER,
    region_code INTEGER,
    centre_type TEXT,
    op_area REAL,
    centre_name TEXT
);
CREATE TABLE demand_history (
    demand_id INTEGER PRIMARY KEY,
    centre_id INTEGER NOT NULL,
    meal_id INTEGER NOT NULL,
    week INTEGER NOT NULL,
    num_orders INTEGER,
    checkout_price REAL,
    base_price REAL,
    emailer_for_promotion INTEGER,
    homepage_featured INTEGER,
    FOREIGN KEY (centre_id) REFERENCES centre(centre_id),
    FOREIGN KEY (meal_id)   REFERENCES meal(meal_id),
    UNIQUE (centre_id, meal_id, week)
);
CREATE TABLE forecast (
    forecast_id INTEGER PRIMARY KEY AUTOINCREMENT,
    centre_id INTEGER NOT NULL,
    meal_id INTEGER NOT NULL,
    week INTEGER NOT NULL,
    predicted_demand REAL,
    safety_stock REAL,
    recommended_prep REAL,
    model_name TEXT,
    generated_at TEXT,
    last_week_orders INTEGER,
    FOREIGN KEY (centre_id) REFERENCES centre(centre_id),
    FOREIGN KEY (meal_id)   REFERENCES meal(meal_id)
);
CREATE TABLE prep_plan (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    centre_id INTEGER NOT NULL,
    meal_id INTEGER NOT NULL,
    week INTEGER NOT NULL,
    recommended_prep REAL,
    planned_prep REAL,
    status TEXT,
    saved_at TEXT,
    FOREIGN KEY (centre_id) REFERENCES centre(centre_id),
    FOREIGN KEY (meal_id)   REFERENCES meal(meal_id)
);


