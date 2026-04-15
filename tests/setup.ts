/**
 * Test environment shims.
 *
 * happy-dom does not expose the ImageData constructor yet, but our analyzer
 * code only relies on { data, width, height } — so we provide a minimal
 * class-shape polyfill to keep tests isomorphic with browser runtime.
 */
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;

    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data;
      this.width = width;
      this.height = height ?? data.length / 4 / width;
    }
  }
  // @ts-expect-error -- polyfill for test env
  globalThis.ImageData = ImageDataPolyfill;
}
