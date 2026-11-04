/*
 * Reads src/styles/tokens.css, resolves every background x text preset the way the browser would
 * (attribute selectors, specificity, source order, var() and color-mix()), and checks WCAG 2.x
 * contrast. Exits with code 1 if any pair is below its threshold.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { contrastRatio as contrast, parseHexColor as hexToRgb } from "../src/accessibility/contrast.ts";

const tokensPath = join(dirname(fileURLToPath(import.meta.url)), "../src/styles/tokens.css");
const BACKGROUNDS = ["obsidian", "midnight", "nocturne", "parchment"];
const TEXTS = ["vellum", "ash", "bright"];
const ENTITY_TYPES = ["character", "location", "organization", "faction", "object", "ability", "species", "concept"];
const SURFACES = ["canvas", "surface", "raised"];
const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

/* ---------- CSS parsing ---------- */

function parseRules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(withoutComments)) !== null) {
    const declarations = {};
    for (const declaration of match[2].split(";")) {
      const separator = declaration.indexOf(":");
      if (separator === -1) continue;
      const name = declaration.slice(0, separator).trim();
      if (name.startsWith("--")) declarations[name] = declaration.slice(separator + 1).trim();
    }
    for (const selector of match[1].split(",")) {
      rules.push({ selector: selector.trim(), declarations, order: rules.length });
    }
  }
  return rules;
}

function parseSelector(selector) {
  const attributes = [...selector.matchAll(/\[(data-[a-z]+)="([^"]+)"\]/g)].map((m) => [m[1], m[2]]);
  const isRoot = selector.includes(":root");
  const remainder = selector.replace(/\[[^\]]+\]/g, "").replace(":root", "").trim();
  if (remainder !== "") return null;
  return { attributes, specificity: attributes.length + (isRoot ? 1 : 0) };
}

function resolveState(rules, background, text) {
  const state = { "data-bg": background, "data-text": text };
  const matching = [];
  for (const rule of rules) {
    const parsed = parseSelector(rule.selector);
    if (parsed === null) continue;
    if (parsed.attributes.every(([name, value]) => state[name] === value)) {
      matching.push({ ...rule, specificity: parsed.specificity });
    }
  }
  matching.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const variables = {};
  for (const rule of matching) Object.assign(variables, rule.declarations);
  return variables;
}

/* ---------- Color math ---------- */

const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function resolveColor(value, variables) {
  const trimmed = value.trim();
  const variable = trimmed.match(/^var\((--[a-z0-9-]+)\)$/);
  if (variable) return resolveColor(variables[variable[1]], variables);
  const mix = trimmed.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/);
  if (mix) {
    const first = hexToRgb(resolveColor(mix[1], variables));
    const second = hexToRgb(resolveColor(mix[3], variables));
    const share = Number(mix[2]) / 100;
    return rgbToHex(first.map((channel, i) => channel * share + second[i] * (1 - share)));
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  throw new Error(`Cannot resolve color value: ${value}`);
}

/* ---------- Checks ---------- */

const rules = parseRules(readFileSync(tokensPath, "utf8"));
const failures = [];
const format = (ratio) => ratio.toFixed(2).replace(".", ",");

function check(label, foregroundToken, backgroundTokens, threshold, variables, bucket) {
  const foreground = resolveColor(variables[foregroundToken], variables);
  const ratios = backgroundTokens.map((token) => contrast(foreground, resolveColor(variables[token], variables)));
  const worst = Math.min(...ratios);
  if (worst < threshold) failures.push(`${label}: ${format(worst)} < ${threshold}`);
  bucket.push(worst);
  return worst;
}

function printTable(title, header, rows) {
  console.log(`\n### ${title}\n`);
  console.log(`| ${header.join(" | ")} |`);
  console.log(`|${header.map(() => "---").join("|")}|`);
  for (const row of rows) console.log(`| ${row.join(" | ")} |`);
}

const states = {};
for (const background of BACKGROUNDS) {
  for (const text of TEXTS) states[`${background}/${text}`] = resolveState(rules, background, text);
}

printTable(
  "Body text (primary / muted), worst case across canvas, surface and raised. Threshold 4,5",
  ["Background", ...TEXTS],
  BACKGROUNDS.map((background) => [
    background,
    ...TEXTS.map((text) => {
      const variables = states[`${background}/${text}`];
      const primary = check(`${background}/${text} ink`, "--ink", SURFACES.map((s) => `--${s}`), AA_TEXT, variables, []);
      const muted = check(`${background}/${text} ink-muted`, "--ink-muted", SURFACES.map((s) => `--${s}`), AA_TEXT, variables, []);
      return `${format(primary)} / ${format(muted)}`;
    }),
  ]),
);

printTable(
  "Text on derived backgrounds (hover and selection). Threshold 4,5",
  ["Background", ...TEXTS],
  BACKGROUNDS.map((background) => [
    background,
    ...TEXTS.map((text) => {
      const variables = states[`${background}/${text}`];
      const onHover = check(`${background}/${text} ink on hover`, "--ink", ["--hover"], AA_TEXT, variables, []);
      const onSelection = check(`${background}/${text} ink on selection`, "--ink", ["--selection"], AA_TEXT, variables, []);
      const mutedOnHover = check(`${background}/${text} ink-muted on hover`, "--ink-muted", ["--hover"], AA_TEXT, variables, []);
      return `${format(onHover)} / ${format(onSelection)} / ${format(mutedOnHover)}`;
    }),
  ]),
);

printTable(
  "Accent and states, worst case across surfaces. Thresholds: accent 4,5, control borders 3, accent button text 4,5",
  ["Background", "accent on surfaces", "accent-hover on surfaces", "accent-ink on accent", "danger on surfaces", "line-control (min over text presets)"],
  BACKGROUNDS.map((background) => {
    const variables = states[`${background}/vellum`];
    const surfaces = SURFACES.map((s) => `--${s}`);
    const accent = check(`${background} accent`, "--accent", surfaces, AA_TEXT, variables, []);
    const hover = check(`${background} accent-hover`, "--accent-hover", surfaces, AA_TEXT, variables, []);
    const button = check(`${background} accent-ink`, "--accent-ink", ["--accent"], AA_TEXT, variables, []);
    const danger = check(`${background} danger`, "--danger", surfaces, AA_TEXT, variables, []);
    const controlRatios = TEXTS.map((text) =>
      check(`${background}/${text} line-control`, "--line-control", surfaces, AA_GRAPHIC, states[`${background}/${text}`], []),
    );
    return [background, format(accent), format(hover), format(button), format(danger), format(Math.min(...controlRatios))];
  }),
);

printTable(
  "Entity colors: on surfaces (graphic and text 4,5) / on own badge tint (text 4,5)",
  ["Type", ...BACKGROUNDS],
  ENTITY_TYPES.map((type) => [
    type,
    ...BACKGROUNDS.map((background) => {
      const worstOverall = [];
      for (const text of TEXTS) {
        const variables = states[`${background}/${text}`];
        const onSurfaces = check(`${background}/${text} entity-${type}`, `--entity-${type}`, SURFACES.map((s) => `--${s}`), AA_TEXT, variables, worstOverall);
        const onTint = check(`${background}/${text} entity-${type} on tint`, `--entity-${type}`, [`--entity-${type}-tint`], AA_TEXT, variables, worstOverall);
        void onSurfaces;
        void onTint;
      }
      return format(Math.min(...worstOverall));
    }),
  ]),
);

/* The adjacent-surface separation is decorative, so it is reported but not enforced. */
console.log("\n" + (failures.length === 0 ? "All contrast checks passed." : `FAILURES (${failures.length}):\n- ${failures.join("\n- ")}`));
process.exit(failures.length === 0 ? 0 : 1);
