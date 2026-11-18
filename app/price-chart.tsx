"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartBand } from "@/lib/market";

type ColumnDatum = {
  matches: number;
  market: number;
  total: number;
  highlighted: boolean;
};

function columnPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M ${x} ${y + height} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height} Z`;
}

function PriceColumn({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ColumnDatum;
}) {
  if (width <= 0 || height <= 0 || !payload) {
    return null;
  }
  const total = payload.total > 0 ? payload.total : payload.matches + payload.market;
  const matchHeight = total > 0 ? (height * payload.matches) / total : 0;
  const marketHeight = Math.max(0, height - matchHeight);
  const radius = 4;

  return (
    <g className="cursor-pointer">
      <g style={{ filter: "drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.28))" }}>
        {marketHeight > 0 ? (
          <path d={columnPath(x, y, width, marketHeight, radius)} fill="#d6d3d1" />
        ) : null}
        {matchHeight > 0 ? (
          <path
            d={columnPath(
              x,
              y + marketHeight,
              width,
              matchHeight,
              marketHeight > 0 ? 0 : radius,
            )}
            fill="#2563eb"
          />
        ) : null}
      </g>
      {payload.highlighted ? (
        <path
          d={columnPath(x, y, width, height, radius)}
          fill="none"
          stroke="#171717"
          strokeWidth={2}
        />
      ) : null}
    </g>
  );
}

export function PriceChart({
  bands,
  showMatches,
  onSelectBand,
}: {
  bands: ChartBand[];
  showMatches: boolean;
  onSelectBand: (index: number) => void;
}) {
  const data: (ColumnDatum & { label: string })[] = bands.map((band) => ({
    label: band.label,
    matches: band.matchCount,
    market: band.marketRemainder,
    total: band.generalCount,
    highlighted: band.highlighted,
  }));

  return (
    <div className="w-full">
      <div className="h-72 w-full [&_.recharts-surface]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            accessibilityLayer={false}
            margin={{ top: 28, right: 8, left: 0, bottom: 8 }}
            style={{ outline: "none" }}
          >
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fontSize: 11, fill: "#525252" }}
              tickLine={false}
              tickMargin={3}
              angle={0}
              textAnchor="middle"
              height={32}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#525252" }} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as ColumnDatum | undefined;
                if (!active || !row) {
                  return null;
                }
                return (
                  <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800">
                    {showMatches ? (
                      <>
                        <p>Matches: ~{row.matches}</p>
                        <p>Rest of market: ~{row.market}</p>
                      </>
                    ) : (
                      <p>~{row.total}</p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="total"
              shape={PriceColumn}
              name="total"
              isAnimationActive
              className="cursor-pointer"
              onClick={(_, index) => onSelectBand(index)}
            >
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
    </div>
  );
}
