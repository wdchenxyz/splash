import React from "react";
import { Box, Text } from "ink";
import fs from "node:fs";

const CHUNK_SIZE = 4096;

function buildKittySequence(base64Data: string, cols?: number, rows?: number): string {
  const chunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  const parts: string[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const isFirst = idx === 0;
    const isLast = idx === chunks.length - 1;

    const controlParts: string[] = [];
    if (isFirst) {
      controlParts.push("a=T", "f=100", "t=d", "q=2");
      if (cols) controlParts.push(`c=${cols}`);
      if (rows) controlParts.push(`r=${rows}`);
    }
    controlParts.push(`m=${isLast ? 0 : 1}`);

    const control = controlParts.join(",");
    parts.push(`\x1b_G${control};${chunks[idx]}\x1b\\`);
  }

  return parts.join("");
}

function wrapTmuxPassthrough(kittySequences: string): string {
  const seqs = kittySequences.split(/(?=\x1b_G)/);
  return seqs
    .filter((s) => s.length > 0)
    .map((seq) => {
      const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
      return `\x1bPtmux;${doubled}\x1b\\`;
    })
    .join("");
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

  if (!src) {
    return (
      <Box>
        <Text color="gray">[Image: {alt || "no source"}]</Text>
      </Box>
    );
  }

  let base64Data: string;
  try {
    const buffer = fs.readFileSync(src);
    base64Data = buffer.toString("base64");
  } catch {
    return (
      <Box>
        <Text color="red">[Image not found: {src}]</Text>
      </Box>
    );
  }

  const kittyOutput = buildKittySequence(base64Data, width, height);
  const inTmux = !!process.env.TMUX;
  const output = inTmux ? wrapTmuxPassthrough(kittyOutput) : kittyOutput;

  return (
    <Box flexDirection="column">
      <Text>{output}</Text>
      {alt ? <Text color="gray">{alt}</Text> : null}
    </Box>
  );
}
