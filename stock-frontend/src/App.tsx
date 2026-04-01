import React, { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { TrendingUp, AlertCircle, RotateCcw } from "lucide-react";
import axios from "axios";
import TickerSelect from "./components/TickerSelect";
import PredictionResult from "./components/PredictionResult";
import SectorHeatmap from "./components/SectorHeatmap";
import type { PredictionResult as PredictionResultType, SentimentData, AccuracyData } from "./api/stockApi";
import { fetchSentiment, fetchAccuracy, BASE_URL } from "./api/stockApi";
import type { HistoricalPrice } from "./types";
import "./App.css";

const normalizePrediction = (pred: any): PredictionResultType => ({
  ...pred,
  best_model:  pred.best_model  ?? pred.model,
  price_mae:   pred.price_mae   ?? pred.metrics?.price?.MAE,
  price_rmse:  pred.price_rmse  ?? pred.metrics?.price?.RMSE,
  price_r2:    pred.price_r2    ?? pred.metrics?.price?.R2,
  dir_metrics: pred.dir_metrics ?? pred.metrics?.direction,
});

const pageVariants: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.25 } },
};

const App: React.FC = () => {
  const [prediction,    setPrediction]    = useState<PredictionResultType | null>(null);
  const [historicalData,setHistoricalData]= useState<HistoricalPrice[]>([]);
  const [loadingHistory,setLoadingHistory]= useState(false);
  const [sentiment,     setSentiment]     = useState<SentimentData | null>(null);
  const [accuracy,      setAccuracy]      = useState<AccuracyData  | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  // Tracks predictions made this session for the heatmap
  const [sessionMap,    setSessionMap]    = useState<Record<string, "up" | "down">>({});

  const handlePredictionFetched = async (pred: PredictionResultType) => {
    if (!pred) return;
    const normalized = normalizePrediction(pred);
    setPrediction(normalized);
    setSentiment(null);
    setAccuracy(null);
    setLoadingHistory(true);
    setError(null);

    // Update heatmap session map
    if (normalized.ticker && normalized.predicted_direction) {
      setSessionMap((prev) => ({
        ...prev,
        [normalized.ticker]: normalized.predicted_direction as "up" | "down",
      }));
    }

    // Fetch historical price data, sentiment, and accuracy in parallel
    const [histResult, sentResult, accResult] = await Promise.allSettled([
      axios.get(`${BASE_URL}/fetch/${normalized.ticker}`),
      fetchSentiment(normalized.ticker),
      fetchAccuracy(normalized.ticker),
    ]);

    // Historical prices
    if (histResult.status === "fulfilled") {
      const historical: HistoricalPrice[] = (histResult.value.data.data || []).map((d: any) => ({
        date:  d.date || d.Date,
        close: parseFloat(d.close ?? d.Close ?? 0),
        predicted: false,
      }));
      const last = historical[historical.length - 1];
      const nextDate = new Date(last?.date || new Date());
      nextDate.setDate(nextDate.getDate() + 1);
      historical.push({ date: nextDate.toISOString().split("T")[0], close: normalized.predicted_price ?? 0, predicted: true });
      setHistoricalData(historical);
    } else {
      setError("Could not load historical price data.");
      setHistoricalData([{ date: new Date().toISOString(), close: normalized.predicted_price ?? 0, predicted: true }]);
    }

    // Sentiment
    if (sentResult.status === "fulfilled") setSentiment(sentResult.value);

    // Accuracy (may 404 if no history yet — that's fine)
    if (accResult.status === "fulfilled") setAccuracy(accResult.value);

    setLoadingHistory(false);
  };

  const handleReset = () => {
    setPrediction(null);
    setHistoricalData([]);
    setSentiment(null);
    setAccuracy(null);
    setError(null);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon"><TrendingUp size={18} /></div>
          <span className="app-logo-text">Stock<span>Sense</span></span>
        </div>
        <span className="header-tag">AI-Powered Predictions</span>
      </header>

      <main className="app-main">
        <AnimatePresence mode="wait">
          {!prediction ? (
            <motion.div key="search" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="hero">
                <div className="hero-eyebrow">
                  <TrendingUp size={12} />
                  Machine Learning · Gradient Boosting · Sentiment Analysis
                </div>
                <h1 className="hero-title">
                  Predict Tomorrow's<br /><span>Stock Price</span>
                </h1>
                <p className="hero-sub">
                  Select a ticker to get an AI-powered next-day price prediction with confidence metrics.
                </p>
              </div>

              <TickerSelect onPredictionFetched={handlePredictionFetched} />
              <SectorHeatmap sessionMap={sessionMap} />
            </motion.div>
          ) : (
            <motion.div key="result" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="back-row">
                <button className="btn-ghost" onClick={handleReset}>
                  <RotateCcw size={14} /> New Prediction
                </button>
                <span className="header-tag">{prediction.ticker}</span>
              </div>

              {error && (
                <div className="error-banner">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <PredictionResult
                prediction={prediction}
                historicalData={historicalData}
                loadingHistory={loadingHistory}
                sentiment={sentiment}
                accuracy={accuracy}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
