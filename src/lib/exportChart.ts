/**
 * Export a chart container (with SVG inside) as a PNG image.
 */
export function exportChartAsPNG(containerEl: HTMLElement | null, filename: string) {
  if (!containerEl) return;

  const svgEl = containerEl.querySelector('svg');
  if (!svgEl) return;

  const svgClone = svgEl.cloneNode(true) as SVGElement;
  // Ensure proper sizing
  const { width, height } = svgEl.getBoundingClientRect();
  svgClone.setAttribute('width', String(width));
  svgClone.setAttribute('height', String(height));
  // Add white background
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', '#1a1a2e');
  svgClone.insertBefore(bgRect, svgClone.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2; // retina quality
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  };
  img.src = url;
}

/**
 * Capture a chart container SVG as a base64 PNG data URL.
 */
export function chartToBase64(containerEl: HTMLElement | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!containerEl) return resolve(null);
    const svgEl = containerEl.querySelector('svg');
    if (!svgEl) return resolve(null);

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    const { width, height } = svgEl.getBoundingClientRect();
    svgClone.setAttribute('width', String(width));
    svgClone.setAttribute('height', String(height));
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#ffffff');
    svgClone.insertBefore(bgRect, svgClone.firstChild);

    // Force dark text for print
    svgClone.querySelectorAll('text').forEach(t => {
      if (!t.getAttribute('fill') || t.getAttribute('fill')?.includes('var(')) {
        t.setAttribute('fill', '#1a202c');
      }
    });

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
