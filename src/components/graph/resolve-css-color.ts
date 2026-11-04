// Cytoscape only understands plain colors, but tokens.css mixes colors with color-mix().
// The browser resolves any CSS color value; drawing it on a canvas pixel returns plain #rrggbb.

let samplingContext: CanvasRenderingContext2D | null = null;

function getSamplingContext(): CanvasRenderingContext2D {
  if (samplingContext === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D is not available to resolve colors");
    samplingContext = context;
  }
  return samplingContext;
}

export function resolveCssColor(cssColor: string): string {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  probe.hidden = true;
  document.body.appendChild(probe);
  const computedColor = getComputedStyle(probe).color;
  probe.remove();

  const context = getSamplingContext();
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = computedColor;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return "#" + [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("");
}
