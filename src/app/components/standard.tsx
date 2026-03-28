import React, { type ReactNode, type CSSProperties } from "react";

// -- Layout --

export function Box({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const dir = (props.flexDirection as string) ?? "row";
  const style: CSSProperties = {
    display: "flex",
    flexDirection: dir as CSSProperties["flexDirection"],
    alignItems: (props.alignItems as CSSProperties["alignItems"]) ?? (dir === "row" ? "center" : undefined),
    justifyContent: (props.justifyContent as CSSProperties["justifyContent"]) ?? undefined,
    flexGrow: (props.flexGrow as number) ?? 1,
    flexShrink: (props.flexShrink as number) ?? 1,
    minWidth: 0,
    flexWrap: (props.flexWrap as CSSProperties["flexWrap"]) ?? undefined,
    gap: props.gap != null ? (props.gap as number) * 8 : undefined,
    padding: props.padding != null ? (props.padding as number) * 8 : undefined,
    width: (props.width as CSSProperties["width"]) ?? "100%",
    height: props.height as CSSProperties["height"],
    borderStyle: props.borderStyle ? "solid" : undefined,
    borderWidth: props.borderStyle ? 1 : undefined,
    borderColor: (props.borderColor as string) ?? "#374151",
    borderRadius: props.borderStyle ? 4 : undefined,
    backgroundColor: props.backgroundColor as string,
  };
  return <div style={style}>{children}</div>;
}

export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

export function Newline({ props }: { props: Record<string, unknown> }) {
  const count = (props.count as number) ?? 1;
  return <>{Array.from({ length: count }, (_, i) => <br key={i} />)}</>;
}

export function Divider({ props }: { props: Record<string, unknown> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, backgroundColor: (props.color as string) ?? "#374151" }} />
      {props.title && <span style={{ color: "#9ca3af", fontSize: 12 }}>{props.title as string}</span>}
      <div style={{ flex: 1, height: 1, backgroundColor: (props.color as string) ?? "#374151" }} />
    </div>
  );
}

// -- Content --

export function Text({ props }: { props: Record<string, unknown> }) {
  const style: CSSProperties = {
    color: (props.color as string) ?? undefined,
    backgroundColor: (props.backgroundColor as string) ?? undefined,
    fontWeight: props.bold ? "bold" : undefined,
    fontStyle: props.italic ? "italic" : undefined,
    textDecoration: [props.underline && "underline", props.strikethrough && "line-through"].filter(Boolean).join(" ") || undefined,
    opacity: props.dimColor ? 0.6 : undefined,
  };
  return <span style={style}>{props.text as string}</span>;
}

export function StatusLine({ props }: { props: Record<string, unknown> }) {
  const icons: Record<string, string> = { info: "ℹ", success: "✓", warning: "⚠", error: "✗" };
  const colors: Record<string, string> = { info: "#60a5fa", success: "#34d399", warning: "#fbbf24", error: "#f87171" };
  const status = (props.status as string) ?? "info";
  return (
    <div style={{ color: colors[status] ?? "#9ca3af" }}>
      {(props.icon as string) ?? icons[status] ?? "•"} {props.text as string}
    </div>
  );
}

export function KeyValue({ props }: { props: Record<string, unknown> }) {
  const sep = (props.separator as string) ?? ":";
  const value = props.value;
  const display = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return (
    <div>
      <span style={{ color: (props.labelColor as string) ?? "#9ca3af" }}>{props.label as string}</span>
      <span style={{ color: "#6b7280" }}>{sep} </span>
      <span>{display}</span>
    </div>
  );
}

export function Metric({ props }: { props: Record<string, unknown> }) {
  const trendColors: Record<string, string> = { up: "#34d399", down: "#f87171", neutral: "#9ca3af" };
  const trendIcons: Record<string, string> = { up: "↑", down: "↓", neutral: "→" };
  const trend = props.trend as string | undefined;
  return (
    <div style={{ padding: 8 }}>
      <div style={{ color: "#9ca3af", fontSize: 12 }}>{props.label as string}</div>
      <div style={{ fontSize: 20, fontWeight: "bold" }}>
        {props.value as string}
        {trend && <span style={{ color: trendColors[trend], fontSize: 14, marginLeft: 4 }}>{trendIcons[trend]}</span>}
      </div>
      {props.detail && <div style={{ color: "#6b7280", fontSize: 12 }}>{props.detail as string}</div>}
    </div>
  );
}

export function Link({ props }: { props: Record<string, unknown> }) {
  return (
    <a href={props.url as string} style={{ color: (props.color as string) ?? "#60a5fa", textDecoration: "underline" }} target="_blank" rel="noopener">
      {(props.label as string) ?? (props.url as string)}
    </a>
  );
}

export function Markdown({ props }: { props: Record<string, unknown> }) {
  // Simple markdown: just render as preformatted text
  return <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5 }}>{props.text as string}</pre>;
}

export function Callout({ props }: { props: Record<string, unknown> }) {
  const colors: Record<string, string> = { info: "#1e3a5f", warning: "#78350f", tip: "#064e3b", important: "#4c1d95" };
  const bg = colors[(props.type as string) ?? "info"] ?? colors.info;
  return (
    <div style={{ backgroundColor: bg, borderRadius: 6, padding: 12 }}>
      {props.title && <div style={{ fontWeight: "bold", marginBottom: 4 }}>{props.title as string}</div>}
      <div>{props.content as string}</div>
    </div>
  );
}

export function ListComponent({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as string[]) ?? [];
  const ordered = props.ordered as boolean;
  const bullet = (props.bulletChar as string) ?? "•";
  return (
    <div style={{ paddingLeft: 8 }}>
      {items.map((item, i) => (
        <div key={i}>
          <span style={{ color: "#6b7280", marginRight: 8 }}>{ordered ? `${i + 1}.` : bullet}</span>
          {item}
        </div>
      ))}
    </div>
  );
}

export function ListItem({ props }: { props: Record<string, unknown> }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
      {props.leading && <span style={{ color: "#6b7280" }}>{props.leading as string}</span>}
      <div>
        <div>{props.title as string}</div>
        {props.subtitle && <div style={{ color: "#6b7280", fontSize: 12 }}>{props.subtitle as string}</div>}
      </div>
      {props.trailing && <span style={{ color: "#6b7280", marginLeft: "auto" }}>{props.trailing as string}</span>}
    </div>
  );
}

export function Timeline({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ title: string; description?: string; date?: string; status?: string }>) ?? [];
  const statusColors: Record<string, string> = { completed: "#34d399", current: "#60a5fa", upcoming: "#6b7280" };
  return (
    <div style={{ paddingLeft: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, paddingBottom: 8, borderLeft: i < items.length - 1 ? "2px solid #374151" : "none", marginLeft: 4, paddingLeft: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: statusColors[item.status ?? "upcoming"], marginTop: 4, marginLeft: -17 }} />
          <div>
            <div style={{ fontWeight: "bold" }}>{item.title}</div>
            {item.date && <div style={{ color: "#6b7280", fontSize: 11 }}>{item.date}</div>}
            {item.description && <div style={{ color: "#9ca3af", fontSize: 12 }}>{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// -- Data Visualization --

export function Sparkline({ props }: { props: Record<string, unknown> }) {
  const data = (props.data as number[]) ?? [];
  if (data.length === 0) return null;

  const width = ((props.width as number) ?? 60) * 6;
  const height = 24;
  const color = (props.color as string) ?? "#22c55e";
  const min = props.min != null ? (props.min as number) : Math.min(...data);
  const max = props.max != null ? (props.max as number) : Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      {props.label && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>{props.label as string}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: width, height }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    </div>
  );
}

export function BarChart({ props }: { props: Record<string, unknown> }) {
  const data = (props.data as Array<{ label: string; value: number; color?: string }>) ?? [];
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value));
  const barWidth = ((props.width as number) ?? 40) * 6;
  const showValues = (props.showValues as boolean) !== false;
  const showPercentage = (props.showPercentage as boolean) ?? false;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, width: "100%", maxWidth: barWidth }}>
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca3af", fontSize: 12, minWidth: 100, textAlign: "right", flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 16, position: "relative" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: d.color ?? "#22c55e", borderRadius: 3 }} />
            </div>
            {showValues && <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{d.value}{showPercentage ? ` (${Math.round((d.value / total) * 100)}%)` : ""}</span>}
          </div>
        );
      })}
    </div>
  );
}

