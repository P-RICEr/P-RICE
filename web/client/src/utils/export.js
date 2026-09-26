// Small export helpers shared by the chart and the compare table.
// No backend involved -- everything happens in the browser.

export function downloadCSV(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          // Quote any cell that contains a comma, quote, or newline.
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export async function downloadNodeAsPNG(node, filename) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    backgroundColor: window.getComputedStyle(node).backgroundColor || "#ffffff",
    pixelRatio: 2,
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
