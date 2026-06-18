from flask import Flask
import sqlite3
import pandas as pd

app = Flask(__name__)
DB = "prepcast.db"


@app.route("/")
def index():
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query("SELECT * FROM forecast WHERE centre_id = 10", conn)
    conn.close()
    return df.to_html(index=False)


if __name__ == "__main__":
    app.run(debug=True)
