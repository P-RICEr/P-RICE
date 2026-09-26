const BASE = "/api";

async function getJSON(url) {
  const res = await fetch(url);
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
};
