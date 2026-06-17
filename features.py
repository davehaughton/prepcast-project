import pandas as pd
import numpy as np

 # lag_1/2/3/5
def add_lags(df): 
    df = df.copy()
    for n in (1, 2, 3, 5):
        df[f'lag_{n}'] = df.groupby(['centre_id','meal_id'])['num_orders'].shift(n)
    return df   

# roll_3/10 (shift(1))
def add_rolling(df): 
    df = df.copy()
    g = df.groupby(['centre_id', 'meal_id'])['num_orders']
    df['roll_3']  = g.transform(lambda s: s.shift(1).rolling(3).mean())
    df['roll_10'] = g.transform(lambda s: s.shift(1).rolling(10).mean())
    return df

# discount   
def add_price_features(df):  
    df = df.copy()
    base = df['base_price'].replace(0, np.nan)                     
    df['discount'] = ((df['base_price'] - df['checkout_price']) / base).fillna(0)  
    return df

# week_of_year
def add_calendar(df):  
    df = df.copy()
    df['week_of_year'] = ((df['week'] - 1) % 52) + 1
    return df


