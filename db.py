import sqlite3
import pandas as pd

DB = "prepcast.db"

# connect to db and query
def load_data():
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query("""
        SELECT d.centre_id, d.meal_id, d.week, d.num_orders,
            d.checkout_price, d.base_price, d.emailer_for_promotion, d.homepage_featured,
            c.city_code, c.region_code, c.centre_type, c.op_area,
            m.category, m.cuisine
        FROM demand_history d
        JOIN centre c ON c.centre_id = d.centre_id
        JOIN meal   m ON m.meal_id   = d.meal_id
    """, conn)
    conn.close()
    return df