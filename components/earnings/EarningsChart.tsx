"use client";

import React from "react";
import { useLanguageStore, t } from "@/lib/shared";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

interface ChartDataPoint {
  date: string;
  ts: number;
  earnings: number;
  trips: number;
}

interface EarningsChartProps {
  data: ChartDataPoint[];
}

const CHART_COLORS = {
  earnings: "#B23457",
};

export const EarningsChart: React.FC<EarningsChartProps> = ({ data }) => {
  const language = useLanguageStore((s) => s.language);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `$${val}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "13px",
            }}
            formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, t('earnings', language)]}
            labelFormatter={(label) => `${t('date', language)}: ${String(label ?? "")}`}
          />
          <Bar dataKey="earnings" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={CHART_COLORS.earnings} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
