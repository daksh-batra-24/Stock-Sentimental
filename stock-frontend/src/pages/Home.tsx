import React, { useState } from "react";
import TickerSelect from "../components/TickerSelect";
import PredictionResult from "../components/PredictionResult";
import type { PredictionResult as PredictionResultType } from "../api/stockApi";
import axios from "axios";

interface HistoricalDataPoint {
  date: string;
  close: number;
}

const BASE_FETCH_URL = "http://localhost:8000/fetch";

const Home: React.FC = () => {
  const [prediction, setPrediction] = useState<PredictionResultType | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizePrediction = (pred: any): PredictionResultType => ({
    ...pred,
    best_model: pred.best_model ?? pred.model,
    price_mae:  pred.price_mae  ?? pred.metrics?.price?.MAE,
    price_rmse: pred.price_rmse ?? pred.metrics?.price?.RMSE,
    price_r2:   pred.price_r2   ?? pred.metrics?.price?.R2,
    dir_metrics: pred.dir_metrics ?? pred.metrics?.direction,
  });

  const handlePredictionFetched = async (pred: any) => {
    const normalized = normalizePrediction(pred);
    setPrediction(normalized);
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_FETCH_URL}/${normalized.ticker}`);
      const histData: HistoricalDataPoint[] = res.data.data.map((d: any) => ({
        date: d.Date || d.date,
        close: parseFloat(d.Close || d.close),
      }));
      setHistoricalData(histData);
    } catch (err) {
      console.error("Failed to fetch historical data", err);
      setHistoricalData(
        Array.from({ length: 10 }).map((_, i) => ({
          date: new Date(Date.now() - (10 - i) * 86400000).toISOString().split("T")[0],
          close: normalized.predicted_price + Math.floor(Math.random() * 10 - 5),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {!prediction ? (
        <TickerSelect onPredictionFetched={handlePredictionFetched} />
      ) : (
        <>
          {loading && <p>Loading historical data...</p>}
          <PredictionResult prediction={prediction} historicalData={historicalData} />
        </>
      )}
    </div>
  );
};

export default Home;
