import joblib

bundle = joblib.load('model.joblib')
model = bundle["model"]
cats  = bundle["categories"]

import train as tr

df = tr.load_data()
df = tr.build_features(df,cats)
df = df.dropna(subset=["lag_1", "lag_2", "lag_3", "lag_5", "roll_3", "roll_10"])
   
drop_cols = ['num_orders', 'id', 'category', 'cuisine', 'centre_type']
feature_cols = [c for c in df.columns if c not in drop_cols]

X = df[feature_cols]
preds = model.predict(X)
print(df[['week','num_orders']].head(10).assign(pred=preds[:10].round()))