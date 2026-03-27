import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import fs from "node:fs";

const CHUNK_SIZE = 4096;
const PLACEHOLDER = String.fromCodePoint(0x10eeee);
const IN_TMUX = !!process.env.TMUX;

// Diacritical marks for Kitty Unicode placeholder protocol (row/column encoding).
// Index N maps to the diacritic for value N. From Kitty's gen/rowcolumn-diacritics.txt.
const DIACRITICS = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f,
  0x0346, 0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357,
  0x035b, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f,
];

let nextImageId = 1;

function diacritic(n: number): string {
  return String.fromCodePoint(DIACRITICS[n] ?? DIACRITICS[0]);
}

// Convert image ID to hex color for Ink's <Text color> prop.
// Kitty reads the 24-bit true color foreground as the image ID.
function imageIdToHex(id: number): string {
  const r = (id >> 16) & 0xff;
  const g = (id >> 8) & 0xff;
  const b = id & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function buildPlaceholderRow(row: number, cols: number): string {
  let line = PLACEHOLDER + diacritic(row);
  for (let c = 1; c < cols; c++) {
    line += PLACEHOLDER;
  }
  return line;
}

function wrapTmuxPassthrough(seq: string): string {
  const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
  return `\x1bPtmux;${doubled}\x1b\\`;
}

/**
 * Upload image to terminal using Kitty graphics protocol with Unicode placement.
 * Writes directly to stdout fd to bypass Ink's stream interception.
 */
function uploadImage(base64Data: string, imageId: number, cols: number, rows: number): void {
  const rawChunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    rawChunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  for (let idx = 0; idx < rawChunks.length; idx++) {
    const isFirst = idx === 0;
    const isLast = idx === rawChunks.length - 1;

    const ctrl: string[] = [];
    if (isFirst) {
      ctrl.push(`a=T`, `U=1`, `f=100`, `t=d`, `i=${imageId}`, `q=2`);
      ctrl.push(`c=${cols}`, `r=${rows}`);
    }
    ctrl.push(`m=${isLast ? 0 : 1}`);

    let seq = `\x1b_G${ctrl.join(",")};${rawChunks[idx]}\x1b\\`;
    if (IN_TMUX) seq = wrapTmuxPassthrough(seq);
    fs.writeSync(process.stdout.fd, seq);
  }
}

interface ImageProps {
  element: {
    props: {
      src?: string;
      alt?: string;
      width?: number;
      height?: number;
    };
  };
}

export function Image({ element }: ImageProps) {
  const { src, alt = "", width, height } = element.props;
  const cols = width ?? 40;
  const rows = height ?? 15;

  const [state, setState] = useState<{ imageId: number; src: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    // Re-upload if src changed
    if (state?.src === src) return;

    let base64Data: string;
    try {
      const buffer = fs.readFileSync(src);
      base64Data = buffer.toString("base64");
    } catch {
      setError(`Image not found: ${src}`);
      setState(null);
      return;
    }

    const imageId = nextImageId++;
    uploadImage(base64Data, imageId, cols, rows);
    setState({ imageId, src });
    setError(null);
  }, [src, cols, rows]);

  if (!src) {
    return <Text color="gray">[Image: {alt || "no source"}]</Text>;
  }

  if (error) {
    return <Text color="red">[{error}]</Text>;
  }

  if (!state) {
    return <Text color="gray">[Loading: {src}]</Text>;
  }

  const hexColor = imageIdToHex(state.imageId);

  return (
    <Box flexDirection="column">
      {Array.from({ length: rows }, (_, r) => (
        <Text key={r} color={hexColor}>
          {buildPlaceholderRow(r, cols)}
        </Text>
      ))}
      {alt ? <Text color="gray">{alt}</Text> : null}
    </Box>
  );
}
