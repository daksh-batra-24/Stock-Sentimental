import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAllTickers, fetchHeatmap } from "../api/stockApi";
import type { HeatmapEntry } from "../api/stockApi";

interface Props {
  sessionMap: Record<string, "up" | "down">;
}

const SectorHeatmap: React.FC<Props> = ({ sessionMap }) => {
  const [dbMap, setDbMap] = useState<Record<string, HeatmapEntry>>({});
  const allTickers = getAllTickers();

  useEffect(() => {
    fetchHeatmap()
      .then((entries) => {
        const m: Record<string, HeatmapEntry> = {};
        entries.forEach((e) => { m[e.ticker] = e; });
        setDbMap(m);
      })
      .catch(() => {});
  }, []);

  const getDirection = (ticker: string): "up" | "down" | null => {
    if (sessionMap[ticker]) return sessionMap[ticker];
    return dbMap[ticker]?.direction ?? null;
  };

  const colorFor = (dir: "up" | "down" | null) => {
    if (dir === "up")   return { bg: "rgba(34,197,94,0.18)",  border: "rgba(34,197,94,0.45)",  text: "#4ade80" };
    if (dir === "down") return { bg: "rgba(239,68,68,0.18)",  border: "rgba(239,68,68,0.45)",  text: "#f87171" };
    return                     { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "var(--text-muted)" };
  };

  const up   = allTickers.filter((t) => getDirection(t) === "up").length;
  const down = allTickers.filter((t) => getDirection(t) === "down").length;

  return (
    <div style={{ marginTop: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          Sector Heatmap
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--text-xs)" }}>
          {up > 0   && <span style={{ color: "#4ade80" }}>▲ {up} UP</span>}
          {down > 0 && <span style={{ color: "#f87171" }}>▼ {down} DOWN</span>}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
        gap: "var(--space-1)",
      }}>
        {allTickers.map((ticker) => {
          const dir = getDirection(ticker);
          const c   = colorFor(dir);
          return (
            <motion.div
              key={ticker}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-2) var(--space-1)",
                textAlign: "center",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                color: c.text,
                letterSpacing: "0.02em",
              }}
            >
              {ticker}
              {dir && (
                <div style={{ fontSize: "9px", marginTop: "2px", opacity: 0.8 }}>
                  {dir === "up" ? "▲" : "▼"}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorHeatmap;
