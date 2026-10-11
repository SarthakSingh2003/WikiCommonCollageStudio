// Commons Collage Studio — Professional Export & Wikimedia Attribution Manifest Engine

export class ExportEngine {
  constructor(collageEngine) {
    this.engine = collageEngine;
    this.format = 'image/png';
    this.quality = 0.92;
    this.scale = 1; // 1x, 2x, 3x
  }

  /**
   * Render composition onto a high-resolution export canvas
   * @param {number} scaleMultiplier - e.g. 1, 2, or 3
   * @returns {HTMLCanvasElement}
   */
  renderExportCanvas(scaleMultiplier = 1) {
    const origW = this.engine.width;
    const origH = this.engine.height;
    const exportW = origW * scaleMultiplier;
    const exportH = origH * scaleMultiplier;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const ctx = exportCanvas.getContext('2d');

    ctx.save();
    ctx.scale(scaleMultiplier, scaleMultiplier);

    // 1. Background
    if (this.engine.transparentBg && (this.format === 'image/png' || this.format === 'image/webp')) {
      ctx.clearRect(0, 0, origW, origH);
    } else {
      ctx.fillStyle = this.engine.bgColor || '#F8F9FD';
      ctx.fillRect(0, 0, origW, origH);
    }

    // 2. Render Photos into their layout slots
    const slots = this.engine.calculateSlots();
    for (let i = 0; i < this.engine.photos.length; i++) {
      const photo = this.engine.photos[i];
      if (!photo.visible) continue;

      const slot = slots[i] || slots[slots.length - 1];
      if (!slot) continue;

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

      if (this.engine.cornerRadius > 0) {
        ctx.beginPath();
        roundRect(ctx, 0, 0, slot.width, slot.height, this.engine.cornerRadius);
        ctx.clip();
      }

      if (photo.adjustments.shadowEnabled) {
        ctx.shadowColor = `rgba(0, 0, 0, ${(photo.adjustments.shadowOpacity || 30) / 100})`;
        ctx.shadowBlur = photo.adjustments.shadowBlur || 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
      }

      ctx.drawImage(photo.processedCanvas, 0, 0, slot.width, slot.height);
      ctx.restore();
    }

    // 3. Render Annotations
    for (const annot of this.engine.annotations) {
      annot.render(ctx);
    }

    ctx.restore();
    return exportCanvas;
  }

  /**
   * Generate Data URL for export
   */
  getExportDataUrl(scale = 1, format = 'image/png', quality = 0.92) {
    const canvas = this.renderExportCanvas(scale);
    return canvas.toDataURL(format, quality);
  }

  /**
   * Estimate output file size in bytes
   */
  async estimateFileSize(scale = 1, format = 'image/png', quality = 0.92) {
    const canvas = this.renderExportCanvas(scale);
    return new Promise(resolve => {
      canvas.toBlob(
        blob => {
          resolve(blob ? blob.size : 0);
        },
        format,
        quality
      );
    });
  }

  /**
   * Generate standard Wikimedia Commons Information template markup
   */
  generateWikiTextManifest() {
    const photos = this.engine.photos;
    if (photos.length === 0) {
      return `== {{int:filedesc}} ==\n{{Information\n|description = Image collage created with Commons Collage Studio.\n|date = ${new Date().toISOString().slice(0, 10)}\n|source = {{own}}\n|author = Commons Collage Studio User\n|permission = {{CC-BY-SA-4.0}}\n}}`;
    }

    let itemsWiki = '';
    photos.forEach((p, idx) => {
      itemsWiki += `* '''Image ${idx + 1}''': [${p.meta.sourceUrl || '#'} "${p.meta.title}"] by ${p.meta.author || 'Unknown'} (${p.meta.license || 'Public Domain'})\n`;
    });

    return `== {{int:filedesc}} ==
{{Information
|description = {{en|1=Photographic composite collage arranged and edited using Commons Collage Studio Pro.}}
Composition includes:
${itemsWiki}
|date = ${new Date().toISOString().slice(0, 10)}
|source = Composite derived from Wikimedia Commons files:
${photos.map(p => `* ${p.meta.sourceUrl || p.meta.title}`).join('\n')}
|author = Composite author; individual image credits: ${photos.map(p => p.meta.author).join(', ')}
|permission = Composite released under compatible Creative Commons license.
}}

== {{int:license-header}} ==
{{self|CC-BY-SA-4.0}}
`;
  }

  /**
   * Generate Markdown attribution manifest
   */
  generateMarkdownManifest() {
    const photos = this.engine.photos;
    let md = `# Commons Collage Composition Attribution Manifest\n\n`;
    md += `Export Date: ${new Date().toLocaleDateString()}\n`;
    md += `Dimensions: ${this.engine.width} × ${this.engine.height} px\n\n`;
    md += `## Included Photographic Sources\n\n`;

    photos.forEach((p, idx) => {
      md += `### ${idx + 1}. ${p.meta.title}\n`;
      md += `- **Author / Creator**: ${p.meta.author}\n`;
      md += `- **License**: ${p.meta.license}\n`;
      if (p.meta.sourceUrl) {
        md += `- **Source URL**: [${p.meta.sourceUrl}](${p.meta.sourceUrl})\n`;
      }
      if (p.meta.description) {
        md += `- **Description**: ${p.meta.description}\n`;
      }
      md += `\n`;
    });

    return md;
  }

  /**
   * Serialize entire studio state to JSON for non-destructive project save
   */
  exportProjectJson() {
    const project = {
      version: '1.0.0',
      appName: 'Commons Collage Studio Pro',
      savedAt: new Date().toISOString(),
      canvas: {
        width: this.engine.width,
        height: this.engine.height,
        aspectRatio: this.engine.aspectRatio,
        layout: this.engine.layout,
        spacing: this.engine.spacing,
        padding: this.engine.padding,
        cornerRadius: this.engine.cornerRadius,
        bgColor: this.engine.bgColor,
        transparentBg: this.engine.transparentBg
      },
      photos: this.engine.photos.map(p => ({
        id: p.id,
        meta: p.meta,
        adjustments: p.adjustments,
        opacity: p.opacity,
        visible: p.visible,
        locked: p.locked,
        retouchStrokes: p.retouchStrokes,
        // Embed image data URL for full project portability
        imageSrc: p.img.src
      })),
      annotations: this.engine.annotations.map(a => ({
        id: a.id,
        type: a.type,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        rotation: a.rotation,
        opacity: a.opacity,
        locked: a.locked,
        visible: a.visible,
        text: a.text,
        fontFamily: a.fontFamily,
        fontSize: a.fontSize,
        fontWeight: a.fontWeight,
        textAlign: a.textAlign,
        color: a.color,
        fillColor: a.fillColor,
        strokeColor: a.strokeColor,
        strokeWidth: a.strokeWidth,
        hasBg: a.hasBg,
        cornerRadius: a.cornerRadius,
        pinNumber: a.pinNumber,
        endX: a.endX,
        endY: a.endY
      }))
    };

    return JSON.stringify(project, null, 2);
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
