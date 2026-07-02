import sqlite3
import pandas as pd
from pathlib import Path

DB   = 'prepcast.db'
DATA = 'dataset' 

CENTRE_NAMES = {
    10: "Dublin",       11: "Cork",          13: "Galway",        14: "Limerick",
    17: "Waterford",    20: "Drogheda",      23: "Dundalk",       24: "Swords",
    26: "Bray",         27: "Navan",         29: "Kilkenny",      30: "Ennis",
    32: "Carlow",       34: "Tralee",        36: "Newbridge",     39: "Portlaoise",
    41: "Balbriggan",   42: "Naas",          43: "Athlone",       50: "Mullingar",
    51: "Wexford",      52: "Letterkenny",   53: "Celbridge",     55: "Clonmel",
    57: "Greystones",   58: "Malahide",      59: "Leixlip",       61: "Sligo",
    64: "Tullamore",    65: "Killarney",     66: "Arklow",        67: "Cobh",
    68: "Castlebar",    72: "Midleton",      73: "Mallow",        74: "Ashbourne",
    75: "Laytown",      76: "Ballina",       77: "Enniscorthy",   80: "Wicklow",
    81: "Cavan",        83: "Youghal",       86: "Thurles",       88: "Dungarvan",
    89: "Maynooth",     91: "Ballinasloe",   92: "Roscommon",     93: "Nenagh",
    94: "Trim",         97: "Tipperary",     99: "Athy",          101: "Longford",
    102: "Dunboyne",    104: "Skerries",     106: "Rush",         108: "Kells",
    109: "Bandon",      110: "Fermoy",       113: "Monaghan",     124: "Kinsale",
    126: "Westport",    129: "Carrigaline",  132: "Tramore",      137: "Gorey",
    139: "Shannon",     143: "Buncrana",     145: "Listowel",     146: "Loughrea",
    149: "Clonakilty",  152: "Birr",         153: "Macroom",      157: "Kilcock",
    161: "Carrickmacross", 162: "Bantry",    174: "Donegal",      177: "Boyle",
    186: "Cashel",
}

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
for t in ['centre', 'meal', 'demand_history', 'prep_plan']:
    print(t, conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0])
conn.close()
