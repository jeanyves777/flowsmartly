"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface Chart {
  type: "bar" | "line" | "pie";
  title: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; value2?: number; value2Name?: string }>;
}

/**
 * Renders one chart for the business plan viewer.
 * - Picks complementary palette anchored to the plan's primary color.
 * - For line charts with value2 (e.g. 3-year revenue+expenses), plots both series.
 */
export function ChartRenderer({ chart, primaryColor }: { chart: Chart; primaryColor: string }) {
  const palette = buildPalette(primaryColor);
  const hasSecondary = chart.data.some((d) => typeof d.value2 === "number");
  const secondaryName = chart.data.find((d) => d.value2Name)?.value2Name || "Series 2";

  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chart.data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {chart.data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chart.data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={chart.yLabel ? { value: chart.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined} />
          <Tooltip />
          <Legend iconType="circle" />
          <Line type="monotone" dataKey="value" name="Revenue" stroke={palette[0]} strokeWidth={2.5} dot={{ r: 4 }} />
          {hasSecondary && (
            <Line type="monotone" dataKey="value2" name={secondaryName} stroke={palette[1]} strokeWidth={2.5} dot={{ r: 4 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar chart (default)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chart.data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} label={chart.yLabel ? { value: chart.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chart.data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Build a 6-color palette anchored on the plan's primary color — each is a
 * hue-rotation of the input so the chart stays on-brand without hand-picking.
 */
function buildPalette(primary: string): string[] {
  const hsl = hexToHSL(primary);
  if (!hsl) return ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#10b981"];
  const h = hsl.h;
  return [
    hslToHex(h, hsl.s, hsl.l),
    hslToHex((h + 40) % 360, hsl.s, Math.min(95, hsl.l + 10)),
    hslToHex((h + 180) % 360, Math.max(40, hsl.s - 10), hsl.l),
    hslToHex((h + 80) % 360, hsl.s, Math.max(25, hsl.l - 10)),
    hslToHex((h + 220) % 360, hsl.s, hsl.l),
    hslToHex((h + 120) % 360, hsl.s, Math.min(95, hsl.l + 5)),
  ];
}

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
