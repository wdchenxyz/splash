import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import fs from "node:fs";

const CHUNK_SIZE = 4096;
const PLACEHOLDER = String.fromCodePoint(0x10eeee);

// Diacritical marks used by Kitty Unicode placeholder protocol to encode row/column.
// Index N maps to the diacritic for value N. From Kitty's gen/rowcolumn-diacritics.txt.
const DIACRITICS = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f,
  0x0346, 0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357,
  0x035b, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f,
];

function diacritic(n: number): string {
  return String.fromCodePoint(DIACRITICS[n] ?? DIACRITICS[0]);
}

function buildUploadSequence(
  base64Data: string,
  imageId: number,
  cols: number,
  rows: number,
): string[] {
  const rawChunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    rawChunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  const sequences: string[] = [];
  for (let idx = 0; idx < rawChunks.length; idx++) {
    const isFirst = idx === 0;
    const isLast = idx === rawChunks.length - 1;

    const ctrl: string[] = [];
    if (isFirst) {
      ctrl.push(`a=T`, `U=1`, `f=100`, `t=d`, `i=${imageId}`, `q=2`);
      ctrl.push(`c=${cols}`, `r=${rows}`);
    }
    ctrl.push(`m=${isLast ? 0 : 1}`);

    sequences.push(`\x1b_G${ctrl.join(",")};${rawChunks[idx]}\x1b\\`);
  }

  return sequences;
}

function wrapTmuxPassthrough(seq: string): string {
  const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
  return `\x1bPtmux;${doubled}\x1b\\`;
}

function buildPlaceholderText(imageId: number, rows: number, cols: number): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    // First cell: placeholder + row diacritic (column inferred as 0)
    let line = PLACEHOLDER + diacritic(r);
    // Remaining cells: bare placeholder (inherits row, column = prev + 1)
    for (let c = 1; c < cols; c++) {
      line += PLACEHOLDER;
    }
    lines.push(line);
  }
  // Wrap in ANSI foreground color to encode image ID (256-color mode)
  return `\x1b[38;5;${imageId}m${lines.join("\n")}\x1b[39m`;
}

let nextImageId = 1;

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
  const { write } = useStdout();
  const [placeholder, setPlaceholder] = useState<string | null>(null);

  useEffect(() => {
    if (!src || placeholder) return;

    let base64Data: string;
    try {
      const buffer = fs.readFileSync(src);
      base64Data = buffer.toString("base64");
    } catch {
      return;
    }

    const imageId = nextImageId++;
    const cols = width ?? 40;
    const rows = height ?? 15;

    const inTmux = !!process.env.TMUX;
    const chunks = buildUploadSequence(base64Data, imageId, cols, rows);

    // Upload image data to terminal via Ink's write() (escape sequences).
    // The actual display happens via placeholder characters in the text below.
    for (const chunk of chunks) {
      const output = inTmux ? wrapTmuxPassthrough(chunk) : chunk;
      write(output);
    }

    setPlaceholder(buildPlaceholderText(imageId, rows, cols));
  }, [src, width, height, write, placeholder]);

  if (!src) {
    return (
      <Box>
        <Text color="gray">[Image: {alt || "no source"}]</Text>
      </Box>
    );
  }

  if (!fs.existsSync(src)) {
    return (
      <Box>
        <Text color="red">[Image not found: {src}]</Text>
      </Box>
    );
  }

  if (!placeholder) {
    return (
      <Box>
        <Text color="gray">[Loading: {src}]</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{placeholder}</Text>
      {alt ? <Text color="gray">{alt}</Text> : null}
    </Box>
  );
}
