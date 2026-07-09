# Unit tests 1: feature engineering

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# make the project root importable when running pytest from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from features import (
    add_lags,
    add_rolling,
    add_price_features,
    add_calendar,
    encode_categoricals,
    learn_categories,
    build_features,
)


# ---- lags ----
def test_lag_1_is_previous_week_within_group():
    # lag_1 = same meal's previous week
    df = pd.DataFrame({
        'centre_id':  [1, 1, 1],
        'meal_id':    [10, 10, 10],
        'week':       [1, 2, 3],
        'num_orders': [100, 110, 120],
    })
    out = add_lags(df).sort_values('week')
    assert out[out.week == 2]['lag_1'].iloc[0] == 100
    assert out[out.week == 3]['lag_1'].iloc[0] == 110


def test_lags_do_not_leak_across_meals():
    # lags must not leak across meals (no data leakage)
    df = pd.DataFrame({
        'centre_id':  [1, 1, 1, 1],
        'meal_id':    [10, 10, 20, 20],
        'week':       [1, 2, 1, 2],
        'num_orders': [100, 110, 5, 6],
    })
    out = add_lags(df)
    # meal 20's first week has no prior of its own -> NaN, NOT meal 10's value
    first_20 = out[(out.meal_id == 20) & (out.week == 1)]['lag_1'].iloc[0]
    assert pd.isna(first_20)
    # meal 20 week 2 lag_1 is meal 20 week 1 (5), not anything from meal 10
    assert out[(out.meal_id == 20) & (out.week == 2)]['lag_1'].iloc[0] == 5


# ---- rolling mean ----
def test_roll_3_is_mean_of_prior_three_weeks():
    # roll_3 = mean of the 3 prior weeks (shift(1))
    df = pd.DataFrame({
        'centre_id':  [1] * 5,
        'meal_id':    [10] * 5,
        'week':       [1, 2, 3, 4, 5],
        'num_orders': [10, 20, 30, 40, 50],
    })
    out = add_rolling(df).sort_values('week')
    # week 5 -> mean(20, 30, 40) = 30  (excludes week 5 itself via shift(1))
    assert out[out.week == 5]['roll_3'].iloc[0] == 30
    # week 3 has only 2 prior weeks -> not enough for a 3-window -> NaN
    assert pd.isna(out[out.week == 3]['roll_3'].iloc[0])


# ---- discount / price ----
def test_discount_normal_case():
    df = pd.DataFrame({'base_price': [100.0], 'checkout_price': [80.0]})
    out = add_price_features(df)
    assert out['discount'].iloc[0] == pytest.approx(0.2)


def test_discount_zero_base_price_is_zero_not_inf():
    # base_price 0 -> discount 0, not inf/NaN
    df = pd.DataFrame({'base_price': [0.0], 'checkout_price': [10.0]})
    out = add_price_features(df)
    val = out['discount'].iloc[0]
    assert val == 0
    assert np.isfinite(val)


# ---- calendar ----
def test_week_of_year_wraps_at_52():
    df = pd.DataFrame({'week': [1, 52, 53, 104, 145]})
    out = add_calendar(df)
    assert list(out['week_of_year']) == [1, 52, 1, 52, 41]


# ---- categorical encoding ----
def test_learn_categories_are_sorted_unique():
    df = pd.DataFrame({
        'category':    ['Beverages', 'Rice Bowl', 'Beverages'],
        'cuisine':     ['Italian', 'Indian', 'Italian'],
        'centre_type': ['TYPE_A', 'TYPE_B', 'TYPE_A'],
    })
    cats = learn_categories(df)
    assert cats['category'] == ['Beverages', 'Rice Bowl']
    assert cats['cuisine'] == ['Indian', 'Italian']


def test_category_codes_are_stable_with_fixed_mapping():
    # same category -> same code regardless of row order
    cats = {'category': ['Beverages', 'Rice Bowl'],
            'cuisine': ['Indian', 'Italian'],
            'centre_type': ['TYPE_A', 'TYPE_B']}
    df1 = pd.DataFrame({'category': ['Rice Bowl'], 'cuisine': ['Italian'], 'centre_type': ['TYPE_B']})
    df2 = pd.DataFrame({'category': ['Beverages', 'Rice Bowl'], 'cuisine': ['Indian', 'Italian'], 'centre_type': ['TYPE_A', 'TYPE_B']})
    out1 = encode_categoricals(df1, cats)
    out2 = encode_categoricals(df2, cats)
    # 'Rice Bowl' -> code 1 in both frames
    assert out1['category_code'].iloc[0] == 1
    assert out2[out2.category == 'Rice Bowl']['category_code'].iloc[0] == 1


# ---- end-to-end feature build ----
def test_build_features_adds_all_expected_columns():
    df = pd.DataFrame({
        'centre_id':  [1] * 6,
        'meal_id':    [10] * 6,
        'week':       [1, 2, 3, 4, 5, 6],
        'num_orders': [10, 20, 30, 40, 50, 60],
        'base_price': [100.0] * 6,
        'checkout_price': [90.0] * 6,
        'category':    ['Beverages'] * 6,
        'cuisine':     ['Italian'] * 6,
        'centre_type': ['TYPE_A'] * 6,
    })
    out = build_features(df)
    for col in ['lag_1', 'lag_2', 'lag_3', 'lag_5', 'roll_3', 'roll_10',
                'discount', 'week_of_year', 'category_code']:
        assert col in out.columns
