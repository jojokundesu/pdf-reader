export function clipPolygon(poly, mid, normal, positive = false) {
  const out = [];
  const sign = positive ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = ((a.x - mid.x) * normal.x + (a.y - mid.y) * normal.y) * sign,
      db = ((b.x - mid.x) * normal.x + (b.y - mid.y) * normal.y) * sign;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}
export function foldGeometry(w, h, c, p) {
  const mid = { x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 };
  const len = Math.max(0.001, Math.hypot(c.x - p.x, c.y - p.y));
  const n = { x: (c.x - p.x) / len, y: (c.y - p.y) / len };
  const rect = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const peeled = clipPolygon(rect, mid, n, true),
    unpeeled = clipPolygon(rect, mid, n);
  const a = 1 - 2 * n.x * n.x,
    b = -2 * n.x * n.y,
    d = 1 - 2 * n.y * n.y,
    tx = 2 * (mid.x * n.x + mid.y * n.y) * n.x,
    ty = 2 * (mid.x * n.x + mid.y * n.y) * n.y;
  const matrix = [a, b, b, d, tx, ty];
  const reflected = peeled.map((q) => ({
    x: a * q.x + b * q.y + tx,
    y: b * q.x + d * q.y + ty,
  }));
  return { mid, n, len, peeled, unpeeled, reflected, matrix };
}
export function clampPoint(p, w, h, anchorY, reverse = false) {
  // The anchor's distances to each spine endpoint define the unstretched sheet.
  const q = { ...p };
  const edge = reverse ? w : 0;
  const circles = [
    { x: edge, y: 0, r: Math.hypot(w, anchorY) },
    { x: edge, y: h, r: Math.hypot(w, h - anchorY) },
  ];
  for (let k = 0; k < 4; k++)
    for (const c of circles) {
      const dx = q.x - c.x,
        dy = q.y - c.y,
        d = Math.hypot(dx, dy);
      if (d > c.r) {
        q.x = c.x + (dx * c.r) / d;
        q.y = c.y + (dy * c.r) / d;
      }
    }
  return q;
}
export function pathPolygon(ctx, poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
