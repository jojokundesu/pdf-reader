import { foldGeometry, clampPoint, pathPolygon } from "./geometry";
export class PageCurl {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.running = false;
    this.frame = 0;
    this.drawFrame = 0;
  }
  begin(current, next, anchorY, reverse = false) {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.drawFrame);
    this.drawFrame = 0;
    this.current = current;
    this.next = next;
    this.w = current.width;
    this.h = current.height;
    this.canvas.width = this.w * 2;
    this.canvas.height = this.h;
    this.canvas.style.display = "block";
    this.reverse = !!reverse;
    // The sheet is anchored at the outer edge it lifts from: the right edge
    // for a forward fold, the left edge for a backward fold.
    this.c = { x: this.reverse ? 0 : this.w, y: anchorY };
    this.p = { x: this.reverse ? 0.5 : this.w - 0.5, y: anchorY };
    this.running = true;
    this.draw();
  }
  move(p) {
    this.p = clampPoint(p, this.w, this.h, this.c.y, this.reverse);
    if (!this.drawFrame)
      this.drawFrame = requestAnimationFrame(() => {
        this.drawFrame = 0;
        if (this.running) this.draw();
      });
  }
  cancel() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.drawFrame);
    this.drawFrame = 0;
    this.running = false;
    this.canvas.style.display = "none";
    this.current = null;
    this.next = null;
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
  draw() {
    const ctx = this.ctx,
      w = this.w,
      h = this.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w * 2, h);
    ctx.save();
    // Both fold directions are drawn over the book surface; only the fold
    // geometry differs, so the revealed page is never mirrored.
    ctx.translate(w, 0);
    const drawPage = (source) => ctx.drawImage(source, 0, 0, w, h);
    const f = foldGeometry(w, h, this.c, this.p);
    ctx.save();
    pathPolygon(ctx, f.unpeeled);
    ctx.clip();
    drawPage(this.current);
    ctx.restore();
    ctx.save();
    pathPolygon(ctx, f.peeled);
    ctx.clip();
    drawPage(this.next);
    let sw = Math.max(1, f.len * 0.25);
    let grad = ctx.createLinearGradient(
      f.mid.x,
      f.mid.y,
      f.mid.x + f.n.x * sw,
      f.mid.y + f.n.y * sw,
    );
    grad.addColorStop(0, "rgba(0,0,0,.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.save();
    pathPolygon(ctx, f.reflected);
    ctx.shadowColor = "rgba(0,0,0,.33)";
    ctx.shadowBlur = w * 0.025;
    ctx.shadowOffsetX = (this.reverse ? w : -w) * 0.012;
    ctx.fillStyle = "#fdfbf7";
    ctx.fill();
    ctx.restore();
    ctx.save();
    pathPolygon(ctx, f.reflected);
    ctx.clip();
    ctx.fillStyle = "#fdfbf7";
    ctx.fillRect(-w, -h, w * 3, h * 3);
    ctx.save();
    ctx.transform(...f.matrix);
    // The back of the lifted sheet is opaque paper: no ghost of the page
    // underneath may bleed through while the fold is in motion.
    ctx.globalAlpha = 1;
    drawPage(this.current);
    ctx.restore();
    const width = Math.max(1, f.len * 0.5);
    grad = ctx.createLinearGradient(
      f.mid.x,
      f.mid.y,
      f.mid.x - f.n.x * width,
      f.mid.y - f.n.y * width,
    );
    [
      [0, "rgba(0,0,0,.28)"],
      [0.12, "rgba(255,255,255,.65)"],
      [0.55, "rgba(255,255,255,0)"],
      [1, "rgba(0,0,0,.12)"],
    ].forEach(([p, c]) => grad.addColorStop(p, c));
    ctx.fillStyle = grad;
    ctx.fillRect(-w, -h, w * 3, h * 3);
    ctx.restore();
    ctx.restore();
  }
  release(complete, onfinish) {
    cancelAnimationFrame(this.drawFrame);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.cancel();
      onfinish(complete);
      return;
    }
    this.drawFrame = 0;
    const dest = {
      x: complete
        ? this.reverse
          ? this.w * 2
          : -this.w
        : this.reverse
          ? 0
          : this.w,
      y: this.c.y,
    };
    let vx = 0,
      vy = 0,
      last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const k = 150,
        d = 2 * Math.sqrt(k);
      vx += (k * (dest.x - this.p.x) - d * vx) * dt;
      vy += (k * (dest.y - this.p.y) - d * vy) * dt;
      this.p.x += vx * dt;
      this.p.y += vy * dt;
      this.draw();
      if (
        Math.hypot(dest.x - this.p.x, dest.y - this.p.y) < 0.8 &&
        Math.abs(vx) < 4
      ) {
        this.cancel();
        onfinish(complete);
      } else this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
