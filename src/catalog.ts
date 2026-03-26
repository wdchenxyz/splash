import { standardComponents } from "@json-render/ink";

// Pass standardComponents directly as the registry — they already
// accept { element, children } which is what the Renderer provides.
// Using defineRegistry would double-unwrap (element.props → props.props).
export const registry = standardComponents;
