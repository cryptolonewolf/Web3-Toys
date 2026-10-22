// Draws the square share card on a canvas.

const SIZE = 1080;
const INK = '#16131f';
const FONT = "'Space Grotesk', system-ui, sans-serif";

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function box(ctx, x, y, w, h, fill, r = 28) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// data: { score, rank, price, trust, runway, mistake, site, byline }
export async function drawShareCard(canvas, data) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  if (document.fonts) {
    try {
      await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`)]);
    } catch {
      // Fall back to the system font.
    }
  }
  const ctx = canvas.getContext('2d');
  const pad = 70;

  // Background with dots
  ctx.fillStyle = '#fff4dc';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(22,19,31,0.08)';
  for (let x = 18; x < SIZE; x += 36) for (let y = 18; y < SIZE; y += 36) ctx.fillRect(x, y, 3, 3);

  // Title
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.font = `700 64px ${FONT}`;
  let y = pad;
  for (const line of wrap(ctx, 'I launched a token. Here is what happened.', SIZE - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 74;
  }

  // Rank and score
  y += 20;
  box(ctx, pad, y, SIZE - pad * 2, 230, '#c6f432');
  ctx.fillStyle = INK;
  ctx.font = `700 150px ${FONT}`;
  ctx.fillText(String(data.score), pad + 40, y + 36);
  const scoreWidth = ctx.measureText(String(data.score)).width;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('out of 100', pad + 40 + scoreWidth + 24, y + 60);
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(data.rank, pad + 40 + scoreWidth + 24, y + 110);
  y += 230 + 44;

  // Three stats
  const stats = [
    ['Price day 7', data.price],
    ['Trust', data.trust],
    ['Runway', data.runway],
  ];
  const gap = 28;
  const w = (SIZE - pad * 2 - gap * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = pad + i * (w + gap);
    box(ctx, x, y, w, 150, '#ffffff', 22);
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(label, x + 24, y + 22);
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(String(value), x + 24, y + 62);
  });
  y += 150 + 50;

  // Biggest mistake
  ctx.fillStyle = INK;
  ctx.font = `500 38px ${FONT}`;
  const mistake = data.mistake
    ? `My biggest mistake was ${data.mistake}.`
    : 'My biggest mistake was not worth naming.';
  for (const line of wrap(ctx, mistake, SIZE - pad * 2).slice(0, 3)) {
    ctx.fillText(line, pad, y);
    y += 48;
  }

  // Call to action and footer
  box(ctx, pad, SIZE - pad - 190, SIZE - pad * 2, 100, '#ff4fa3', 22);
  ctx.fillStyle = INK;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(`Can you do better? ${data.site}`, pad + 32, SIZE - pad - 164);
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(`by ${data.byline}`, pad, SIZE - pad - 40);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
