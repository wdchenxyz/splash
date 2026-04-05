import { describe, it, expect } from "vitest";
import { waitForReady, rewriteImagePaths } from "./render-targets.js";

describe("render-targets", () => {
  describe("waitForReady", () => {
    it("resolves true immediately when check passes", async () => {
      const result = await waitForReady(() => true, 1000);
      expect(result).toBe(true);
    });

    it("resolves false on timeout", async () => {
      const result = await waitForReady(() => false, 300, 50);
      expect(result).toBe(false);
    });

    it("resolves true when check passes within timeout", async () => {
      let ready = false;
      setTimeout(() => { ready = true; }, 100);
      const result = await waitForReady(() => ready, 2000, 50);
      expect(result).toBe(true);
    });
  });

  describe("rewriteImagePaths", () => {
    it("rewrites absolute image src to localhost URL", () => {
      const spec = {
        root: "img",
        elements: {
          img: {
            type: "Image",
            props: { src: "/tmp/test.png", alt: "Test" },
            children: [],
          },
        },
      };
      const result = rewriteImagePaths(spec, 3456);
      const el = result.elements.img as any;
      expect(el.props.src).toMatch(/^http:\/\/localhost:3456\/files\//);
      expect(el.props.alt).toBe("Test");
    });

    it("does not rewrite non-absolute image paths", () => {
      const spec = {
        root: "img",
        elements: {
          img: {
            type: "Image",
            props: { src: "http://example.com/img.png" },
            children: [],
          },
        },
      };
      const result = rewriteImagePaths(spec, 3456);
      const el = result.elements.img as any;
      expect(el.props.src).toBe("http://example.com/img.png");
    });

    it("does not modify non-Image elements", () => {
      const spec = {
        root: "text",
        elements: {
          text: {
            type: "Text",
            props: { text: "hello" },
            children: [],
          },
        },
      };
      const result = rewriteImagePaths(spec, 3456);
      expect(result).toEqual(spec);
    });

    it("handles specs with mixed Image and non-Image elements", () => {
      const spec = {
        root: "layout",
        elements: {
          layout: { type: "Box", props: {}, children: ["img", "text"] },
          img: { type: "Image", props: { src: "/tmp/photo.jpg" }, children: [] },
          text: { type: "Text", props: { text: "caption" }, children: [] },
        },
      };
      const result = rewriteImagePaths(spec, 4000);
      expect((result.elements.img as any).props.src).toMatch(/localhost:4000/);
      expect((result.elements.text as any).props.text).toBe("caption");
    });
  });
});
