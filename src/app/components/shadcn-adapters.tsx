import React, { type ReactNode } from "react";
import { shadcnComponents } from "@json-render/shadcn";

type ComponentFn = (p: { props: Record<string, unknown>; children?: ReactNode }) => ReactNode;

// Badge: Splash uses `label`, shadcn uses `text`
export const ShadcnBadge: ComponentFn = ({ props, children }) => {
  const { label, ...rest } = props;
  const mapped = { ...rest, text: props.text ?? label };
  return shadcnComponents.Badge({ props: mapped, children });
};

// Progress: Splash uses `progress` (0-1 fraction), shadcn uses `value` (0-100) + `max`
export const ShadcnProgress: ComponentFn = ({ props, children }) => {
  const progress = (props.progress as number) ?? 0;
  const mapped = {
    ...props,
    value: props.value ?? Math.round(progress * 100),
    max: props.max ?? 100,
  };
  return shadcnComponents.Progress({ props: mapped, children });
};

// Image: optional background prop for transparent PNGs on dark themes
export const ShadcnImage: ComponentFn = ({ props, children }) => {
  const bg = props.background as string | undefined;
  if (bg) {
    return React.createElement("div", {
      style: {
        display: "inline-block",
        backgroundColor: bg,
        borderRadius: 6,
        padding: 4,
      },
    }, shadcnComponents.Image({ props, children }));
  }
  return shadcnComponents.Image({ props, children });
};

// Table: Splash uses {header,key} columns + object rows; shadcn uses string[] columns + string[][] rows
export const ShadcnTable: ComponentFn = ({ props, children }) => {
  const cols = (props.columns as Array<{ header: string; key: string }>) ?? [];
  const rows = (props.rows as Array<Record<string, string>>) ?? [];
  const width = props.width as number | string | undefined;
  const height = props.height as number | string | undefined;
  const mapped = {
    ...props,
    columns: cols.map((c) => c.header),
    rows: rows.map((row) => cols.map((c) => row[c.key] ?? "")),
  };
  const style: Record<string, unknown> = width ? { width } : { maxWidth: 640 };
  if (height) {
    style.maxHeight = height;
    style.overflow = "auto";
  }
  return React.createElement("div", { style },
    shadcnComponents.Table({ props: mapped, children })
  );
};
