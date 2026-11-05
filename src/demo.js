import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export async function makeDemo() {
  const doc = await PDFDocument.create(),
    serif = await doc.embedFont(StandardFonts.TimesRoman),
    italic = await doc.embedFont(StandardFonts.TimesRomanItalic),
    sans = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.13, 0.24, 0.2),
    muted = rgb(0.4, 0.45, 0.38),
    paper = rgb(0.97, 0.96, 0.91);
  const chapters = [
    "The art of paying attention",
    "A quieter kind of progress",
    "Begin where you are",
    "The space between things",
    "Small rituals, deep roots",
    "A field guide to slowing down",
    "The power of a single page",
    "Make room for wonder",
    "Notes from the everyday",
    "A practice, not a destination",
    "Carry the quiet with you",
    "Your next chapter",
  ];
  for (let i = 0; i < 12; i++) {
    const p = doc.addPage([560, 760]);
    p.drawRectangle({ x: 0, y: 0, width: 560, height: 760, color: paper });
    p.drawText("FIELDNOTES     /     THE MINDFUL COLLECTION", {
      x: 55,
      y: 706,
      size: 9,
      font: sans,
      color: muted,
    });
    p.drawLine({
      start: { x: 55, y: 690 },
      end: { x: 505, y: 690 },
      thickness: 0.5,
      color: muted,
    });
    if (i === 0) {
      p.drawText("A LITTLE MORE PRESENT", {
        x: 55,
        y: 620,
        size: 10,
        font: sans,
        color: muted,
      });
      p.drawText("The art of", {
        x: 55,
        y: 554,
        size: 53,
        font: serif,
        color: ink,
      });
      p.drawText("paying attention.", {
        x: 55,
        y: 496,
        size: 47,
        font: italic,
        color: ink,
      });
      p.drawText("Small observations. A slower life.", {
        x: 58,
        y: 454,
        size: 13,
        font: sans,
        color: muted,
      });
      // Procedural botanical engraving; all artwork remains crisp at any zoom.
      for (let branch = 0; branch < 7; branch++) {
        const sx = 280 + (branch - 3) * 8,
          sy = 120,
          ex = 100 + branch * 56,
          ey = 230 + (3 - Math.abs(branch - 3)) * 33;
        p.drawLine({
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          thickness: 1.1,
          color: muted,
        });
        for (let j = 1; j < 6; j++) {
          const t = j / 6,
            x = sx + (ex - sx) * t,
            y = sy + (ey - sy) * t;
          p.drawEllipse({
            x: x + (j % 2 ? 12 : -12),
            y: y + 5,
            xScale: 17,
            yScale: 5,
            rotate: { type: "degrees", angle: j % 2 ? 40 : -30 },
            color: rgb(0.36 + branch * 0.018, 0.45 + branch * 0.014, 0.31),
            opacity: 0.75,
          });
        }
      }
      p.drawText("ESSAYS & OBSERVATIONS", {
        x: 55,
        y: 78,
        size: 9,
        font: sans,
        color: muted,
      });
      p.drawText("VOL. 01", {
        x: 460,
        y: 78,
        size: 9,
        font: sans,
        color: muted,
      });
    } else {
      p.drawText(String(i).padStart(2, "0") + "   /   A MOMENT TO READ", {
        x: 55,
        y: 640,
        size: 10,
        font: sans,
        color: muted,
      });
      let title = chapters[i];
      let words = title.split(" "),
        line = "",
        y = 585;
      for (const word of words) {
        if (serif.widthOfTextAtSize(line + word, 34) > 450) {
          p.drawText(line, { x: 55, y, size: 34, font: serif, color: ink });
          y -= 42;
          line = "";
        }
        line += word + " ";
      }
      p.drawText(line, { x: 55, y, size: 34, font: serif, color: ink });
      y -= 60;
      const paras = [
        "There is a particular kind of beauty that only appears when we stop looking for something else. It lives in the ordinary: a cup of tea cooling beside an open book, the soft geometry of afternoon light, a familiar path made new by the changing season.",
        "Attention is not a resource to spend as quickly as possible. It is a way of being here. When we give a small thing our full attention, the world becomes a little larger, and the noise becomes a little less important.",
        "Try this today: choose one simple thing and notice it completely. Read a single page without rushing to the next. Watch the shadows move. Listen to the space after a sentence. There is no finish line. There is only this moment, and the next invitation to return.",
      ];
      for (const para of paras) {
        line = "";
        for (const word of para.split(" ")) {
          if (serif.widthOfTextAtSize(line + word, 14) > 445) {
            p.drawText(line, { x: 55, y, size: 14, font: serif, color: ink });
            y -= 22;
            line = "";
          }
          line += word + " ";
        }
        p.drawText(line, { x: 55, y, size: 14, font: serif, color: ink });
        y -= 40;
      }
      p.drawLine({
        start: { x: 55, y: 119 },
        end: { x: 95, y: 119 },
        thickness: 1,
        color: muted,
      });
      p.drawText('"What you pay attention to becomes your life."', {
        x: 55,
        y: 92,
        size: 13,
        font: italic,
        color: muted,
      });
    }
    p.drawText("FIELDNOTES", {
      x: 55,
      y: 32,
      size: 8,
      font: sans,
      color: muted,
    });
    p.drawText(String(i + 1).padStart(2, "0"), {
      x: 489,
      y: 32,
      size: 9,
      font: sans,
      color: muted,
    });
  }
  doc.setTitle("The art of paying attention");
  doc.setAuthor("FlipVault Editions");
  return doc.save();
}
