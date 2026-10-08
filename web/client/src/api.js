const BASE = "/api";

async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
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
  explain: (series, horizon, lang) =>
    getJSON(`${BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series, horizon, lang }),
    }),
};
