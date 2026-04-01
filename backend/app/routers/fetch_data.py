# backend/app/routers/fetch_data.py

from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
import datetime

router = APIRouter(
    prefix="/fetch",
    tags=["FetchData"]
)

@router.get("/{ticker}")
def fetch_stock_data(ticker: str, days: int = 180):
    try:
        end = datetime.date.today()
        start = end - datetime.timedelta(days=days)
        df = yf.download(ticker, start=start, end=end, progress=False)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker: {ticker}")

        df.reset_index(inplace=True)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[0] for col in df.columns]

        df["Date"] = df["Date"].astype(str)
        records = df[["Date", "Close"]].rename(
            columns={"Date": "date", "Close": "close"}
        ).to_dict(orient="records")

        return {"ticker": ticker.upper(), "data": records}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
