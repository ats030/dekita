/** Completed rounds or pairs, independent of score and correctness. */
export function renderProgress(element, completed, total) {
  if (!element) return;
  const count = Math.max(0, Math.min(total, completed));
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', 'あそびの すすみぐあい');
  element.setAttribute('aria-valuemin', '0');
  element.setAttribute('aria-valuemax', String(total));
  element.setAttribute('aria-valuenow', String(count));
  element.setAttribute('aria-valuetext', `${total}このうち ${count}こ おわったよ`);
  const dots = Array.from({ length: total }, (_, index) => {
    const dot = document.createElement('span');
    dot.className = index < count ? 'progress-dot complete' : 'progress-dot';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  });
  element.replaceChildren(...dots);
}
