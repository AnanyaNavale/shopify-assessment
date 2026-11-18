"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartBand } from "@/lib/market";

export function PriceChart({
  bands,
  showMatches,
  onSelectBand,
}: {
  bands: ChartBand[];
  showMatches: boolean;
  onSelectBand: (index: number) => void;
}) {
  const data = bands.map((band) => ({
    label: band.label,
    matches: band.matchCount,
    market: band.marketRemainder,
    total: band.generalCount,
    highlighted: band.highlighted,
  }));

  return (
    <div className="w-full">
      <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 8, left: 0, bottom: 24 }}>
          <XAxis
            dataKey="label"
            interval={0}
            tick={{ fontSize: 11, fill: "#525252" }}
            angle={-25}
            textAnchor="end"
            height={56}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#525252" }}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            formatter={(value, name) => [
              `~${value}`,
              name === "matches" ? "Matches" : "Rest of market",
            ]}
          />
          <Bar
            dataKey="matches"
            stackId="band"
            fill="#2563eb"
            name="matches"
            className="cursor-pointer"
            onClick={(_, index) => onSelectBand(index)}
          >
            {data.map((entry) => (
              <Cell
                key={`${entry.label}-matches`}
                stroke={entry.highlighted ? "#171717" : "transparent"}
                strokeWidth={entry.highlighted ? 2 : 0}
              />
            ))}
          </Bar>
          <Bar
            dataKey="market"
            stackId="band"
            fill="#d6d3d1"
            name="market"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
            onClick={(_, index) => onSelectBand(index)}
          >
            {data.map((entry) => (
              <Cell
                key={`${entry.label}-market`}
                stroke={entry.highlighted ? "#171717" : "transparent"}
                strokeWidth={entry.highlighted ? 2 : 0}
              />
            ))}
            <LabelList
              dataKey="total"
              position="top"
              formatter={(value) => `~${value}`}
              style={{ fontSize: 11, fill: "#404040" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      {showMatches ? (
        <div className="mt-2 flex gap-4 text-xs text-neutral-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-blue-600" /> Matches
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 bg-stone-300" /> Rest of market
          </span>
        </div>
      ) : null}
    </div>
  );
}
