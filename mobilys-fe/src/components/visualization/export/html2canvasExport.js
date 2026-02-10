import html2canvas from "html2canvas";

function waitNextPaint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

async function withExpandedScrollSize(element, fn) {
  const prev = {
    width: element.style.width,
    height: element.style.height,
    maxWidth: element.style.maxWidth,
    maxHeight: element.style.maxHeight,
  };

  element.style.width = `${element.scrollWidth}px`;
  element.style.height = `${element.scrollHeight}px`;
  element.style.maxWidth = "none";
  element.style.maxHeight = "none";

  try {
    await waitNextPaint();
    return await fn();
  } finally {
    element.style.width = prev.width;
    element.style.height = prev.height;
    element.style.maxWidth = prev.maxWidth;
    element.style.maxHeight = prev.maxHeight;
  }
}

async function downloadCanvasAsPng(canvas, filename) {
  await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Blob creation failed"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png", 1);
  });
}

/**
 * Download an element as PNG using html2canvas.
 *
 * Notes:
 * - `expandToScroll` is useful for chart containers that scroll horizontally.
 * - Defaults to removing nodes with `[data-html2canvas-ignore]` during clone.
 */
export async function downloadElementAsPng({
  element,
  filename,
  backgroundColor = "#ffffff",
  scale = 2,
  useCORS = true,
  expandToScroll = true,
  removeIgnored = true,
  onClone,
}) {
  if (!element) throw new Error("export element not found");
  if (!filename) throw new Error("filename is required");

  const capture = async () => {
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale,
      width: element.scrollWidth,
      height: element.scrollHeight,
      useCORS,
      onclone: (doc) => {
        if (removeIgnored) {
          doc
            .querySelectorAll("[data-html2canvas-ignore]")
            .forEach((el) => el.remove());
        }
        onClone?.(doc);
      },
    });
    await downloadCanvasAsPng(canvas, filename);
  };

  if (expandToScroll) {
    await withExpandedScrollSize(element, capture);
  } else {
    await waitNextPaint();
    await capture();
  }
}

