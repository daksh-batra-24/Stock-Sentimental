import axios from "axios";

export const BASE_URL = "http://localhost:8000";

// ---------- Static ticker list ----------
export const getAllTickers = (): string[] => [
  "AAPL","MSFT","GOOGL","AMZN","TSLA","META","NVDA","JPM","V","JNJ",
  "WMT","PG","DIS","MA","HD","BAC","XOM","KO","PFE","CSCO",
  "INTC","VZ","CVX","ADBE","NFLX","T","MRK","PEP","ABBV","CRM",
  "NKE","ORCL","ABT","ACN","LLY","AVGO","COST","QCOM","MDT","MCD",
  "TXN","NEE","UNH","HON","DHR","LIN","AMGN","BMY","SBUX","TMUS"
];

// ---------- Types ----------
export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface SentimentHeadline {
  title: string;
  score: number;
}

export interface SentimentData {
  ticker: string;
  sentiment_score: number;
  sentiment_label: "Positive" | "Negative" | "Neutral";
  headlines: SentimentHeadline[];
}

export interface AccuracyRecord {
  date: string;
  predicted_price: number;
  actual_price: number;
  predicted_direction: string;
  actual_direction: string;
  correct: boolean;
}

export interface AccuracyData {
  ticker: string;
  total: number;
  correct: number;
  accuracy: number | null;
  records: AccuracyRecord[];
}

export interface HeatmapEntry {
  ticker: string;
  direction: "up" | "down" | null;
  price: number | null;
}

export interface PredictionResult {
  id?: number;
  ticker: string;
  best_model: string;
  model_version?: string;
  predicted_price: number;
  predicted_direction: string;
  bull_price?: number;
  bear_price?: number;
  price_std?: number;
  created_at?: string;

  // Flat metrics (set by normalizePrediction)
  price_mae?: number;
  price_rmse?: number;
  price_r2?: number;

  // Raw metrics from backend
  metrics?: {
    price?: { MAE: number; RMSE: number; R2: number };
    direction?: { accuracy: number; precision: number; recall: number; f1: number };
  };

  // Direction metrics (set by normalizePrediction)
  dir_metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
  };

  feature_importances?: FeatureImportance[];
}

// ---------- API calls ----------
export const fetchPrediction = async (ticker: string): Promise<PredictionResult> => {
  const res = await axios.get(`${BASE_URL}/predict/${ticker}`);
  return res.data as PredictionResult;
};

export const fetchPredictionHistory = async (ticker: string): Promise<PredictionResult[]> => {
  const res = await axios.get(`${BASE_URL}/predict/history/${ticker}`);
  return res.data.records as PredictionResult[];
};

export const fetchSentiment = async (ticker: string): Promise<SentimentData> => {
  const res = await axios.get(`${BASE_URL}/sentiment/${ticker}`);
  return res.data as SentimentData;
};

export const fetchAccuracy = async (ticker: string): Promise<AccuracyData> => {
  const res = await axios.get(`${BASE_URL}/predict/accuracy/${ticker}`);
  return res.data as AccuracyData;
};

export const fetchHeatmap = async (): Promise<HeatmapEntry[]> => {
  const res = await axios.get(`${BASE_URL}/predict/heatmap`);
  return res.data.data as HeatmapEntry[];
};
