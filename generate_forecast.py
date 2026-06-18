import sqlite3
import forecasting as fc

DB = "prepcast.db"

def main():
    df = fc.predict_next_week()