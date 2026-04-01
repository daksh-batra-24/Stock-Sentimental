# backend/app/database/crud.py

from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import models


def create_prediction(
    db: Session,
    ticker: str,
    best_model: str,
    predicted_price: float,
    predicted_direction: str,
    direction_metrics: dict,
    price_metrics: dict,
    model_version: str = None,
):
    stacked = direction_metrics.get("stacked", {})
    new_record = models.PredictionResult(
        ticker=ticker,
        best_model=best_model,
        direction_accuracy=float(stacked.get("accuracy", 0)),
        direction_precision=float(stacked.get("precision", 0)),
        direction_recall=float(stacked.get("recall", 0)),
        direction_f1=float(stacked.get("f1", 0)),
        price_mae=float(price_metrics.get("stacked", {}).get("MAE", 0)),
        price_rmse=float(price_metrics.get("stacked", {}).get("RMSE", 0)),
        price_r2=float(price_metrics.get("stacked", {}).get("R2", 0)),
        predicted_price=float(predicted_price),
        predicted_direction=predicted_direction,
        model_version=model_version,
        metrics_json={"direction": direction_metrics, "price": price_metrics},
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


def get_all_predictions(db: Session):
    return db.query(models.PredictionResult).order_by(models.PredictionResult.id.desc()).all()


def get_predictions_by_ticker(db: Session, ticker: str):
    return (
        db.query(models.PredictionResult)
        .filter(models.PredictionResult.ticker == ticker)
        .order_by(models.PredictionResult.id.desc())
        .all()
    )


def get_latest_predictions_all_tickers(db: Session):
    """Return the single most-recent prediction for every ticker."""
    subq = (
        db.query(
            models.PredictionResult.ticker,
            func.max(models.PredictionResult.id).label("max_id"),
        )
        .group_by(models.PredictionResult.ticker)
        .subquery()
    )
    return (
        db.query(models.PredictionResult)
        .join(subq, models.PredictionResult.id == subq.c.max_id)
        .all()
    )
