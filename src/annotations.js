export class AnnotationEngine {
  constructor(canvas, onchange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onchange = onchange;
    this.items = [];
    this.undoStack = [];
    this.redoStack = [];
    this.active = null;
    this.histories = new Map();
    this.historyKey = null;
    this.buffer = document.createElement("canvas");
  }
  load(items = [], key = null) {
    if (this.historyKey)
      this.histories.set(this.historyKey, {
        undo: this.undoStack,
        redo: this.redoStack,
      });
    this.items = structuredClone(items);
    const h = this.histories.get(key);
    this.undoStack = h?.undo || [];
    this.redoStack = h?.redo || [];
    this.historyKey = key;
    this.active = null;
    this.render();
  }
  checkpoint() {
    this.undoStack.push(structuredClone(this.items));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(structuredClone(this.items));
    this.items = this.undoStack.pop();
    this.render();
    this.onchange(this.items);
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(structuredClone(this.items));
    this.items = this.redoStack.pop();
    this.render();
    this.onchange(this.items);
  }
  clear() {
    this.checkpoint();
    this.items = [];
    this.render();
    this.onchange(this.items);
  }
  start(p, tool, config) {
    this.checkpoint();
    this.active = {
      id: crypto.randomUUID(),
      tool,
      color: config.color,
      width: config.width,
      opacity: config.opacity,
      points: [p],
      straight: config.straight,
    };
    if (tool === "stroke") {
      this.eraseStroke(p, config.width);
      return;
    }
    this.render();
  }
  move(p) {
    if (!this.active) return;
    if (this.active.tool === "stroke") {
      this.eraseStroke(p, this.active.width);
      return;
    }
    this.active.points.push(p);
    this.render();
  }
  snap() {
    if (!this.active || this.active.tool !== "marker") return;
    this.active.straight = true;
    this.render();
  }
  finish() {
    if (!this.active) return;
    if (this.active.tool !== "stroke") this.items.push(this.active);
    this.active = null;
    this.render();
    this.onchange(this.items);
  }
  eraseStroke(p, width) {
    this.items = this.items.filter(
      (s) =>
        s.tool === "pixel" ||
        !s.points.some((a, i) => {
          const b = s.points[i + 1] || a,
            dx = b.x - a.x,
            dy = b.y - a.y,
            t = Math.max(
              0,
              Math.min(
                1,
                ((p.x - a.x) * dx + (p.y - a.y) * dy) /
                  (dx * dx + dy * dy || 1),
              ),
            );
          return (
            Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <
            (s.width + width) / 2
          );
        }),
    );
    this.render();
  }
  drawStroke(ctx, s) {
    let pts = s.points;
    if (!pts.length) return;
    if (s.straight) pts = [pts[0], { x: pts.at(-1).x, y: pts[0].y }];
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    else pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
  render(target = this.canvas) {
    const ctx = target.getContext("2d"),
      w = target.width,
      h = target.height;
    ctx.clearRect(0, 0, w, h);
    if (this.buffer.width !== w) this.buffer.width = w;
    if (this.buffer.height !== h) this.buffer.height = h;
    const b = this.buffer.getContext("2d");
    const sx = w / 1000,
      sy = h / this.logicalHeight;
    for (const s of [
      ...this.items,
      ...(this.active && this.active.tool !== "stroke" ? [this.active] : []),
    ]) {
      b.clearRect(0, 0, w, h);
      b.save();
      b.scale(sx, sy);
      this.drawStroke(b, s);
      b.restore();
      ctx.save();
      ctx.globalAlpha = s.tool === "pixel" ? 1 : s.opacity;
      ctx.globalCompositeOperation =
        s.tool === "pixel" ? "destination-out" : "source-over";
      ctx.drawImage(this.buffer, 0, 0);
      ctx.restore();
    }
  }
}
