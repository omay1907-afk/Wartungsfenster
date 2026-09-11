// Zentrale Anbindung an das Backend (JAX-RS unter /api, siehe backend-Projekt).
// Alle Funktionen geben Promises zurück und werfen bei Fehlern eine Error.
//
// WICHTIG: Bewusst als relativer Pfad ("api", ohne führenden Schrägstrich),
// damit die Anfragen relativ zum aktuellen Context-Root aufgelöst werden
// (z. B. /wartungsfenster/api/...), statt relativ zur Domain-Wurzel.

const API_BASE = "api";

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
  deleteServergruppe: (id) => http("DELETE", `/servergruppen/${id}`),

  // Wartungsfenster
  getWartungsfenster: () => http("GET", "/wartungsfenster"),
  createWartungsfenster: (payload) => http("POST", "/wartungsfenster", payload),
  deleteWartungsfenster: (id) => http("DELETE", `/wartungsfenster/${id}`),

  // Basisänderung (pro Servergruppe UND Wartungsfenster)
  getBasisaenderungen: () => http("GET", "/basisaenderungen"),
  saveBasisaenderung: (servergruppeId, wartungsfensterId, payload) =>
    http("PUT", `/servergruppen/${servergruppeId}/basisaenderung/${wartungsfensterId}`, payload),
  bulkSetBasisaenderung: (wartungsfensterId, payload) => http("PUT", `/servergruppen/basisaenderung/${wartungsfensterId}`, payload),

  // Bugfixe (gehören zu einem Wartungsfenster, können mehrere Instanzen umfassen)
  getBugfixe: () => http("GET", "/bugfixe"),
  createBugfix: (payload) => http("POST", "/bugfixe", payload),
  updateBugfix: (bugfixId, payload) => http("PUT", `/bugfixe/${bugfixId}`, payload),
  updateBugfixInstanz: (bugfixInstanzId, payload) => http("PUT", `/bugfixe/instanz/${bugfixInstanzId}`, payload),
  deleteBugfixInstanz: (bugfixInstanzId) => http("DELETE", `/bugfixe/instanz/${bugfixInstanzId}`),
  deleteBugfix: (bugfixId) => http("DELETE", `/bugfixe/${bugfixId}`),
  moveBugfix: (bugfixId, zielWartungsfensterId) => http("PUT", `/bugfixe/${bugfixId}/verschieben/${zielWartungsfensterId}`),
};
