import { applyImageAdjustments, applyFastBlur, applyPrivacyZones, applyRetouchStrokes, DEFAULT_ADJUSTMENTS } from './imageProcessing.js';

export class CollagePhoto {
  constructor(imgElement, meta = {}) {
    this.id = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.img = imgElement;
    this.meta = {
      title: meta.title || 'Untitled Photograph',
      author: meta.author || 'Wikimedia Commons Contributor',
      sourceUrl: meta.sourceUrl || '',
      license: meta.license || 'CC BY-SA 4.0',
      date: meta.date || '',
      description: meta.description || ''
    };
    this.adjustments = JSON.parse(JSON.stringify(DEFAULT_ADJUSTMENTS));
    this.opacity = 1.0;
    this.visible = true;
    this.locked = false;

    this.freeformBounds = null;
    this.retouchStrokes = [];

    this.processedCanvas = document.createElement('canvas');
    this.needsProcessing = true;
  }

  updateProcessedCanvas() {
    if (!this.img || !this.img.naturalWidth) return;

    const naturalW = this.img.naturalWidth;
    const naturalH = this.img.naturalHeight;

    const crop = this.adjustments.crop || { x: 0, y: 0, width: 1, height: 1 };
    const sx = Math.max(0, Math.min(naturalW, crop.x * naturalW));
    const sy = Math.max(0, Math.min(naturalH, crop.y * naturalH));
    const sw = Math.max(10, Math.min(naturalW - sx, crop.width * naturalW));
    const sh = Math.max(10, Math.min(naturalH - sy, crop.height * naturalH));

    this.processedCanvas.width = sw;
    this.processedCanvas.height = sh;
    const ctx = this.processedCanvas.getContext('2d', { willReadFrequently: true });

    ctx.drawImage(this.img, sx, sy, sw, sh, 0, 0, sw, sh);

    const imgData = ctx.getImageData(0, 0, sw, sh);
    applyImageAdjustments(imgData, this.adjustments);
    ctx.putImageData(imgData, 0, 0);

    if (this.adjustments.blur > 0) {
      applyFastBlur(ctx, sw, sh, this.adjustments.blur);
    }

    if (this.retouchStrokes.length > 0) {
      applyRetouchStrokes(ctx, sw, sh, this.retouchStrokes);
    }

    if (this.adjustments.privacyZones && this.adjustments.privacyZones.length > 0) {
      applyPrivacyZones(ctx, this.adjustments.privacyZones);
    }

    this.needsProcessing = false;
  }
}

export class CollageEngine {
  constructor(mainCanvas, overlayCanvas) {
    this.mainCanvas = mainCanvas;
    this.overlayCanvas = overlayCanvas;
    this.ctx = mainCanvas.getContext('2d');
    this.overlayCtx = overlayCanvas.getContext('2d');

    this.width = 1200;
    this.height = 900;
    this.aspectRatio = '4:3';

    this.photos = [];
    this.activePhotoIndex = -1;

    this.annotations = [];
    this.activeAnnotationIndex = -1;

    this.layout = 'single';
    this.spacing = 16;
    this.padding = 20;
    this.cornerRadius = 8;
    this.bgColor = '#F8F9FD';
    this.transparentBg = false;

    this.showSplitComparison = false;
    this.splitRatio = 0.5;
    this.holdOriginalMode = false;

    this.isCropModeActive = false;
    this.cropGuide = 'thirds';
    this.activeCropRect = null;

    this.activeBrushMode = 'none';
    this.brushSize = 24;
    this.brushStrength = 50;
    this.currentBrushStroke = null;
    this.brushCursorPos = null;

    this.activePrivacyZoneIndex = -1;
  }

  setDimensions(w, h) {
    this.width = Math.round(w);
    this.height = Math.round(h);
    this.mainCanvas.width = this.width;
    this.mainCanvas.height = this.height;
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;
    this.render();
  }

  addPhoto(photo) {
    this.photos.push(photo);
    if (this.activePhotoIndex === -1) {
      this.activePhotoIndex = 0;
    }
    this.updateLayoutAuto();
    this.render();
    return photo;
  }

  removePhoto(index) {
    if (index >= 0 && index < this.photos.length) {
      this.photos.splice(index, 1);
      if (this.activePhotoIndex >= this.photos.length) {
        this.activePhotoIndex = this.photos.length - 1;
      }
      this.updateLayoutAuto();
      this.render();
    }
  }

  getActivePhoto() {
    if (this.activePhotoIndex >= 0 && this.activePhotoIndex < this.photos.length) {
      return this.photos[this.activePhotoIndex];
    }
    return null;
  }

  updateLayoutAuto() {
    const count = this.photos.length;
    if (this.layout === 'single' && count > 1) {
      if (count === 2) this.layout = 'split-h';
      else if (count === 3) this.layout = 'featured-3';
      else if (count >= 4) this.layout = 'grid-2x2';
    }
  }

  calculateSlots() {
    const w = this.width;
    const h = this.height;
    const p = this.padding;
    const s = this.spacing;
    const innerW = w - p * 2;
    const innerH = h - p * 2;
    const slots = [];

    switch (this.layout) {
      case 'single':
        slots.push({ x: p, y: p, width: innerW, height: innerH });
        break;

      case 'split-h': {
        const slotW = (innerW - s) / 2;
        slots.push({ x: p, y: p, width: slotW, height: innerH });
        slots.push({ x: p + slotW + s, y: p, width: slotW, height: innerH });
        break;
      }

      case 'split-v': {
        const slotH = (innerH - s) / 2;
        slots.push({ x: p, y: p, width: innerW, height: slotH });
        slots.push({ x: p, y: p + slotH + s, width: innerW, height: slotH });
        break;
      }

      case 'grid-2x2': {
        const slotW = (innerW - s) / 2;
        const slotH = (innerH - s) / 2;
        slots.push({ x: p, y: p, width: slotW, height: slotH });
        slots.push({ x: p + slotW + s, y: p, width: slotW, height: slotH });
        slots.push({ x: p, y: p + slotH + s, width: slotW, height: slotH });
        slots.push({ x: p + slotW + s, y: p + slotH + s, width: slotW, height: slotH });
        break;
      }

      case 'featured-3': {
        const leftW = (innerW - s) * 0.62;
        const rightW = (innerW - s) * 0.38;
        const rightH = (innerH - s) / 2;
        slots.push({ x: p, y: p, width: leftW, height: innerH });
        slots.push({ x: p + leftW + s, y: p, width: rightW, height: rightH });
        slots.push({ x: p + leftW + s, y: p, width: rightW, height: rightH });
        break;
      }

      case 'filmstrip-3': {
        const slotW = (innerW - s * 2) / 3;
        for (let i = 0; i < 3; i++) {
          slots.push({ x: p + i * (slotW + s), y: p, width: slotW, height: innerH });
        }
        break;
      }

      case 'grid-3x2': {
        const slotW = (innerW - s * 2) / 3;
        const slotH = (innerH - s) / 2;
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 3; c++) {
            slots.push({ x: p + c * (slotW + s), y: p + r * (slotH + s), width: slotW, height: slotH });
          }
        }
        break;
      }

      case 'freeform':
      default:
        for (let i = 0; i < this.photos.length; i++) {
          const photo = this.photos[i];
          if (photo.freeformBounds) {
            slots.push(photo.freeformBounds);
          } else {
            const aspect = (photo.img && photo.img.naturalWidth && photo.img.naturalHeight)
              ? (photo.img.naturalWidth / photo.img.naturalHeight)
              : (4 / 3);
            const fw = Math.min(innerW * 0.45, 460);
            const fh = Math.round(fw / Math.max(0.2, aspect));
            const offsetX = p + (i * 60) % Math.max(20, innerW - fw);
            const offsetY = p + (i * 50) % Math.max(20, innerH - fh);
            const defaultBounds = { x: Math.round(offsetX), y: Math.round(offsetY), width: Math.round(fw), height: Math.round(fh) };
            photo.freeformBounds = defaultBounds;
            slots.push(defaultBounds);
          }
        }
        break;
    }

    return slots;
  }

  cascadeFreeformPhotos() {
    const p = this.padding;
    const innerW = this.width - p * 2;
    const innerH = this.height - p * 2;
    this.photos.forEach((photo, i) => {
      const aspect = (photo.img && photo.img.naturalWidth && photo.img.naturalHeight)
        ? (photo.img.naturalWidth / photo.img.naturalHeight)
        : (4 / 3);
      const fw = Math.min(innerW * 0.45, 440);
      const fh = Math.round(fw / Math.max(0.2, aspect));
      const offsetX = p + (i * 50) % Math.max(20, innerW - fw);
      const offsetY = p + (i * 40) % Math.max(20, innerH - fh);
      photo.freeformBounds = { x: Math.round(offsetX), y: Math.round(offsetY), width: Math.round(fw), height: Math.round(fh) };
    });
    this.render();
  }

  centerActivePhotoFreeform() {
    const activePhoto = this.getActivePhoto();
    if (!activePhoto || !activePhoto.freeformBounds) return;
    const b = activePhoto.freeformBounds;
    b.x = Math.round((this.width - b.width) / 2);
    b.y = Math.round((this.height - b.height) / 2);
    this.render();
  }

  fitActivePhotoFreeform() {
    const activePhoto = this.getActivePhoto();
    if (!activePhoto || !activePhoto.freeformBounds) return;
    const p = this.padding;
    const innerW = this.width - p * 2;
    const innerH = this.height - p * 2;
    const aspect = (activePhoto.img && activePhoto.img.naturalWidth && activePhoto.img.naturalHeight)
      ? (activePhoto.img.naturalWidth / activePhoto.img.naturalHeight)
      : (activePhoto.freeformBounds.width / activePhoto.freeformBounds.height);
    
    let fw = innerW;
    let fh = Math.round(fw / aspect);
    if (fh > innerH) {
      fh = innerH;
      fw = Math.round(fh * aspect);
    }
    activePhoto.freeformBounds = {
      x: Math.round(p + (innerW - fw) / 2),
      y: Math.round(p + (innerH - fh) / 2),
      width: Math.round(fw),
      height: Math.round(fh)
    };
    this.render();
  }

  resetActivePhotoFreeformAspect() {
    const activePhoto = this.getActivePhoto();
    if (!activePhoto || !activePhoto.freeformBounds) return;
    const b = activePhoto.freeformBounds;
    const aspect = (activePhoto.img && activePhoto.img.naturalWidth && activePhoto.img.naturalHeight)
      ? (activePhoto.img.naturalWidth / activePhoto.img.naturalHeight)
      : (4 / 3);
    b.height = Math.round(b.width / aspect);
    this.render();
  }

  movePhotoLayer(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.photos.length || toIndex < 0 || toIndex >= this.photos.length) return;
    const [moved] = this.photos.splice(fromIndex, 1);
    this.photos.splice(toIndex, 0, moved);
    this.activePhotoIndex = toIndex;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    if (this.transparentBg) {
      this.renderCheckerboard(ctx, w, h);
    } else {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.photos.length === 0) {
      ctx.save();
      const p = this.padding;
      const innerW = w - p * 2;
      const innerH = h - p * 2;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      roundRect(ctx, p, p, innerW, innerH, this.cornerRadius || 8);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Canvas is ready for your photos', w / 2, h / 2 - 10);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Click "+ Add Photos" or "Commons Search" to start your composition', w / 2, h / 2 + 18);
      ctx.restore();
    }

    const slots = this.calculateSlots();
    const activePhoto = this.getActivePhoto();

    for (let i = 0; i < this.photos.length; i++) {
      const photo = this.photos[i];
      if (!photo.visible) continue;

      const slot = slots[i] || slots[slots.length - 1];
      if (!slot) continue;

      photo.slotBounds = slot;

      if (photo.needsProcessing) {
        photo.updateProcessedCanvas();
      }

      ctx.save();
      ctx.globalAlpha = photo.opacity;

      const centerX = slot.x + slot.width / 2;
      const centerY = slot.y + slot.height / 2;
      ctx.translate(centerX, centerY);

      const totalAngle = (photo.adjustments.rotation || 0) + (photo.adjustments.straighten || 0);
      if (totalAngle !== 0) {
        ctx.rotate((totalAngle * Math.PI) / 180);
      }
      const scaleX = photo.adjustments.flipH ? -1 : 1;
      const scaleY = photo.adjustments.flipV ? -1 : 1;
      if (scaleX !== 1 || scaleY !== 1) {
        ctx.scale(scaleX, scaleY);
      }

      ctx.translate(-slot.width / 2, -slot.height / 2);

      if (this.cornerRadius > 0) {
        ctx.beginPath();
        roundRect(ctx, 0, 0, slot.width, slot.height, this.cornerRadius);
        ctx.clip();
      }

      if (photo.adjustments.shadowEnabled) {
        ctx.shadowColor = `rgba(0, 0, 0, ${(photo.adjustments.shadowOpacity || 30) / 100})`;
        ctx.shadowBlur = photo.adjustments.shadowBlur || 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
      }

      if (this.holdOriginalMode && photo === activePhoto) {
        ctx.drawImage(photo.img, 0, 0, slot.width, slot.height);
      } else {
        ctx.drawImage(photo.processedCanvas, 0, 0, slot.width, slot.height);
      }

      ctx.restore();
    }

    for (const annot of this.annotations) {
      annot.render(ctx);
    }

    if (this.showSplitComparison && activePhoto && activePhoto.slotBounds) {
      this.renderSplitComparison(ctx, activePhoto);
    }

    this.renderOverlays();
  }

  renderCheckerboard(ctx, w, h) {
    const size = 16;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#FFFFFF' : '#E8EDF5';
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  renderSplitComparison(ctx, photo) {
    const slot = photo.slotBounds;
    if (!slot) return;

    const splitX = slot.x + slot.width * this.splitRatio;

    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, splitX - slot.x, slot.height);
    ctx.clip();
    ctx.drawImage(photo.img, slot.x, slot.y, slot.width, slot.height);
    ctx.restore();
  }

  renderOverlays() {
    const oCtx = this.overlayCtx;
    oCtx.clearRect(0, 0, this.width, this.height);

    const activePhoto = this.getActivePhoto();

    if (activePhoto && activePhoto.slotBounds && !this.isCropModeActive) {
      const b = activePhoto.slotBounds;
      oCtx.save();
      if (this.layout === 'freeform') {
        oCtx.shadowColor = 'rgba(124, 58, 237, 0.35)';
        oCtx.shadowBlur = 8;
        oCtx.strokeStyle = '#7C3AED';
        oCtx.lineWidth = 2.5;
        oCtx.strokeRect(b.x, b.y, b.width, b.height);
        oCtx.shadowBlur = 0;

        const topMidX = b.x + b.width / 2;
        const topMidY = b.y;
        const rotKnobY = b.y - 26;

        oCtx.beginPath();
        oCtx.strokeStyle = '#7C3AED';
        oCtx.lineWidth = 2;
        oCtx.moveTo(topMidX, topMidY);
        oCtx.lineTo(topMidX, rotKnobY);
        oCtx.stroke();

        oCtx.beginPath();
        oCtx.arc(topMidX, rotKnobY, 7, 0, Math.PI * 2);
        oCtx.fillStyle = '#FFFFFF';
        oCtx.fill();
        oCtx.strokeStyle = '#7C3AED';
        oCtx.lineWidth = 2.5;
        oCtx.stroke();

        oCtx.beginPath();
        oCtx.arc(topMidX, rotKnobY, 2.5, 0, Math.PI * 2);
        oCtx.fillStyle = '#7C3AED';
        oCtx.fill();

        const cornerHw = 12;
        const cornerHandles = [
          { x: b.x, y: b.y },
          { x: b.x + b.width, y: b.y },
          { x: b.x, y: b.y + b.height },
          { x: b.x + b.width, y: b.y + b.height }
        ];
        oCtx.fillStyle = '#FFFFFF';
        oCtx.strokeStyle = '#7C3AED';
        oCtx.lineWidth = 2;
        for (const ch of cornerHandles) {
          oCtx.beginPath();
          roundRect(oCtx, ch.x - cornerHw / 2, ch.y - cornerHw / 2, cornerHw, cornerHw, 3);
          oCtx.fill();
          oCtx.stroke();
        }

        const edgeHandles = [
          { x: topMidX, y: b.y, w: 16, h: 8 },
          { x: topMidX, y: b.y + b.height, w: 16, h: 8 },
          { x: b.x, y: b.y + b.height / 2, w: 8, h: 16 },
          { x: b.x + b.width, y: b.y + b.height / 2, w: 8, h: 16 }
        ];
        for (const eh of edgeHandles) {
          oCtx.beginPath();
          roundRect(oCtx, eh.x - eh.w / 2, eh.y - eh.h / 2, eh.w, eh.h, 3);
          oCtx.fill();
          oCtx.stroke();
        }

        const rot = activePhoto.adjustments.rotation || 0;
        const rotText = rot !== 0 ? ` • 🔄 ${rot}°` : '';
        const rawTitle = (activePhoto.meta?.title || 'Photo').replace(/\.(jpe?g|png|webp|gif|svg)$/i, '');
        const cleanTitle = rawTitle.length > 24 ? rawTitle.slice(0, 22) + '…' : rawTitle;
        const tag = `📷 ${cleanTitle} (${Math.round(b.width)} × ${Math.round(b.height)}px${rotText})`;
        oCtx.font = 'bold 11px sans-serif';
        const tagW = oCtx.measureText(tag).width;
        const badgeY = Math.max(0, b.y - 48);
        oCtx.beginPath();
        roundRect(oCtx, b.x, badgeY, tagW + 16, 20, 6);
        oCtx.fillStyle = '#7C3AED';
        oCtx.fill();
        oCtx.fillStyle = '#FFFFFF';
        oCtx.fillText(tag, b.x + 8, badgeY + 14);
      } else {
        oCtx.strokeStyle = '#A580E8';
        oCtx.lineWidth = 2;
        oCtx.setLineDash([6, 4]);
        roundRect(oCtx, b.x - 2, b.y - 2, b.width + 4, b.height + 4, this.cornerRadius + 2);
        oCtx.stroke();
      }
      oCtx.restore();
    }

    if (this.isCropModeActive && activePhoto && activePhoto.slotBounds) {
      const b = this.activeCropRect || activePhoto.slotBounds;
      this.renderCropGuidelines(oCtx, b);
    }

    if (this.activeAnnotationIndex >= 0 && this.activeAnnotationIndex < this.annotations.length) {
      const annot = this.annotations[this.activeAnnotationIndex];
      if (annot && annot.visible) {
        oCtx.save();
        if (annot.type === 'arrow') {
          oCtx.strokeStyle = '#9333EA';
          oCtx.lineWidth = 2.5;
          oCtx.fillStyle = '#FFFFFF';

          oCtx.beginPath();
          oCtx.arc(annot.x, annot.y, 6, 0, Math.PI * 2);
          oCtx.fill();
          oCtx.stroke();

          oCtx.beginPath();
          oCtx.arc(annot.endX, annot.endY, 7, 0, Math.PI * 2);
          oCtx.fillStyle = '#9333EA';
          oCtx.fill();
          oCtx.stroke();
        } else {
          const bx = annot.x - annot.width / 2;
          const by = annot.y - annot.height / 2;
          const bw = annot.width;
          const bh = annot.height;

          oCtx.strokeStyle = '#9333EA';
          oCtx.lineWidth = 1.5;
          oCtx.setLineDash([5, 4]);
          roundRect(oCtx, bx - 3, by - 3, bw + 6, bh + 6, Math.max(3, (annot.cornerRadius || 0) + 2));
          oCtx.stroke();
          oCtx.setLineDash([]);

          const handles = [
            { x: bx - 3, y: by - 3 },
            { x: bx + bw + 3, y: by - 3 },
            { x: bx - 3, y: by + bh + 3 },
            { x: bx + bw + 3, y: by + bh + 3 },
            { x: bx + bw / 2, y: by - 3 },
            { x: bx + bw / 2, y: by + bh + 3 },
            { x: bx - 3, y: by + bh / 2 },
            { x: bx + bw + 3, y: by + bh / 2 }
          ];

          oCtx.fillStyle = '#FFFFFF';
          oCtx.strokeStyle = '#9333EA';
          oCtx.lineWidth = 2;
          oCtx.shadowColor = 'rgba(0,0,0,0.18)';
          oCtx.shadowBlur = 4;

          const hs = 9;
          for (const h of handles) {
            oCtx.beginPath();
            roundRect(oCtx, h.x - hs / 2, h.y - hs / 2, hs, hs, 2.5);
            oCtx.fill();
            oCtx.stroke();
          }

          const tag = `${Math.round(bw)} × ${Math.round(bh)} px`;
          oCtx.font = 'bold 11px sans-serif';
          const tw = oCtx.measureText(tag).width;
          const tagY = Math.max(16, by - 16);
          oCtx.shadowBlur = 0;
          oCtx.fillStyle = '#9333EA';
          roundRect(oCtx, bx - 2, tagY - 14, tw + 12, 17, 4);
          oCtx.fill();
          oCtx.fillStyle = '#FFFFFF';
          oCtx.fillText(tag, bx + 4, tagY - 1);
        }
        oCtx.restore();
      }
    }

    if (activePhoto && activePhoto.slotBounds && activePhoto.adjustments.privacyZones) {
      const slot = activePhoto.slotBounds;
      const zones = activePhoto.adjustments.privacyZones;

      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        const isSelected = (i === this.activePrivacyZoneIndex);

        const zx = zone.x <= 1 ? slot.x + zone.x * slot.width : slot.x + (zone.x / activePhoto.processedCanvas.width) * slot.width;
        const zy = zone.y <= 1 ? slot.y + zone.y * slot.height : slot.y + (zone.y / activePhoto.processedCanvas.height) * slot.height;
        const zw = zone.width <= 1 ? zone.width * slot.width : (zone.width / activePhoto.processedCanvas.width) * slot.width;
        const zh = zone.height <= 1 ? zone.height * slot.height : (zone.height / activePhoto.processedCanvas.height) * slot.height;

        zone.screenBounds = { x: zx, y: zy, width: zw, height: zh };

        oCtx.save();
        const strokeColor = zone.type === 'pixel' ? '#9333EA' : '#059669';
        oCtx.strokeStyle = strokeColor;
        oCtx.lineWidth = isSelected ? 2.5 : 1.5;
        if (!isSelected) {
          oCtx.setLineDash([5, 4]);
        }

        oCtx.strokeRect(zx, zy, zw, zh);

        oCtx.fillStyle = strokeColor;
        const label = zone.type === 'pixel' ? '▦ Pixelate' : '👁 Blur';
        oCtx.font = 'bold 10px sans-serif';
        const textW = oCtx.measureText(label).width;
        const tagY = Math.max(0, zy - 18);
        oCtx.fillRect(zx, tagY, textW + 10, 18);
        oCtx.fillStyle = '#FFFFFF';
        oCtx.fillText(label, zx + 5, tagY + 13);

        if (isSelected) {
          oCtx.fillStyle = '#FFFFFF';
          oCtx.strokeStyle = strokeColor;
          oCtx.lineWidth = 2;
          const hw = 8;
          const handles = [
            { x: zx, y: zy },
            { x: zx + zw, y: zy },
            { x: zx, y: zy + zh },
            { x: zx + zw, y: zy + zh }
          ];
          for (const h of handles) {
            oCtx.fillRect(h.x - hw / 2, h.y - hw / 2, hw, hw);
            oCtx.strokeRect(h.x - hw / 2, h.y - hw / 2, hw, hw);
          }
        }
        oCtx.restore();
      }
    }

    if (this.activeBrushMode !== 'none' && this.brushCursorPos) {
      oCtx.save();
      oCtx.strokeStyle = '#A580E8';
      oCtx.lineWidth = 2;
      oCtx.setLineDash([4, 4]);
      oCtx.beginPath();
      oCtx.arc(this.brushCursorPos.x, this.brushCursorPos.y, Math.max(3, this.brushSize / 2), 0, Math.PI * 2);
      oCtx.stroke();
      oCtx.restore();
    }
  }

  renderCropGuidelines(ctx, b) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.rect(b.x, b.y, b.width, b.height);
    ctx.fill('evenodd');

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.width, b.height);

    if (this.cropGuide === 'thirds') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(b.x + b.width / 3, b.y);
      ctx.lineTo(b.x + b.width / 3, b.y + b.height);
      ctx.moveTo(b.x + (b.width * 2) / 3, b.y);
      ctx.lineTo(b.x + (b.width * 2) / 3, b.y + b.height);

      ctx.moveTo(b.x, b.y + b.height / 3);
      ctx.lineTo(b.x + b.width, b.y + b.height / 3);
      ctx.moveTo(b.x, b.y + (b.height * 2) / 3);
      ctx.lineTo(b.x + b.width, b.y + (b.height * 2) / 3);
      ctx.stroke();
    } else if (this.cropGuide === 'center') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x + b.width / 2, b.y);
      ctx.lineTo(b.x + b.width / 2, b.y + b.height);
      ctx.moveTo(b.x, b.y + b.height / 2);
      ctx.lineTo(b.x + b.width, b.y + b.height / 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    const hw = 12;
    ctx.fillRect(b.x - 2, b.y - 2, hw, 4);
    ctx.fillRect(b.x - 2, b.y - 2, 4, hw);
    ctx.fillRect(b.x + b.width - hw + 2, b.y - 2, hw, 4);
    ctx.fillRect(b.x + b.width - 2, b.y - 2, 4, hw);
    ctx.fillRect(b.x - 2, b.y + b.height - 2, hw, 4);
    ctx.fillRect(b.x - 2, b.y + b.height - hw + 2, 4, hw);
    ctx.fillRect(b.x + b.width - hw + 2, b.y + b.height - 2, hw, 4);
    ctx.fillRect(b.x + b.width - 2, b.y + b.height - hw + 2, 4, hw);

    ctx.restore();
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
