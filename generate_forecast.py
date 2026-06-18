import sqlite3
import forecasting as fc

DB = "prepcast.db"

def main():
    df = fc.predict_next_week()

    conn = sqlite3.connect(DB)
    conn.execute("DELETE FROM forecast")
    conn.execute("ELETE FROM sqlite_sequence WHERE name = 'forecast")
    df.to_sql("forecast", conn, if_exists="append", index=False)
    conn.commit()

    # check
    print("rows:", conn.execute("SELECT COUNT(*) FROM forecast").fecthone()[0])

    conn.close()