import React, { useEffect, useRef } from "react";
import { Box, Text, useStdout } from "ink";
import fs from "node:fs";

const CHUNK_SIZE = 4096;

function buildKittyChunks(base64Data: string, cols?: number, rows?: number): string[] {
  const rawChunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    rawChunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  const sequences: string[] = [];
  for (let idx = 0; idx < rawChunks.length; idx++) {
    const isFirst = idx === 0;
    const isLast = idx === rawChunks.length - 1;

    const controlParts: string[] = [];
    if (isFirst) {
      controlParts.push("a=T", "f=100", "t=d", "q=2");
      if (cols) controlParts.push(`c=${cols}`);
      if (rows) controlParts.push(`r=${rows}`);
    }
    controlParts.push(`m=${isLast ? 0 : 1}`);

    const control = controlParts.join(",");
    sequences.push(`\x1b_G${control};${rawChunks[idx]}\x1b\\`);
  }

  return sequences;
}

function wrapTmuxPassthrough(seq: string): string {
  const doubled = seq.replace(/\x1b/g, "\x1b\x1b");
  return `\x1bPtmux;${doubled}\x1b\\`;
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
  const { write } = useStdout();
  const writtenRef = useRef(false);

  useEffect(() => {
    if (!src || writtenRef.current) return;

    let base64Data: string;
    try {
      const buffer = fs.readFileSync(src);
      base64Data = buffer.toString("base64");
    } catch {
      return;
    }

    const inTmux = !!process.env.TMUX;
    const chunks = buildKittyChunks(base64Data, width, height);

    // Use Ink's write() to output graphics without conflicting with Ink's rendering.
    for (const chunk of chunks) {
      const output = inTmux ? wrapTmuxPassthrough(chunk) : chunk;
      write(output);
    }
    write("\n");
    writtenRef.current = true;
  }, [src, width, height, write]);

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

  return (
    <Box flexDirection="column">
      {alt ? <Text color="gray">{alt}</Text> : null}
    </Box>
  );
}
