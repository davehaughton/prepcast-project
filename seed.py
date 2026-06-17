import sqlite3
import pandas as pd
from pathlib import Path

DB   = 'prepcast.db'
DATA = 'dataset' 

CENTRE_NAMES = {}

Path(DB).unlink(missing_ok=True)

conn = sqlite3.connect(DB)
conn.execute("PRAGMA foreign_keys = ON;")

conn.executescript(open('schema.sql').read())


# centre 
centre = pd.read_csv(f'{DATA}/fulfilment_center_info.csv')
centre = centre.rename(columns={'center_id': 'centre_id', 'center_type': 'centre_type'})
centre["centre_name"] = centre["centre_id"].map(CENTRE_NAMES)

centre.to_sql('centre', conn, if_exists='append', index=False)

# meal 
meal = pd.read_csv(f'{DATA}/meal_info.csv')
meal.to_sql('meal', conn, if_exists='append', index=False)

# demand_history  
demand = pd.read_csv(f'{DATA}/train.csv')
demand = demand.rename(columns={'id': 'demand_id', 'center_id': 'centre_id'})
demand.to_sql('demand_history', conn, if_exists='append', index=False)

conn.commit()
for t in ['centre', 'meal', 'demand_history', 'forecast', 'prep_plan']:
    print(t, conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0])
conn.close()
