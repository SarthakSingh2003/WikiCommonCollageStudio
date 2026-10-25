export const DEFAULT_ADJUSTMENTS = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  gamma: 100,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  hue: 0,
  fade: 0,

  shadowsHue: 210,
  shadowsSat: 0,
  midtonesHue: 45,
  midtonesSat: 0,
  highlightsHue: 35,
  highlightsSat: 0,
  gradingBalance: 0,

  channelR: 0,
  channelG: 0,
  channelB: 0,

  toneStyle: 'none',
  toneStrength: 100,

  filterPreset: 'normal',
  filterIntensity: 100,

  sharpen: 0,
  clarity: 0,
  blur: 0,
  vignette: 0,
  grain: 0,

  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  crop: null,

  cutoutEnabled: false,
  cutoutColor: '#FFFFFF',
  cutoutTolerance: 35,
  cutoutFeather: 2,
  cutoutInvert: false,
  shadowEnabled: false,
  shadowBlur: 15,
  shadowOpacity: 30,

  privacyZones: []
};

export const FILTER_PRESETS = [
  {
    id: 'normal',
    name: 'Normal (Original)',
    adjustments: {}
  },
  {
    id: 'natural',
    name: 'Natural Archival',
    adjustments: { contrast: 6, vibrance: 8, clarity: 10, highlights: -5, shadows: 5 }
  },
  {
    id: 'warm',
    name: 'Warm Sunlit',
    adjustments: { temperature: 28, highlightsHue: 38, highlightsSat: 15, vibrance: 12, brightness: 4 }
  },
  {
    id: 'cool',
    name: 'Cool Twilight',
    adjustments: { temperature: -24, tint: -6, shadowsHue: 220, shadowsSat: 18, contrast: 8 }
  },
  {
    id: 'vivid',
    name: 'Vivid Botanical',
    adjustments: { saturation: 26, vibrance: 32, contrast: 16, clarity: 18, exposure: 4 }
  },
  {
    id: 'muted',
    name: 'Muted Pastel',
    adjustments: { saturation: -22, fade: 18, contrast: -10, vibrance: -15, brightness: 8 }
  },
  {
    id: 'bw',
    name: 'Classic B&W',
    adjustments: { toneStyle: 'bw', toneStrength: 100, contrast: 22, clarity: 20, whites: 10, blacks: -10 }
  },
  {
    id: 'vintage',
    name: 'Vintage Analog',
    adjustments: { toneStyle: 'sepia', toneStrength: 35, fade: 24, temperature: 16, grain: 25, vignette: 30 }
  },
  {
    id: 'cinematic',
    name: 'Cinematic Teal/Orange',
    adjustments: { shadowsHue: 195, shadowsSat: 32, highlightsHue: 35, highlightsSat: 28, contrast: 18, fade: 10, vignette: 20 }
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    adjustments: { contrast: 42, whites: 20, blacks: -25, clarity: 30, saturation: 10 }
  },
  {
    id: 'soft-bright',
    name: 'Soft & Bright',
    adjustments: { brightness: 16, exposure: 12, contrast: -14, clarity: -10, highlights: 15, fade: 12 }
  },
  {
    id: 'documentary',
    name: 'Documentary Realism',
    adjustments: { contrast: 12, clarity: 16, sharpen: 20, saturation: -6, vibrance: 6, highlights: -12, shadows: 10 }
  }
];

function clamp(val, min = 0, max = 255) {
  return Math.max(min, Math.min(max, val));
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  h = ((h % 360) + 360) % 360;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function hexToRgb(hex) {
  if (!hex) return { r: 255, g: 255, b: 255 };
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function applyImageAdjustments(imageData, adj) {
  const data = imageData.data;
  const len = data.length;

  const exposureMult = Math.pow(2, (adj.exposure || 0) / 50);
  const brightnessOffset = (adj.brightness || 0) * 1.5;
  const contrastFactor = ((adj.contrast || 0) + 100) / 100;
  const contrastFactorSq = contrastFactor * contrastFactor;
  const gammaVal = (adj.gamma || 100) / 100;
  const invGamma = gammaVal !== 1 ? 1 / gammaVal : 1;

  const temp = (adj.temperature || 0) / 100;
  const tint = (adj.tint || 0) / 100;

  const satMult = ((adj.saturation || 0) + 100) / 100;
  const vibranceVal = (adj.vibrance || 0) / 100;
  const hueShift = adj.hue || 0;
  const fadeLift = (adj.fade || 0) * 0.8;

  const highlightsAdj = (adj.highlights || 0) / 100;
  const shadowsAdj = (adj.shadows || 0) / 100;
  const whitesAdj = (adj.whites || 0) / 100;
  const blacksAdj = (adj.blacks || 0) / 100;

  const rChan = (adj.channelR || 0) * 1.28;
  const gChan = (adj.channelG || 0) * 1.28;
  const bChan = (adj.channelB || 0) * 1.28;

  const shadowsSat = (adj.shadowsSat || 0) / 100;
  const midtonesSat = (adj.midtonesSat || 0) / 100;
  const highlightsSat = (adj.highlightsSat || 0) / 100;

  const shadowTintRgb = shadowsSat > 0 ? hslToRgb(adj.shadowsHue || 0, 1, 0.5) : null;
  const midtoneTintRgb = midtonesSat > 0 ? hslToRgb(adj.midtonesHue || 0, 1, 0.5) : null;
  const highlightTintRgb = highlightsSat > 0 ? hslToRgb(adj.highlightsHue || 0, 1, 0.5) : null;

  const cutoutEnabled = adj.cutoutEnabled;
  const cutoutTarget = cutoutEnabled ? hexToRgb(adj.cutoutColor) : null;
  const cutoutTolSq = cutoutEnabled ? Math.pow((adj.cutoutTolerance || 30) * 2, 2) : 0;
  const cutoutInvert = adj.cutoutInvert;
  const featherPx = adj.cutoutFeather || 0;
  const outerTol = (adj.cutoutTolerance || 30) * 2 + featherPx * 12;
  const outerTolSq = outerTol * outerTol;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    if (a === 0) continue;

    if (cutoutEnabled && cutoutTarget) {
      const dr = r - cutoutTarget.r;
      const dg = g - cutoutTarget.g;
      const db = b - cutoutTarget.b;
      const distSq = dr * dr + dg * dg + db * db;
      const isBg = distSq < cutoutTolSq;

      if (isBg) {
        if (!cutoutInvert) {
          data[i + 3] = 0;
          continue;
        }
      } else if (featherPx > 0 && distSq < outerTolSq) {
        const innerTol = (adj.cutoutTolerance || 30) * 2;
        const dist = Math.sqrt(distSq);
        const t = Math.max(0, Math.min(1, (dist - innerTol) / Math.max(1, outerTol - innerTol)));
        const factor = cutoutInvert ? (1 - t) : t;
        data[i + 3] = Math.round(data[i + 3] * factor);
        if (data[i + 3] === 0) continue;
      } else if (cutoutInvert) {
        data[i + 3] = 0;
        continue;
      }
    }

    if (exposureMult !== 1) {
      r *= exposureMult;
      g *= exposureMult;
      b *= exposureMult;
    }
    if (brightnessOffset !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    if (adj.contrast !== 0) {
      r = (r - 128) * contrastFactorSq + 128;
      g = (g - 128) * contrastFactorSq + 128;
      b = (b - 128) * contrastFactorSq + 128;
    }

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const lumNorm = clamp(lum / 255, 0, 1);

    if (highlightsAdj !== 0) {
      const highlightMask = Math.pow(lumNorm, 2);
      const delta = highlightsAdj * 70 * highlightMask;
      r += delta; g += delta; b += delta;
    }

    if (shadowsAdj !== 0) {
      const shadowMask = Math.pow(1 - lumNorm, 2);
      const delta = shadowsAdj * 70 * shadowMask;
      r += delta; g += delta; b += delta;
    }

    if (whitesAdj !== 0) {
      const whiteMask = Math.max(0, (lumNorm - 0.7) / 0.3);
      const delta = whitesAdj * 50 * whiteMask;
      r += delta; g += delta; b += delta;
    }

    if (blacksAdj !== 0) {
      const blackMask = Math.max(0, (0.3 - lumNorm) / 0.3);
      const delta = blacksAdj * 50 * blackMask;
      r += delta; g += delta; b += delta;
    }

    if (fadeLift > 0) {
      r = r + (255 - r) * (fadeLift / 255) * Math.max(0, 1 - lumNorm);
      g = g + (255 - g) * (fadeLift / 255) * Math.max(0, 1 - lumNorm);
      b = b + (255 - b) * (fadeLift / 255) * Math.max(0, 1 - lumNorm);
    }

    if (gammaVal !== 1) {
      r = 255 * Math.pow(clamp(r / 255, 0, 1), invGamma);
      g = 255 * Math.pow(clamp(g / 255, 0, 1), invGamma);
      b = 255 * Math.pow(clamp(b / 255, 0, 1), invGamma);
    }

    if (temp !== 0) {
      r += temp * 30;
      b -= temp * 30;
    }
    if (tint !== 0) {
      g -= tint * 25;
      r += tint * 12;
      b += tint * 12;
    }

    if (rChan !== 0) r += rChan;
    if (gChan !== 0) g += gChan;
    if (bChan !== 0) b += bChan;

    if (shadowTintRgb) {
      const shadowWeight = Math.pow(1 - lumNorm, 1.5) * shadowsSat;
      r += (shadowTintRgb[0] - 128) * shadowWeight * 0.7;
      g += (shadowTintRgb[1] - 128) * shadowWeight * 0.7;
      b += (shadowTintRgb[2] - 128) * shadowWeight * 0.7;
    }
    if (midtoneTintRgb) {
      const midtoneWeight = (1 - Math.abs(lumNorm - 0.5) * 2) * midtonesSat;
      r += (midtoneTintRgb[0] - 128) * midtoneWeight * 0.7;
      g += (midtoneTintRgb[1] - 128) * midtoneWeight * 0.7;
      b += (midtoneTintRgb[2] - 128) * midtoneWeight * 0.7;
    }
    if (highlightTintRgb) {
      const highlightWeight = Math.pow(lumNorm, 1.5) * highlightsSat;
      r += (highlightTintRgb[0] - 128) * highlightWeight * 0.7;
      g += (highlightTintRgb[1] - 128) * highlightWeight * 0.7;
      b += (highlightTintRgb[2] - 128) * highlightWeight * 0.7;
    }

    if (satMult !== 1 || vibranceVal !== 0 || hueShift !== 0) {
      r = clamp(r, 0, 255);
      g = clamp(g, 0, 255);
      b = clamp(b, 0, 255);

      let [h, s, l] = rgbToHsl(r, g, b);

      if (hueShift !== 0) {
        h = (h + hueShift) % 360;
      }

      if (satMult !== 1) {
        s *= satMult;
      }

      if (vibranceVal !== 0) {
        const vibranceBoost = (1 - s) * vibranceVal;
        s += vibranceBoost;
      }

      s = clamp(s, 0, 1);
      const [newR, newG, newB] = hslToRgb(h, s, l);
      r = newR;
      g = newG;
      b = newB;
    }

    if (adj.toneStyle && adj.toneStyle !== 'none') {
      const strength = (adj.toneStrength || 100) / 100;
      const grey = 0.299 * r + 0.587 * g + 0.114 * b;

      let tr = grey, tg = grey, tb = grey;
      if (adj.toneStyle === 'sepia') {
        tr = grey + 35;
        tg = grey + 10;
        tb = grey - 25;
      } else if (adj.toneStyle === 'cyanotype') {
        tr = grey - 30;
        tg = grey;
        tb = grey + 45;
      } else if (adj.toneStyle === 'platinum') {
        tr = grey + 5;
        tg = grey + 2;
        tb = grey + 12;
      } else if (adj.toneStyle === 'warm-bronze') {
        tr = grey + 25;
        tg = grey + 15;
        tb = grey - 10;
      }

      r = r * (1 - strength) + tr * strength;
      g = g * (1 - strength) + tg * strength;
      b = b * (1 - strength) + tb * strength;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  if (adj.sharpen > 0 || adj.clarity > 0) {
    applySharpenConvolution(imageData, adj.sharpen, adj.clarity);
  }

  if (adj.grain > 0) {
    applyFilmGrain(imageData, adj.grain);
  }

  if (adj.vignette > 0) {
    applyVignette(imageData, adj.vignette);
  }

  return imageData;
}

function applySharpenConvolution(imageData, sharpenAmount, clarityAmount) {
  const w = imageData.width;
  const h = imageData.height;
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;

  const sharpFactor = (sharpenAmount / 100) * 1.5;
  const clarityFactor = (clarityAmount / 100) * 0.8;
  const totalAmount = sharpFactor + clarityFactor;
  if (totalAmount <= 0) return;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const top = ((y - 1) * w + x) * 4;
      const bot = ((y + 1) * w + x) * 4;
      const lft = (y * w + (x - 1)) * 4;
      const rgt = (y * w + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        const laplacian = 4 * center - src[top + c] - src[bot + c] - src[lft + c] - src[rgt + c];
        dst[idx + c] = clamp(center + laplacian * totalAmount * 0.4);
      }
    }
  }
}

function applyFilmGrain(imageData, grainAmount) {
  const data = imageData.data;
  const len = data.length;
  const strength = (grainAmount / 100) * 35;

  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] === 0) continue;
    const noise = (Math.random() - 0.5) * strength;
    data[i] = clamp(data[i] + noise);
    data[i + 1] = clamp(data[i + 1] + noise);
    data[i + 2] = clamp(data[i + 2] + noise);
  }
}

function applyVignette(imageData, vignetteAmount) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const strength = (vignetteAmount / 100) * 1.4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] === 0) continue;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const factor = 1 - Math.pow(dist, 2) * strength;

      data[idx] = clamp(data[idx] * factor);
      data[idx + 1] = clamp(data[idx + 1] * factor);
      data[idx + 2] = clamp(data[idx + 2] * factor);
    }
  }
}

export function applyFastBlur(ctx, width, height, radius) {
  if (radius <= 0) return;
  ctx.save();
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, width, height);
  ctx.filter = 'none';
  ctx.restore();
}

export function applyPrivacyZones(ctx, zones) {
  if (!zones || zones.length === 0) return;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  for (const zone of zones) {
    let zx = zone.x <= 1 ? Math.round(zone.x * cw) : Math.round(zone.x);
    let zy = zone.y <= 1 ? Math.round(zone.y * ch) : Math.round(zone.y);
    let zw = zone.width <= 1 ? Math.round(zone.width * cw) : Math.round(zone.width);
    let zh = zone.height <= 1 ? Math.round(zone.height * ch) : Math.round(zone.height);

    zx = Math.max(0, Math.min(cw - 1, zx));
    zy = Math.max(0, Math.min(ch - 1, zy));
    zw = Math.max(4, Math.min(cw - zx, zw));
    zh = Math.max(4, Math.min(ch - zy, zh));

    if (zw <= 4 || zh <= 4) continue;

    if (zone.type === 'pixel') {
      const blockSize = Math.max(4, Math.round((zone.strength || 16)));
      const subImg = ctx.getImageData(zx, zy, zw, zh);
      const subData = subImg.data;

      for (let py = 0; py < zh; py += blockSize) {
        for (let px = 0; px < zw; px += blockSize) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let by = 0; by < blockSize && py + by < zh; by++) {
            for (let bx = 0; bx < blockSize && px + bx < zw; bx++) {
              const idx = ((py + by) * zw + (px + bx)) * 4;
              r += subData[idx];
              g += subData[idx + 1];
              b += subData[idx + 2];
              count++;
            }
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          for (let by = 0; by < blockSize && py + by < zh; by++) {
            for (let bx = 0; bx < blockSize && px + bx < zw; bx++) {
              const idx = ((py + by) * zw + (px + bx)) * 4;
              subData[idx] = r;
              subData[idx + 1] = g;
              subData[idx + 2] = b;
            }
          }
        }
      }
      ctx.putImageData(subImg, zx, zy);
    } else {
      const blurRadius = Math.max(4, Math.round((zone.strength || 15)));
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = zw;
      tempCanvas.height = zh;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(ctx.canvas, zx, zy, zw, zh, 0, 0, zw, zh);

      ctx.save();
      ctx.beginPath();
      ctx.rect(zx, zy, zw, zh);
      ctx.clip();
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(tempCanvas, zx, zy);
      ctx.restore();
    }
  }
}

export function applyRetouchStrokes(ctx, width, height, retouchStrokes) {
  if (!retouchStrokes || retouchStrokes.length === 0) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (const stroke of retouchStrokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    const mode = stroke.mode;
    const radius = Math.max(4, (stroke.size || 24) / 2);
    const radiusSq = radius * radius;
    const strength = Math.max(0.1, Math.min(1.0, (stroke.strength || 50) / 100));

    for (let pIdx = 0; pIdx < stroke.points.length; pIdx++) {
      const pt = stroke.points[pIdx];
      const cx = Math.round(pt.x);
      const cy = Math.round(pt.y);

      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(width - 1, Math.ceil(cx + radius));
      const minY = Math.max(0, Math.floor(cy - radius));
      const maxY = Math.min(height - 1, Math.ceil(cy + radius));

      if (mode === 'spot-heal') {
        const outerR = radius * 1.6;
        const outerRSq = outerR * outerR;
        let ringR = 0, ringG = 0, ringB = 0, count = 0;

        const sMinX = Math.max(0, Math.floor(cx - outerR));
        const sMaxX = Math.min(width - 1, Math.ceil(cx + outerR));
        const sMinY = Math.max(0, Math.floor(cy - outerR));
        const sMaxY = Math.min(height - 1, Math.ceil(cy + outerR));

        for (let y = sMinY; y <= sMaxY; y++) {
          for (let x = sMinX; x <= sMaxX; x++) {
            const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dSq >= radiusSq && dSq <= outerRSq) {
              const idx = (y * width + x) * 4;
              ringR += data[idx];
              ringG += data[idx + 1];
              ringB += data[idx + 2];
              count++;
            }
          }
        }

        if (count > 0) {
          const avgR = ringR / count;
          const avgG = ringG / count;
          const avgB = ringB / count;

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
              if (dSq <= radiusSq) {
                const dist = Math.sqrt(dSq);
                const t = 1 - (dist / radius);
                const w = (t * t * (3 - 2 * t)) * strength;
                const idx = (y * width + x) * 4;

                data[idx] = Math.round(data[idx] * (1 - w) + avgR * w);
                data[idx + 1] = Math.round(data[idx + 1] * (1 - w) + avgG * w);
                data[idx + 2] = Math.round(data[idx + 2] * (1 - w) + avgB * w);
              }
            }
          }
        }
      } else if (mode === 'dodge') {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dSq <= radiusSq) {
              const dist = Math.sqrt(dSq);
              const t = 1 - (dist / radius);
              const w = t * strength * 0.28;
              const idx = (y * width + x) * 4;

              data[idx] = Math.min(255, Math.round(data[idx] + (255 - data[idx]) * w));
              data[idx + 1] = Math.min(255, Math.round(data[idx + 1] + (255 - data[idx + 1]) * w));
              data[idx + 2] = Math.min(255, Math.round(data[idx + 2] + (255 - data[idx + 2]) * w));
            }
          }
        }
      } else if (mode === 'burn') {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dSq <= radiusSq) {
              const dist = Math.sqrt(dSq);
              const t = 1 - (dist / radius);
              const w = t * strength * 0.28;
              const idx = (y * width + x) * 4;

              data[idx] = Math.max(0, Math.round(data[idx] * (1 - w)));
              data[idx + 1] = Math.max(0, Math.round(data[idx + 1] * (1 - w)));
              data[idx + 2] = Math.max(0, Math.round(data[idx + 2] * (1 - w)));
            }
          }
        }
      } else if (mode === 'blur') {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dSq <= radiusSq) {
              const dist = Math.sqrt(dSq);
              const w = (1 - dist / radius) * strength * 0.8;
              const br = 2;
              let sr = 0, sg = 0, sb = 0, sc = 0;
              for (let dy = -br; dy <= br; dy++) {
                for (let dx = -br; dx <= br; dx++) {
                  const ny = Math.max(0, Math.min(height - 1, y + dy));
                  const nx = Math.max(0, Math.min(width - 1, x + dx));
                  const nIdx = (ny * width + nx) * 4;
                  sr += data[nIdx];
                  sg += data[nIdx + 1];
                  sb += data[nIdx + 2];
                  sc++;
                }
              }
              const avgR = sr / sc;
              const avgG = sg / sc;
              const avgB = sb / sc;
              const idx = (y * width + x) * 4;

              data[idx] = Math.round(data[idx] * (1 - w) + avgR * w);
              data[idx + 1] = Math.round(data[idx + 1] * (1 - w) + avgG * w);
              data[idx + 2] = Math.round(data[idx + 2] * (1 - w) + avgB * w);
            }
          }
        }
      } else if (mode === 'sponge') {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dSq <= radiusSq) {
              const dist = Math.sqrt(dSq);
              const w = (1 - dist / radius) * strength * 0.75;
              const idx = (y * width + x) * 4;
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;

              data[idx] = Math.min(255, Math.max(0, Math.round(r + (r - lum) * w)));
              data[idx + 1] = Math.min(255, Math.max(0, Math.round(g + (g - lum) * w)));
              data[idx + 2] = Math.min(255, Math.max(0, Math.round(b + (b - lum) * w)));
            }
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
