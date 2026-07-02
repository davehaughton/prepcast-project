import sqlite3
import forecasting as fc

DB = "prepcast.db"

def main():
    df = fc.predict_next_week()

    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("DELETE FROM forecast")
    conn.execute("DELETE FROM sqlite_sequence WHERE name = 'forecast'")
    df.to_sql("forecast", conn, if_exists="append", index=False)
    conn.commit()

    # check
    print("rows:", conn.execute("SELECT COUNT(*) FROM forecast").fetchone()[0])
    print("fk check:", conn.execute("PRAGMA foreign_key_check").fetchall())
    print(df.head(3).to_string())
    conn.close()


if __name__ == "__main__":
    main()