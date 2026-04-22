const API = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}/campaign-briefs${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    search.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const briefsApi = {
  list:       (params)            => request(buildQuery(params)),
  create:     ()                  => request('',                      { method: 'POST' }),
  patch:      (id, patch)         => request(`/${id}`,                { method: 'PATCH', body: JSON.stringify(patch) }),
  chatTurn:   (id, message)       => request(`/${id}/chat/turn`,      { method: 'POST',  body: JSON.stringify({ message }) }),
  genOptions: (id)                => request(`/${id}/options/generate`, { method: 'POST' }),
  accept:     (id, optionIndex)   => request(`/${id}/options/accept`,   { method: 'POST', body: JSON.stringify({ optionIndex }) }),
  dismiss:    (id)                => request(`/${id}/dismiss`,          { method: 'POST' }),
  remove:     (id)                => request(`/${id}`,                   { method: 'DELETE' }),
  regenerateOpportunities: ()     => request('/ai-opportunities/regenerate', { method: 'POST' }),
};
