# backend/app/routers/prediction.py

import datetime
import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.db_setup import get_db
from backend.app.database import crud
from scripts.train_and_evaluate import run_pipeline_stacked

router = APIRouter(prefix="/predict", tags=["Prediction"])


# ------------------------------------------------------
# 0️⃣  Sector heatmap — latest prediction per ticker
#     NOTE: must be defined BEFORE /{ticker} route
# ------------------------------------------------------
@router.get("/heatmap")
def get_heatmap(db: Session = Depends(get_db)):
    records = crud.get_latest_predictions_all_tickers(db=db)
    return {
        "data": [
            {
                "ticker": r.ticker,
                "direction": r.predicted_direction,
                "price": r.predicted_price,
            }
            for r in records
        ]
    }


# ------------------------------------------------------
# 1️⃣  Run prediction and save to DB
# ------------------------------------------------------
@router.get("/{ticker}")
def predict_stock(ticker: str, db: Session = Depends(get_db)):
    try:
        print(f"📊 Running prediction for {ticker}...")
        results = run_pipeline_stacked(ticker)

        if not results or "predicted_price" not in results or "predicted_direction" not in results:
            raise HTTPException(status_code=400, detail="Prediction failed or invalid response.")

        crud.create_prediction(
            db=db,
            ticker=ticker.upper(),
            best_model=results.get("best_model"),
            predicted_price=float(results.get("predicted_price")),
            predicted_direction=results.get("predicted_direction"),
            direction_metrics=results.get("direction_metrics", {}),
            price_metrics=results.get("price_metrics", {}),
            model_version=results.get("model_version"),
        )

        return {
            "ticker": ticker.upper(),
            "best_model": results.get("best_model", "stacked"),
            "model_version": results.get("model_version"),
            "predicted_price": results["predicted_price"],
            "predicted_direction": results["predicted_direction"],
            "bull_price": results.get("bull_price"),
            "bear_price": results.get("bear_price"),
            "price_std": results.get("price_std"),
            "metrics": {
                "price": results["price_metrics"]["stacked"],
                "direction": results["direction_metrics"]["stacked"],
            },
            "feature_importances": results.get("feature_importances", []),
            "message": "✅ Prediction saved successfully.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------
# 2️⃣  Prediction history for a ticker
# ------------------------------------------------------
@router.get("/history/{ticker}")
def get_prediction_history(ticker: str, db: Session = Depends(get_db)):
    history = crud.get_predictions_by_ticker(db=db, ticker=ticker.upper())
    if not history:
        raise HTTPException(status_code=404, detail="No predictions found for this ticker.")
    return {
        "ticker": ticker.upper(),
        "records": [
            {
                "id": r.id,
                "best_model": r.best_model,
                "predicted_price": r.predicted_price,
                "predicted_direction": r.predicted_direction,
                "created_at": r.created_at,
                "direction_accuracy": r.direction_accuracy,
                "price_mae": r.price_mae,
                "model_version": r.model_version,
            }
            for r in history
        ],
    }


# ------------------------------------------------------
# 3️⃣  Accuracy tracker — compare stored predictions
#      against actual next-day closes via yfinance
# ------------------------------------------------------
@router.get("/accuracy/{ticker}")
def get_accuracy(ticker: str, db: Session = Depends(get_db)):
    history = crud.get_predictions_by_ticker(db=db, ticker=ticker.upper())
    if not history:
        raise HTTPException(status_code=404, detail="No predictions found for this ticker.")

    # Download enough price history to cover stored predictions
    end = datetime.date.today() + datetime.timedelta(days=1)
    start = end - datetime.timedelta(days=90)
    df = yf.download(ticker, start=start, end=end, progress=False)
    df.reset_index(inplace=True)
    if hasattr(df.columns, "levels"):
        df.columns = [c[0] for c in df.columns]
    price_by_date = {str(row["Date"].date()): float(row["Close"]) for _, row in df.iterrows()}

    results = []
    correct = 0
    total = 0

    for r in history:
        if not r.created_at:
            continue
        pred_date = r.created_at.date()
        # Find actual close on prediction date + 1 trading day
        check_date = pred_date + datetime.timedelta(days=1)
        actual = None
        for i in range(5):  # skip weekends / holidays
            key = str(check_date + datetime.timedelta(days=i))
            if key in price_by_date:
                actual = price_by_date[key]
                break
        if actual is None:
            continue

        # Previous close (day of prediction) to determine actual direction
        prev = price_by_date.get(str(pred_date))
        if prev is None:
            continue

        actual_direction = "up" if actual >= prev else "down"
        is_correct = actual_direction == r.predicted_direction
        if is_correct:
            correct += 1
        total += 1

        results.append({
            "date": str(pred_date),
            "predicted_price": r.predicted_price,
            "actual_price": actual,
            "predicted_direction": r.predicted_direction,
            "actual_direction": actual_direction,
            "correct": is_correct,
        })

    return {
        "ticker": ticker.upper(),
        "total": total,
        "correct": correct,
        "accuracy": round(correct / total, 4) if total > 0 else None,
        "records": results,
    }
