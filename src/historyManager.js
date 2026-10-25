import { AnnotationItem } from './annotationEngine.js';

export class HistoryManager {
  constructor(engine, onStateChange, onApply) {
    this.engine = engine;
    this.onStateChange = onStateChange;
    this.onApply = onApply;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 40;
    this.isApplying = false;
  }

  captureSnapshot() {
    return {
      activePhotoIndex: this.engine.activePhotoIndex,
      activeAnnotationIndex: this.engine.activeAnnotationIndex,
      layout: this.engine.layout,
      spacing: this.engine.spacing,
      padding: this.engine.padding,
      cornerRadius: this.engine.cornerRadius,
      bgColor: this.engine.bgColor,
      transparentBg: this.engine.transparentBg,
      photos: this.engine.photos.map(p => ({
        adjustments: JSON.parse(JSON.stringify(p.adjustments)),
        opacity: p.opacity,
        visible: p.visible,
        freeformBounds: p.freeformBounds ? { ...p.freeformBounds } : null,
        retouchStrokes: JSON.parse(JSON.stringify(p.retouchStrokes || []))
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
        fontSize: a.fontSize,
        fontFamily: a.fontFamily,
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
  }

  recordChange() {
    if (this.isApplying) return;
    const snapshot = this.captureSnapshot();
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return;
    this.isApplying = true;

    const current = this.captureSnapshot();
    this.redoStack.push(current);

    const prev = this.undoStack.pop();
    this.applySnapshot(prev);

    this.isApplying = false;
    this.notify();
    if (this.onApply) this.onApply(prev);
  }

  redo() {
    if (!this.canRedo()) return;
    this.isApplying = true;

    const current = this.captureSnapshot();
    this.undoStack.push(current);

    const next = this.redoStack.pop();
    this.applySnapshot(next);

    this.isApplying = false;
    this.notify();
    if (this.onApply) this.onApply(next);
  }

  applySnapshot(snapshot) {
    if (!snapshot) return;

    this.engine.layout = snapshot.layout;
    this.engine.spacing = snapshot.spacing;
    this.engine.padding = snapshot.padding;
    this.engine.cornerRadius = snapshot.cornerRadius;
    this.engine.bgColor = snapshot.bgColor;
    this.engine.transparentBg = snapshot.transparentBg;

    snapshot.photos.forEach((sp, idx) => {
      if (this.engine.photos[idx]) {
        const photo = this.engine.photos[idx];
        photo.adjustments = JSON.parse(JSON.stringify(sp.adjustments));
        photo.opacity = sp.opacity;
        photo.visible = sp.visible;
        photo.freeformBounds = sp.freeformBounds ? { ...sp.freeformBounds } : null;
        photo.retouchStrokes = JSON.parse(JSON.stringify(sp.retouchStrokes || []));
        photo.needsProcessing = true;
      }
    });

    if (snapshot.annotations) {
      this.engine.annotations = snapshot.annotations.map(a => new AnnotationItem(a));
      this.engine.activeAnnotationIndex = snapshot.activeAnnotationIndex !== undefined
        ? Math.min(snapshot.activeAnnotationIndex, this.engine.annotations.length - 1)
        : -1;
    }

    this.engine.activePhotoIndex = Math.min(snapshot.activePhotoIndex, this.engine.photos.length - 1);
    this.engine.render();
  }

  notify() {
    if (this.onStateChange) {
      this.onStateChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
  }
}
