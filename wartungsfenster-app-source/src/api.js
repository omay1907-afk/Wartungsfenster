// Zentrale Anbindung an das Backend (JAX-RS unter /api, siehe backend-Projekt).
// Alle Funktionen geben Promises zurück und werfen bei Fehlern eine Error.

const API_BASE = "/api";

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} fehlgeschlagen (${res.status}) ${text}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

export const api = {
  // Domänen
  getDomaenen: () => http("GET", "/domaenen"),
  createDomaene: (name) => http("POST", "/domaenen", { name }),
  renameDomaene: (id, name) => http("PUT", `/domaenen/${id}`, { name }),
  deleteDomaene: (id) => http("DELETE", `/domaenen/${id}`),

  // Servergruppen (Instanz-Platzierungen)
  getServergruppen: () => http("GET", "/servergruppen"),
  createServergruppen: (payload) => http("POST", "/servergruppen", payload),
  updateServergruppe: (id, payload) => http("PUT", `/servergruppen/${id}`, payload),

  // Wartungsfenster
  getWartungsfenster: () => http("GET", "/wartungsfenster"),
  createWartungsfenster: (payload) => http("POST", "/wartungsfenster", payload),

  // Bugfix-Zuordnungen (liegen an der Instanz, nicht an der Servergruppe)
  getBugfixZuordnungen: () => http("GET", "/bugfix-zuordnungen"),
  saveBugfix: (instanzId, wartungsfensterId, payload) => http("PUT", `/instanzen/${instanzId}/bugfix/${wartungsfensterId}`, payload),
};
