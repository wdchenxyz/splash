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

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Close list if we're no longer in one
    if (inList && !line.match(/^[-*]\s/)) {
      out.push("</ul>");
      inList = false;
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = [0, 20, 16, 14, 13];
      out.push(`<div style="font-weight:bold;font-size:${sizes[level]}px;margin:8px 0 4px">${inlineFormat(hMatch[2])}</div>`);
      continue;
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      const text = line.replace(/^>\s?/, "");
      out.push(`<div style="border-left:3px solid #4b5563;padding-left:12px;color:#9ca3af;margin:6px 0">${inlineFormat(text)}</div>`);
      continue;
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      if (!inList) {
        out.push('<ul style="margin:4px 0;padding-left:20px">');
        inList = true;
      }
      out.push(`<li style="margin:2px 0">${inlineFormat(line.replace(/^[-*]\s/, ""))}</li>`);
      continue;
    }

    // Empty line = spacing
    if (line.trim() === "") {
      out.push('<div style="height:6px"></div>');
      continue;
    }

    // Regular paragraph
    out.push(`<div>${inlineFormat(line)}</div>`);
  }

  if (inList) out.push("</ul>");
  return out.join("");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:#1f2937;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
}

export function Markdown({ props }: { props: Record<string, unknown> }) {
  const html = markdownToHtml((props.text as string) ?? "");
  return <div style={{ lineHeight: 1.6, fontSize: 14 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Callout({ props, children }: { props: Record<string, unknown>; children?: ReactNode }) {
  const colors: Record<string, string> = { info: "#1e3a5f", warning: "#78350f", tip: "#064e3b", important: "#4c1d95" };
  const bg = colors[(props.type as string) ?? "info"] ?? colors.info;
  return (
    <div style={{ backgroundColor: bg, borderRadius: 6, padding: 12 }}>
      {props.title && <div style={{ fontWeight: "bold", marginBottom: 4 }}>{props.title as string}</div>}
      {props.content && <div>{props.content as string}</div>}
      {children}
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
  const statusColors: Record<string, string> = {
    completed: "#34d399", done: "#34d399",
    current: "#60a5fa", "in-progress": "#60a5fa", active: "#60a5fa",
    upcoming: "#6b7280", pending: "#6b7280",
  };
  const lineColor = "#374151";
  return (
    <div style={{ paddingLeft: 16 }}>
      {items.map((item, i) => {
        const color = statusColors[item.status ?? "upcoming"] ?? "#6b7280";
        const filled = item.status === "completed" || item.status === "done";
        return (
          <div key={i} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: i < items.length - 1 ? 24 : 0, marginLeft: 6 }}>
            {/* Vertical line */}
            {i < items.length - 1 && (
              <div style={{ position: "absolute", left: 5, top: 14, bottom: 0, width: 2, backgroundColor: lineColor }} />
            )}
            {/* Circle node */}
            <div style={{
              width: 12, height: 12, borderRadius: "50%", marginTop: 3, flexShrink: 0,
              border: `2px solid ${color}`,
              backgroundColor: filled ? color : "transparent",
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              {item.date && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>{item.date}</div>}
              {item.description && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{item.description}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}



