export class AnnotationItem {
  constructor(options = {}) {
    this.id = options.id || `annot-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.type = options.type || 'text';
    this.x = options.x || 100;
    this.y = options.y || 100;
    this.width = options.width || 200;
    this.height = options.height || 60;
    this.rotation = options.rotation || 0;
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.locked = !!options.locked;
    this.visible = options.visible !== undefined ? options.visible : true;

    this.text = options.text || 'Annotation Text';
    this.fontFamily = options.fontFamily || "'Plus Jakarta Sans', sans-serif";
    this.fontSize = options.fontSize || 24;
    this.fontWeight = options.fontWeight || '700';
    this.textAlign = options.textAlign || 'center';
    this.color = options.color || '#2D3142';

    this.fillColor = options.fillColor || '#FFFFFF';
    this.strokeColor = options.strokeColor || '#A580E8';
    this.strokeWidth = options.strokeWidth || 3;
    this.hasBg = options.hasBg !== undefined ? options.hasBg : true;
    this.cornerRadius = options.cornerRadius || 8;

    this.pinNumber = options.pinNumber || 1;

    this.endX = options.endX || this.x + 120;
    this.endY = options.endY || this.y + 80;
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    if (this.rotation !== 0 && this.type !== 'arrow') {
      ctx.rotate((this.rotation * Math.PI) / 180);
    }

    switch (this.type) {
      case 'title':
      case 'text':
      case 'caption':
        this.renderText(ctx);
        break;
      case 'pin':
        this.renderPin(ctx);
        break;
      case 'arrow':
        this.renderArrow(ctx);
        break;
      case 'rect':
        this.renderRect(ctx);
        break;
      case 'circle':
        this.renderCircle(ctx);
        break;
      case 'callout':
        this.renderCallout(ctx);
        break;
    }

    ctx.restore();
  }

  renderText(ctx) {
    ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.textAlign = this.textAlign;
    ctx.textBaseline = 'middle';

    const paddingX = 14;
    const paddingY = 8;
    const textMetrics = ctx.measureText(this.text);
    const textWidth = textMetrics.width;
    const boxW = Math.max(this.width, textWidth + paddingX * 2);
    const boxH = Math.max(this.height, this.fontSize + paddingY * 2);

    if (this.hasBg) {
      ctx.fillStyle = this.fillColor;
      ctx.beginPath();
      roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, this.cornerRadius);
      ctx.fill();

      if (this.strokeWidth > 0 && this.strokeColor) {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
      }
    }

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
  }

  renderPin(ctx) {
    const radius = Math.max(16, this.fontSize * 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.strokeColor || '#A580E8';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius - 3, 0, Math.PI * 2);
    ctx.fillStyle = this.fillColor || '#FFFFFF';
    ctx.fill();

    ctx.fillStyle = this.color || '#2D3142';
    ctx.font = `800 ${radius * 1.1}px 'JetBrains Mono', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.pinNumber), 0, 1);
  }

  renderArrow(ctx) {
    const dx = this.endX - this.x;
    const dy = this.endY - this.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);
    const headLen = Math.max(14, this.strokeWidth * 3.5);

    ctx.rotate(angle);
    ctx.strokeStyle = this.strokeColor || '#A580E8';
    ctx.lineWidth = this.strokeWidth || 4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();

    ctx.fillStyle = this.strokeColor || '#A580E8';
    ctx.beginPath();
    ctx.moveTo(length, 0);
    ctx.lineTo(length - headLen, -headLen * 0.55);
    ctx.lineTo(length - headLen * 0.7, 0);
    ctx.lineTo(length - headLen, headLen * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  renderRect(ctx) {
    const w = this.width;
    const h = this.height;
    ctx.beginPath();
    roundRect(ctx, -w / 2, -h / 2, w, h, this.cornerRadius);
    if (this.hasBg && this.fillColor) {
      ctx.fillStyle = this.fillColor;
      ctx.fill();
    }
    const stroke = this.strokeColor || this.color;
    const sw = this.strokeWidth !== undefined ? this.strokeWidth : 3;
    if (sw > 0 && stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = sw;
      ctx.stroke();
    }
  }

  renderCircle(ctx) {
    const rx = this.width / 2;
    const ry = this.height / 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    if (this.hasBg && this.fillColor) {
      ctx.fillStyle = this.fillColor;
      ctx.fill();
    }
    const stroke = this.strokeColor || this.color;
    const sw = this.strokeWidth !== undefined ? this.strokeWidth : 3;
    if (sw > 0 && stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = sw;
      ctx.stroke();
    }
  }

  renderCallout(ctx) {
    const w = this.width;
    const h = this.height;
    const tailW = 16;
    const tailH = 14;

    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10, -h / 2);
    ctx.lineTo(w / 2 - 10, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 10);
    ctx.lineTo(w / 2, h / 2 - 10);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 10, h / 2);
    ctx.lineTo(tailW / 2, h / 2);
    ctx.lineTo(0, h / 2 + tailH);
    ctx.lineTo(-tailW / 2, h / 2);
    ctx.lineTo(-w / 2 + 10, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 10);
    ctx.lineTo(-w / 2, -h / 2 + 10);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 10, -h / 2);
    ctx.closePath();

    if (this.hasBg) {
      ctx.fillStyle = this.fillColor || '#FFFFFF';
      ctx.fill();
    }
    if (this.strokeWidth > 0) {
      ctx.strokeStyle = this.strokeColor || '#A580E8';
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }

    ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
  }

  containsPoint(px, py) {
    if (!this.visible) return false;
    let dx = px - this.x;
    let dy = py - this.y;

    if (this.rotation !== 0 && this.type !== 'arrow') {
      const rad = (-this.rotation * Math.PI) / 180;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      dx = rx;
      dy = ry;
    }

    if (this.type === 'pin') {
      const radius = Math.max(16, this.fontSize * 0.9);
      return Math.sqrt(dx * dx + dy * dy) <= radius + 5;
    }

    if (this.type === 'arrow') {
      const lineLen = Math.sqrt((this.endX - this.x) ** 2 + (this.endY - this.y) ** 2);
      if (lineLen === 0) return false;
      const t = Math.max(0, Math.min(1, ((px - this.x) * (this.endX - this.x) + (py - this.y) * (this.endY - this.y)) / (lineLen * lineLen)));
      const projX = this.x + t * (this.endX - this.x);
      const projY = this.y + t * (this.endY - this.y);
      const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
      return dist <= 12;
    }

    const halfW = this.width / 2 + 8;
    const halfH = this.height / 2 + 8;
    return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
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
