import React, { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Target,
  Activity, Newspaper, GitBranch,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, AreaChart, ReferenceArea,
  BarChart, Bar, Cell,
} from "recharts";
import type { PredictionResult as PredictionResultType, SentimentData, AccuracyData } from "../api/stockApi";

interface Props {
  prediction: PredictionResultType;
  historicalData: { date: string; close: number; predicted?: boolean }[];
  loadingHistory?: boolean;
  sentiment?: SentimentData | null;
  accuracy?: AccuracyData | null;
}

// ── Animated price counter ──────────────────────────────────────────────────
const AnimatedPrice: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 900;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(eased * value);
      if (t < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>${display.toFixed(2)}</>;
};

// ── Chart helpers ────────────────────────────────────────────────────────────
const prepareChartData = (
  historical: { date: string; close: number; predicted?: boolean }[],
  predictedPrice: number
) => {
  if (!historical || historical.length === 0)
    return [{ date: new Date().toISOString().split("T")[0], close: predictedPrice, predicted: true }];
  const last = historical[historical.length - 1];
  if (last?.predicted) return historical;
  const nextDate = new Date(last.date);
  nextDate.setDate(nextDate.getDate() + 1);
  return [
    ...historical.map((d) => ({ ...d, predicted: false })),
    { date: nextDate.toISOString().split("T")[0], close: predictedPrice, predicted: true },
  ];
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const isPredicted = payload[0]?.payload?.predicted;
  return (
    <div style={{
      background: "rgba(15,15,42,0.95)",
      border: `1px solid ${isPredicted ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
      borderRadius: "var(--radius-md)",
      padding: "var(--space-3) var(--space-4)",
      fontSize: "var(--text-sm)",
    }}>
      <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-1)", fontSize: "var(--text-xs)" }}>{label}</p>
      <p style={{ fontWeight: 700, color: isPredicted ? "var(--accent-light)" : "var(--text-primary)" }}>
        ${Number(payload[0]?.value).toFixed(2)}
      </p>
      {isPredicted && <p style={{ fontSize: "var(--text-xs)", color: "var(--accent-light)", marginTop: "2px" }}>AI Predicted</p>}
    </div>
  );
};

// ── Sentiment bar ─────────────────────────────────────────────────────────────
const SentimentBar: React.FC<{ score: number }> = ({ score }) => {
  const pct  = ((score + 1) / 2) * 100;
  const color = score > 0.05 ? "#4ade80" : score < -0.05 ? "#f87171" : "#94a3b8";
  return (
    <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: color, borderRadius: 99 }}
      />
    </div>
  );
};

// ── Animation variants ───────────────────────────────────────────────────────
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp:  Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const SkeletonBlock = ({ h, w = "100%" }: { h: number; w?: string }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: "var(--radius-md)" }} />
);

// ── Feature name mapping ─────────────────────────────────────────────────────
const FN: Record<string, string> = {
  Close: "Close Price", Open: "Open", High: "Day High", Low: "Day Low",
  Volume: "Volume", Return1: "1-Day Return", Return3: "3-Day Return",
  Volatility3: "3-Day Volatility", Volatility7: "7-Day Volatility",
  MA5: "MA (5)", MA20: "MA (20)", EMA12: "EMA (12)", EMA26: "EMA (26)",
  MACD: "MACD", Signal: "MACD Signal", MACD_hist: "MACD Hist",
  RSI14: "RSI (14)", Momentum: "Momentum", VolSpike: "Vol Spike",
};
const displayFeat = (f: string) => FN[f] ?? f;

// ── Main component ───────────────────────────────────────────────────────────
const PredictionResult: React.FC<Props> = ({
  prediction, historicalData, loadingHistory, sentiment, accuracy,
}) => {
  if (!prediction) return null;

  const direction  = prediction.predicted_direction?.toLowerCase() || "";
  const isUp       = direction === "up";
  const isDown     = direction === "down";
  const chartData  = prepareChartData(historicalData, prediction.predicted_price ?? 0);
  const predPoint  = chartData.find((d) => d.predicted);
  const dir        = prediction.dir_metrics;
  const sentScore  = sentiment?.sentiment_score ?? null;
  const sentLabel  = sentiment?.sentiment_label;

  const metrics = [
    { label: "Best Model",   value: prediction.best_model?.toUpperCase() || "N/A",       icon: <Activity size={14} /> },
    { label: "Price MAE",    value: prediction.price_mae  != null ? `$${prediction.price_mae.toFixed(2)}`  : "N/A", icon: <Target size={14} /> },
    { label: "Price RMSE",   value: prediction.price_rmse != null ? `$${prediction.price_rmse.toFixed(2)}` : "N/A", icon: <BarChart2 size={14} /> },
    { label: "R²",           value: prediction.price_r2   != null ? prediction.price_r2.toFixed(3)         : "N/A", icon: <BarChart2 size={14} /> },
    { label: "Dir Accuracy", value: dir?.accuracy != null ? `${(dir.accuracy * 100).toFixed(1)}%` : "N/A", icon: <Target size={14} /> },
    { label: "Dir F1",       value: dir?.f1       != null ? `${(dir.f1       * 100).toFixed(1)}%` : "N/A", icon: <Activity size={14} /> },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="card" style={{
        padding: "var(--space-8)",
        background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(15,15,42,0.6) 100%)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>Next-Day Predicted Price</p>
            <p style={{ fontSize: "var(--text-4xl)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              <AnimatedPrice value={prediction.predicted_price ?? 0} />
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-3)" }}>
            <span className={`badge ${isUp ? "badge-up" : isDown ? "badge-down" : "badge-neutral"}`}>
              {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
              {direction.toUpperCase() || "NEUTRAL"}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {prediction.ticker} · AI Prediction
            </span>
            {prediction.model_version && (
              <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <GitBranch size={9} /> v{prediction.model_version}
              </span>
            )}
          </div>
        </div>

        {/* ── Price Targets ─────────────────────────────────── */}
        {prediction.bull_price != null && prediction.bear_price != null && (
          <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Price Targets (±1σ)
            </p>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
              {[
                { label: "Bull",  price: prediction.bull_price,               color: "#4ade80" },
                { label: "Base",  price: prediction.predicted_price,           color: "var(--accent-light)" },
                { label: "Bear",  price: prediction.bear_price,                color: "#f87171" },
              ].map(({ label, price, color }) => (
                <div key={label} style={{
                  flex: 1, minWidth: 80,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3) var(--space-4)",
                  textAlign: "center",
                }}>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>{label}</p>
                  <p style={{ fontSize: "var(--text-base)", fontWeight: 700, color }}>${price?.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Metrics Grid ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
          Model Metrics
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
          {metrics.map(({ label, value, icon }) => (
            <div key={label} className="stat-card">
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>{icon} {label}</span>
              <span className="stat-value" style={{ fontSize: "var(--text-lg)" }}>{value}</span>
            </div>
          ))}
          {accuracy?.accuracy != null && (
            <div className="stat-card">
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <Target size={14} /> Live Accuracy
              </span>
              <span className="stat-value" style={{ fontSize: "var(--text-lg)", color: "#4ade80" }}>
                {(accuracy.accuracy * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Chart ────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="card" style={{ padding: "var(--space-6)" }}>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-5)" }}>
          Price History & Prediction
        </p>
        {loadingHistory ? (
          <SkeletonBlock h={240} />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} interval="preserveStartEnd" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={60} />
              <Tooltip content={<CustomTooltip />} />
              {/* Confidence band */}
              {predPoint && prediction.bull_price != null && prediction.bear_price != null && (
                <ReferenceArea
                  x1={predPoint.date} x2={predPoint.date}
                  y1={prediction.bear_price} y2={prediction.bull_price}
                  fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.3)" strokeDasharray="4 4"
                />
              )}
              {predPoint && (
                <ReferenceLine
                  x={predPoint.date}
                  stroke="rgba(99,102,241,0.5)" strokeDasharray="4 4"
                  label={{ value: "Predicted", position: "insideTopRight", fontSize: 11, fill: "var(--accent-light)" }}
                />
              )}
              <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2} fill="url(#areaGradient)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload?.predicted) return <></>;
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#818cf8" stroke="rgba(99,102,241,0.4)" strokeWidth={3} />;
                }}
                activeDot={{ r: 5, fill: "#818cf8", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Feature Importance ───────────────────────────────────────── */}
      {prediction.feature_importances && prediction.feature_importances.length > 0 && (
        <motion.div variants={fadeUp} className="card" style={{ padding: "var(--space-6)" }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-5)" }}>
            Top Feature Importances
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={prediction.feature_importances.map((f) => ({ ...f, name: displayFeat(f.feature) }))}
              layout="vertical" margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} width={90} />
              <Tooltip
                formatter={(v: any) => [`${(Number(v) * 100).toFixed(2)}%`, "Importance"]}
                contentStyle={{ background: "rgba(15,15,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {prediction.feature_importances.map((_, i) => (
                  <Cell key={i} fill={`rgba(99,102,241,${0.9 - i * 0.07})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── Sentiment + News ─────────────────────────────────────────── */}
      {sentiment && (
        <motion.div variants={fadeUp} className="card" style={{ padding: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Newspaper size={14} /> Market Sentiment
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{
                fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 10px", borderRadius: 99,
                background: sentLabel === "Positive" ? "rgba(34,197,94,0.15)" : sentLabel === "Negative" ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.15)",
                color: sentLabel === "Positive" ? "#4ade80" : sentLabel === "Negative" ? "#f87171" : "#94a3b8",
              }}>
                {sentLabel}
              </span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: sentScore != null && sentScore > 0 ? "#4ade80" : sentScore != null && sentScore < 0 ? "#f87171" : "#94a3b8" }}>
                {sentScore != null ? (sentScore > 0 ? "+" : "") + sentScore.toFixed(3) : "—"}
              </span>
            </div>
          </div>

          {sentScore != null && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <SentimentBar score={sentScore} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--text-muted)", marginTop: 4 }}>
                <span>Bearish</span><span>Neutral</span><span>Bullish</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 220, overflowY: "auto" }}>
            {sentiment.headlines.map((h, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-3)",
                background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{
                  flexShrink: 0, fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: 99, marginTop: 2,
                  background: h.score > 0.05 ? "rgba(34,197,94,0.15)" : h.score < -0.05 ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.12)",
                  color: h.score > 0.05 ? "#4ade80" : h.score < -0.05 ? "#f87171" : "#94a3b8",
                }}>
                  {h.score > 0 ? "+" : ""}{h.score.toFixed(2)}
                </span>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{h.title}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Accuracy Tracker ──────────────────────────────────────────── */}
      {accuracy && accuracy.total > 0 && (
        <motion.div variants={fadeUp} className="card" style={{ padding: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
              Prediction Accuracy Tracker
            </p>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {accuracy.correct}/{accuracy.total} correct
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 200, overflowY: "auto" }}>
            {accuracy.records.map((r, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--space-2) var(--space-3)",
                background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-sm)",
                border: `1px solid ${r.correct ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                fontSize: "var(--text-xs)",
              }}>
                <span style={{ color: "var(--text-muted)" }}>{r.date}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  Pred: ${r.predicted_price?.toFixed(2)} · Actual: ${r.actual_price?.toFixed(2)}
                </span>
                <span style={{ color: r.correct ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                  {r.correct ? "✓" : "✗"} {r.predicted_direction?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

    </motion.div>
  );
};

export default PredictionResult;
