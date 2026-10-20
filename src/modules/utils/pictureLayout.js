// Pack equal squares with a gap. Bounded retries keep crowded questions fast;
// shuffled, jittered cells provide a guaranteed non-overlapping fallback.
export function createPictureLayout(count, width, height, preferredSize, random = Math.random) {
  const gap = 8;
  let best = { size: 0, columns: 1, rows: count };
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const size = Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows);
    if (size > best.size) best = { size, columns, rows };
  }
  const size = Math.max(0, Math.min(preferredSize, best.size * .85));
  if (!size) return { size, positions: [] };
  for (let attempt = 0; attempt < 8; attempt++) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let candidate = 0; candidate < 120; candidate++) {
        const point = { x: random() * (width - size), y: random() * (height - size) };
        if (positions.every(other => Math.abs(point.x - other.x) >= size + gap || Math.abs(point.y - other.y) >= size + gap)) {
          positions.push(point);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
    if (positions.length === count) return { size, positions };
  }
  const cellWidth = width / best.columns;
  const cellHeight = height / best.rows;
  const slots = Array.from({ length: best.columns * best.rows }, (_, index) => index);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const positions = slots.slice(0, count).map(slot => ({
    x: (slot % best.columns) * cellWidth + gap / 2 + random() * (cellWidth - size - gap),
    y: Math.floor(slot / best.columns) * cellHeight + gap / 2 + random() * (cellHeight - size - gap),
  }));
  return { size, positions };
}
