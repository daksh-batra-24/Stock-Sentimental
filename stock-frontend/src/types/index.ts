// src/types/index.ts

export interface HistoricalPrice {
  date: string;
  close: number;
  predicted?: boolean;
}

export type { PredictionResult, SentimentData, AccuracyData, HeatmapEntry } from "../api/stockApi";
