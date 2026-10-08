// Optional AI explanation of a future forecast, written by Google Gemini.
//
// The key stays on the server (web/server/.env), never in the browser.
// Gemini only rewrites the model's own numbers (forecast, SHAP values,
// test MAPE) into plain language. It is told not to add causes or
// numbers of its own. If the key is missing or Gemini fails, the
// dashboard keeps showing the built-in SHAP summary.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env reader (KEY=VALUE per line), so no extra package is needed.
// Values already set in the environment win.
export function loadEnv(file = path.join(__dirname, ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// Tried in order when GEMINI_MODEL is not available to this key
// (Google retires older models for new accounts).
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
];
let workingModel = null; // remembered after the first successful call

export function geminiConfig() {
  return {
    key: process.env.GEMINI_API_KEY || "",
    model: workingModel || process.env.GEMINI_MODEL || FALLBACK_MODELS[0],
  };
}

async function generate(model, key, prompt, temperature, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        // 2.5 Flash "thinks" by default; turn it off so the reply is fast.
        ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status} (${model}): ${body?.error?.message || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  const text = (body.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) throw new Error(`Gemini (${model}) returned no text`);
  return text;
}

export async function callGemini(prompt, { temperature = 0.3, maxTokens = 2048 } = {}) {
  const { key } = geminiConfig();
  if (!key) throw new Error("GEMINI_API_KEY is not set in web/server/.env");
  const first = workingModel || process.env.GEMINI_MODEL;
  const candidates = [...new Set([first, ...FALLBACK_MODELS].filter(Boolean))];
  let lastError;
  for (const model of candidates) {
    try {
      const text = await generate(model, key, prompt, temperature, maxTokens);
      workingModel = model;
      return { text, model };
    } catch (e) {
      lastError = e;
      // Only move on when the model itself is unavailable; a bad key or
      // quota error would fail the same way on every model.
      if (![400, 404].includes(e.status) || /api key/i.test(e.message)) throw e;
    }
  }
  throw lastError;
}

function monthYear(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Facts only, so every sentence Gemini writes can be checked against them.
export function buildExplainPrompt(series, row, lang) {
  const reasons = row.reasons
    .map((r) => {
      const now =
        r.currentValue != null
          ? `, latest reading ${Number(r.currentValue).toFixed(r.decimals ?? 2)}${r.unit ? " " + r.unit : ""}`
          : "";
      return `- ${r.label}: ${r.effect > 0 ? "pushes the forecast UP" : "pulls the forecast DOWN"} by PHP ${Math.abs(
        r.effect
      ).toFixed(2)}/kg${now}`;
    })
    .join("\n");

  const language =
    lang === "tl"
      ? "Write in natural Taglish (Filipino mixed with English, the way Filipinos talk casually)."
      : "Write in simple English.";

  return `You explain a rice price forecast from a thesis model (P-RICE, XGBoost) to ordinary Filipino consumers.

FACTS (use only these; do not add any other numbers, events, or causes):
- Rice type: ${series} rice (Philippines, retail)
- Latest actual price: PHP ${row.basePrice.toFixed(2)}/kg in ${monthYear(row.originDate)}
- Forecast: PHP ${row.forecast.toFixed(2)}/kg for ${monthYear(row.targetDate)} (${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(2)}%)
- Confidence: ${row.confidence.label}${row.confidence.mape != null ? ` (average error on past test data: ${row.confidence.mape.toFixed(1)}%)` : ""}
- What moved the forecast (SHAP values, PHP/kg):
${reasons || "- (no single factor had a notable effect)"}

RULES:
- ${language}
- 3 to 4 short sentences, one paragraph, no bullet points, no headings, no markdown.
- Say the forecast price and month, then the main reasons in everyday words.
- "Price history" means the recent movement of the rice price itself.
- Do not claim certainty. Do not give buying advice. Do not mention SHAP or XGBoost by name.
- If a factor's effect is small (under PHP 0.10/kg), you may skip it.`;
}
