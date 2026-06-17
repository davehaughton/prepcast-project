import sqlite3
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score


DATA = 'dataset'

orders = pd.read_csv(f'{DATA}/train.csv')
centres = pd.read_csv(f'{DATA}/fulfilment_center_info.csv')
meals = pd.read_csv(f'{DATA}/meal_info.csv')
df = orders.merge(centres, on='center_id', how='left').merge(meals, on='meal_id', how='left')

df = df.rename(columns={
    'center_id': 'centre_id',
    'center_type': 'centre_type',
})

df = df.sort_values(['centre_id','meal_id','week']).reset_index(drop=True)

for n in (1, 2, 3, 5):
    df[f'lag_{n}'] = df.groupby(['centre_id','meal_id'])['num_orders'].shift(n)

g = df.groupby(['centre_id','meal_id'])['num_orders']
df['roll_3']  = g.transform(lambda s: s.shift(1).rolling(3).mean())
df['roll_10'] = g.transform(lambda s: s.shift(1).rolling(10).mean())

base = df['base_price'].replace(0, np.nan)                     
df['discount'] = ((df['base_price'] - df['checkout_price']) / base).fillna(0)  

df['week_of_year'] = ((df['week'] - 1) % 52) + 1

for col in ['category', 'cuisine', 'centre_type']:
    df[col + '_code'] = df[col].astype('category').cat.codes

df = df.dropna(subset=['lag_1','lag_2','lag_3','lag_5','roll_3','roll_10'])

drop_cols = ['num_orders', 'id', 'category', 'cuisine', 'centre_type']
feature_cols = [c for c in df.columns if c not in drop_cols]
X = df[feature_cols]
y = df['num_orders']

# Split data

cutoff = df['week'].max() - 10    # hold out the last 10 weeks
train = df[df['week'] <= cutoff]
test  = df[df['week'] >  cutoff]

X_train, y_train = train[feature_cols], train['num_orders']
X_test,  y_test  = test[feature_cols],  test['num_orders']

models = {
    'LinearRegression': LinearRegression(),
    'RandomForest': RandomForestRegressor(n_estimators=100, max_depth=18,
                        max_samples=0.5, n_jobs=-1, random_state=42),
    'GradientBoosting': HistGradientBoostingRegressor(max_iter=300, random_state=42),
}

model = models['RandomForest']
model.fit(X_train, y_train)   
print("trained on", len(X_train), "rows")
joblib.dump(model, 'model.joblib')