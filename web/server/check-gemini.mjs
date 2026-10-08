// Quick check that the Gemini key in web/server/.env works.
//   cd web/server
//   npm run check:gemini
import { loadEnv, geminiConfig, callGemini } from "./gemini.mjs";

loadEnv();
const { key, model } = geminiConfig();
if (!key) {
  console.error("No GEMINI_API_KEY in web/server/.env. Copy .env.example to .env and paste the key.");
  process.exit(1);
}
console.log(`Key found (${key.slice(0, 6)}...), model: ${model}`);

try {
  const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": key },
  });
  const body = await list.json();
  if (!list.ok) throw new Error(`${list.status}: ${body?.error?.message}`);
  const names = (body.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && m.name.includes("gemini"))
    .map((m) => m.name.replace("models/", ""));
  console.log(`Models this key can use (${names.length}): ${names.slice(0, 15).join(", ")}`);
  if (names.length && !names.includes(model)) {
    console.warn(`"${model}" is not in the list. Set GEMINI_MODEL in .env to one of the names above.`);
  }
} catch (e) {
  console.warn("Could not list models:", e.message);
}

try {
  const out = await callGemini("Reply with one short sentence: the Gemini key for P-RICE works.");
  console.log("Test reply:", out.text);
  console.log("OK: Gemini explanations will work. Restart the server (npm start).");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
}
