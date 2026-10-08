// Google Gemini client for the optional AI features (forecast explainer
// and the P-RICE Assistant chatbot).
//
// The key stays on the server (web/server/.env), never in the browser.
// Gemini only rewrites or answers from the model's own numbers; the
// prompts tell it not to add numbers or causes of its own.

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

// Tried in order (after GEMINI_MODEL, if set). "Lite" models first: they
// answer in 1 to 3 seconds and are plenty for short, fact-based replies.
// Bigger Flash models are the fallback when the lite ones are busy.
const FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];
const BUSY = [429, 500, 503, 504];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let workingModel = null; // remembered after the first successful call

function candidateModels() {
  const first = workingModel || process.env.GEMINI_MODEL;
  return [...new Set([first, ...FALLBACK_MODELS].filter(Boolean))];
}

export function geminiConfig() {
  return {
    key: process.env.GEMINI_API_KEY || "",
    model: workingModel || process.env.GEMINI_MODEL || FALLBACK_MODELS[0],
  };
}

class GeminiError extends Error {
  constructor(message, status, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

async function generate(model, key, { system, contents, temperature, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature,
        // Newer models spend part of this budget "thinking", so keep it roomy;
        // the prompts themselves keep the visible answer short.
        maxOutputTokens: maxTokens,
        ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GeminiError(
      `Gemini ${res.status} (${model}): ${body?.error?.message || res.statusText}`,
      res.status,
      BUSY.includes(res.status)
    );
  }
  const cand = body.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (body.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") {
    throw new GeminiError("blocked", 200, false);
  }
  // A cut-off answer is worse than none: retry instead of showing half a sentence.
  if (cand?.finishReason === "MAX_TOKENS") throw new GeminiError(`truncated (${model})`, 200, true);
  if (!text) throw new GeminiError(`empty reply (${model})`, 200, true);
  return text;
}

/**
 * callGemini("prompt") or callGemini({ system, contents })
 * Returns { text, model }. Retries busy models, then falls back to others.
 */
export async function callGemini(input, { temperature = 0.3, maxTokens = 8192 } = {}) {
  const { key } = geminiConfig();
  if (!key) throw new Error("GEMINI_API_KEY is not set in web/server/.env");
  const req =
    typeof input === "string"
      ? { contents: [{ role: "user", parts: [{ text: input }] }] }
      : input;

  const candidates = candidateModels();
  const deadline = Date.now() + 45000;
  let lastError;
  for (const model of candidates) {
    if (Date.now() > deadline) break;
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now();
      try {
        const text = await generate(model, key, { ...req, temperature, maxTokens });
        workingModel = model;
        console.log(`Gemini ok: ${model} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        return { text, model };
      } catch (e) {
        lastError = e;
        console.warn(`Gemini skip: ${model} (${e.message.slice(0, 80)})`);
        if (/api key/i.test(e.message)) throw e; // a bad key fails on every model
        if (e.message === "blocked") throw e;
        // A cut-off or empty answer gets one more try; a busy model is skipped at once.
        if (e.retryable && e.status === 200 && attempt === 0) continue;
        break;
      }
    }
    if (workingModel === model) workingModel = null;
  }
  throw new Error(
    BUSY.includes(lastError?.status)
      ? "Gemini is busy right now. Please try again in a minute."
      : lastError?.message || "Gemini failed"
  );
}

/**
 * Streams a reply: yields text pieces as Gemini writes them.
 * Falls back to the next model only if a model fails before its first piece.
 */
export async function* streamGemini({ system, contents }, { temperature = 0.2, maxTokens = 4096 } = {}) {
  const { key } = geminiConfig();
  if (!key) throw new Error("GEMINI_API_KEY is not set in web/server/.env");
  let lastError;
  for (const model of candidateModels()) {
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
    } catch (e) {
      lastError = e;
      console.warn(`Gemini skip: ${model} (${e.message})`);
      continue;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      lastError = new GeminiError(`Gemini ${res.status} (${model}): ${body?.error?.message || ""}`, res.status);
      console.warn(`Gemini skip: ${model} (${res.status})`);
      if (/api key/i.test(lastError.message)) throw lastError;
      continue;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sent = 0;
    let finish = null;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let chunk;
          try {
            chunk = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          const cand = chunk.candidates?.[0];
          if (chunk.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") throw new Error("blocked");
          finish = cand?.finishReason || finish;
          const text = (cand?.content?.parts || [])
            .filter((p) => !p.thought)
            .map((p) => p.text || "")
            .join("");
          if (text) {
            if (sent === 0) console.log(`Gemini first words: ${model} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            sent += text.length;
            yield text;
          }
        }
      }
    } catch (e) {
      if (sent > 0 || e.message === "blocked") throw e; // can't switch models mid-answer
      lastError = e;
      continue;
    }
    if (sent === 0) {
      lastError = new Error(`empty reply (${model})`);
      continue;
    }
    workingModel = model;
    console.log(`Gemini done: ${model} in ${((Date.now() - t0) / 1000).toFixed(1)}s${finish === "MAX_TOKENS" ? " (cut off)" : ""}`);
    return;
  }
  throw new Error(
    BUSY.includes(lastError?.status)
      ? "Gemini is busy right now. Please try again in a minute."
      : lastError?.message || "Gemini failed"
  );
}

function monthYear(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const LANGUAGE_RULES = {
  en: "Write in simple, friendly English.",
  tl:
    "Write in natural Taglish: the casual mix of Filipino and English that Filipinos use every day. " +
    "Use Filipino sentence structure but keep everyday English terms as they are (forecast, price, " +
    "inflation, exchange rate, per kilo, percent). Avoid deep or formal Tagalog. " +
    'Example of the tone: "Inaasahang bababa nang kaunti ang presyo ng Local Special rice sa ₱59.67 kada kilo ngayong July 2026."',
};

// Facts only, so every sentence Gemini writes can be checked against them.
export function buildExplainPrompt(series, row, lang) {
  const reasons = row.reasons
    .map((r) => {
      const now =
        r.currentValue != null
          ? `, latest reading ${Number(r.currentValue).toFixed(r.decimals ?? 2)}${r.unit ? " " + r.unit : ""}`
          : "";
      return `- ${r.label}: ${r.effect > 0 ? "pushes the forecast UP" : "pulls the forecast DOWN"} by ₱${Math.abs(
        r.effect
      ).toFixed(2)}/kg${now}`;
    })
    .join("\n");

  return `You explain a rice price forecast from a thesis model (P-RICE) to ordinary Filipino consumers.

FACTS (use only these; do not add any other numbers, events, or causes):
- Rice type: ${series} rice (Philippines, retail)
- Latest actual price: ₱${row.basePrice.toFixed(2)}/kg in ${monthYear(row.originDate)}
- Forecast: ₱${row.forecast.toFixed(2)}/kg for ${monthYear(row.targetDate)} (${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(2)}%)
- Confidence: ${row.confidence.label}${row.confidence.mape != null ? ` (average error on past test data: ${row.confidence.mape.toFixed(1)}%)` : ""}
- What moved the forecast (₱/kg):
${reasons || "- (no single factor had a notable effect)"}

RULES:
- ${LANGUAGE_RULES[lang] || LANGUAGE_RULES.en}
- Exactly 3 short sentences in one paragraph. No bullet points, headings or markdown.
- Sentence 1: the forecast price, month and direction. Sentence 2: the main reasons in everyday words. Sentence 3: how sure the model is, without claiming certainty.
- Write prices as ₱59.67 (peso sign, two decimals).
- "Price history" means the recent movement of the rice price itself.
- Do not give buying advice. Do not mention SHAP, XGBoost, "the facts" or these rules.
- Finish every sentence.`;
}
