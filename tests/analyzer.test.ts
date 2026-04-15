import { describe, it, expect } from "vitest";
import {
  analyzeHistogram,
  predictParams,
  clampParams,
  lanczos3Kernel,
  type EnhancementParams,
} from "../src/analyzer.js";

/** Создаёт ImageData заданного размера с одноцветной заливкой. */
function makeSolidImage(w: number, h: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

/** Создаёт серую ImageData с плавным градиентом по яркости (0..255). */
function makeGradient(w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255);
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

/** Изображение с маленькой динамикой — имитирует туман/бледную фото. */
function makeLowContrastImage(w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 40); // [110..150]
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

describe("analyzeHistogram", () => {
  it("mid-gray image → avgBrightness ≈ 128", () => {
    const img = makeSolidImage(32, 32, 128, 128, 128);
    const f = analyzeHistogram(img);
    expect(f.avgBrightness).toBeCloseTo(128, 0);
  });

  it("gradient → p2 около 5, p98 около 250", () => {
    const f = analyzeHistogram(makeGradient(256, 16));
    expect(f.p2).toBeGreaterThanOrEqual(3);
    expect(f.p2).toBeLessThan(15);
    expect(f.p98).toBeGreaterThan(240);
    expect(f.p98).toBeLessThanOrEqual(255);
  });

  it("low-contrast image → avgContrast < 60", () => {
    const f = analyzeHistogram(makeLowContrastImage(64, 64));
    expect(f.avgContrast).toBeLessThan(60);
  });

  it("one-color image → saturation = 0", () => {
    const f = analyzeHistogram(makeSolidImage(16, 16, 200, 200, 200));
    expect(f.avgSaturation).toBe(0);
  });

  it("red image → avgSaturation высокая", () => {
    const f = analyzeHistogram(makeSolidImage(16, 16, 255, 0, 0));
    expect(f.avgSaturation).toBeGreaterThan(200);
  });
});

describe("predictParams", () => {
  it("бледное изображение → повышает saturation", () => {
    const features = {
      avgBrightness: 130,
      avgSaturation: 20,
      avgContrast: 40,
      p2: 110,
      p98: 150,
    };
    const p = predictParams(features);
    expect(p.saturation).toBeGreaterThan(0.2);
  });

  it("насыщенное изображение → saturation = 0", () => {
    const features = {
      avgBrightness: 128,
      avgSaturation: 200,
      avgContrast: 200,
      p2: 5,
      p98: 250,
    };
    const p = predictParams(features);
    expect(p.saturation).toBe(0);
  });

  it("levelLow/levelHigh берутся из перцентилей", () => {
    const features = {
      avgBrightness: 128,
      avgSaturation: 100,
      avgContrast: 80,
      p2: 40,
      p98: 210,
    };
    const p = predictParams(features);
    expect(p.levelLow).toBe(40);
    expect(p.levelHigh).toBe(210);
  });
});

describe("clampParams", () => {
  it("брайднесс вне диапазона обрезается до [-1, 1]", () => {
    const p = clampParams({ brightness: 99 });
    expect(p.brightness).toBe(1);
    const p2 = clampParams({ brightness: -99 });
    expect(p2.brightness).toBe(-1);
  });

  it("гамма вне диапазона обрезается до [0.5, 2.0]", () => {
    expect(clampParams({ gamma: 10 }).gamma).toBe(2.0);
    expect(clampParams({ gamma: 0.1 }).gamma).toBe(0.5);
  });

  it("дефолты применяются к неуказанным полям", () => {
    const p: EnhancementParams = clampParams({});
    expect(p.brightness).toBe(0);
    expect(p.gamma).toBe(1.0);
    expect(p.levelHigh).toBe(255);
  });

  it("sharpness отрицательный → 0", () => {
    expect(clampParams({ sharpness: -0.5 }).sharpness).toBe(0);
  });
});

describe("lanczos3Kernel", () => {
  it("в нуле равен 1", () => {
    expect(lanczos3Kernel(0)).toBe(1);
  });

  it("за пределами |x| >= 3 равен 0", () => {
    expect(lanczos3Kernel(3)).toBe(0);
    expect(lanczos3Kernel(-3.5)).toBe(0);
  });

  it("симметричен: k(x) == k(-x)", () => {
    for (const x of [0.5, 1, 1.5, 2, 2.5]) {
      expect(lanczos3Kernel(x)).toBeCloseTo(lanczos3Kernel(-x), 10);
    }
  });
});
