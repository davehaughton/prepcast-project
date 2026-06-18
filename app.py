from flask import Flask
import sqlite3
import pandas as pd

app = Flask(__name__)
DB = "prepcast.db"


@app.route("/")
def index():
   return 'test'


if __name__ == "__main__":
    app.run(debug=True)
