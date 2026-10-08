const BASE = "/api";

async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Streams the assistant's answer. onText(fullTextSoFar) is called as words
// arrive; resolves with the final text.
async function chatStream(messages, context, onText = () => {}) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });
  const type = res.headers.get("Content-Type") || "";
  if (!type.includes("ndjson")) {
    // Short answers (refusals, errors) come back as plain JSON.
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
    onText(body.text);
    return body.text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.replace != null) text = msg.replace;
      if (msg.delta) text += msg.delta;
      onText(text);
    }
  }
  if (!text) throw new Error("No answer came back. Please try again.");
  return text;
}

export const api = {
  health: () => getJSON(`${BASE}/health`),
  meta: () => getJSON(`${BASE}/meta`),
  series: () => getJSON(`${BASE}/series`),
  forecast: (series, horizon) =>
    getJSON(`${BASE}/forecast?series=${encodeURIComponent(series)}&horizon=${horizon}`),
  modelInfo: (horizon) => getJSON(`${BASE}/model-info?horizon=${horizon}`),
  compare: (horizon) => getJSON(`${BASE}/compare?horizon=${horizon}`),
  future: (series) => getJSON(`${BASE}/future?series=${encodeURIComponent(series)}`),
  results: (freq) => getJSON(`${BASE}/results?freq=${freq}`),
  explainStatus: () => getJSON(`${BASE}/explain/status`),
  explain: (series, horizon, lang, fresh = false) =>
    getJSON(`${BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series, horizon, lang, fresh }),
    }),
  chat: chatStream,
};
