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
