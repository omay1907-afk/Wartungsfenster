import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import {
  Plus,
  Pencil,
  X,
  ServerCog,
  AlertTriangle,
  History,
  Settings2,
  CalendarClock,
  Layers,
  Trash2,
  CheckCircle2,
  Download,
  ArrowRightCircle,
  Archive,
  Search,
  Cpu,
} from "lucide-react";

/* ---------------------------------------------------------
   Konfiguration: Umgebungen, Spalten, Farbpalette
--------------------------------------------------------- */

const ENV_GROUPS = [
  { key: "INT", label: "INT", full: "Abnahmetestumgebung", color: "#2563EB", sub: null },
  {
    key: "REF",
    label: "REF",
    full: "Betriebliche Integration / Probebetrieb / Zertifizierung",
    color: "#D97706",
    sub: [
      { key: "REFBIU", label: "REFBIU", full: "Betriebliche Integrationsumgebung" },
      { key: "REFPROBE", label: "REFPROBE", full: "Probebetriebsumgebung" },
      { key: "REFZERT", label: "REFZERT", full: "Zertifizierungsumgebung" },
    ],
  },
  { key: "ABN", label: "ABN", full: "Referenzumgebung", color: "#7C3AED", sub: null },
  { key: "EDU", label: "EDU", full: "Schulungsumgebung", color: "#059669", sub: null },
  { key: "PRD", label: "PRD", full: "Produktion / Echtbetrieb", color: "#DC2626", sub: null },
];

const ALL_ENV_KEYS = ["INT", "REFBIU", "REFPROBE", "REFZERT", "ABN", "EDU", "PRD"];

const ENV_META = {
  INT: { color: "#2563EB", full: "Abnahmetestumgebung" },
  REFBIU: { color: "#D97706", full: "Betriebliche Integrationsumgebung" },
  REFPROBE: { color: "#D97706", full: "Probebetriebsumgebung" },
  REFZERT: { color: "#D97706", full: "Zertifizierungsumgebung" },
  ABN: { color: "#7C3AED", full: "Referenzumgebung" },
  EDU: { color: "#059669", full: "Schulungsumgebung" },
  PRD: { color: "#DC2626", full: "Produktion / Echtbetrieb" },
};

// Spaltenreihenfolge. "group" steuert die farbliche Kopfzeile
// (stamm = Stammdaten der Servergruppe, bugfix = Daten des aktiven Wartungsfensters).
const COLUMNS = [
  { key: "jbossAdmin", label: "JBossAdmin", group: "stamm", mono: false, colorable: true, width: "max-w-[110px]" },
  { key: "jiraKennzeichen", label: "Jira Kennzeichen", group: "stamm", mono: true, colorable: true },
  { key: "name", label: "Instanz", group: "stamm", mono: false, colorable: true },
  { key: "bugfixNr", label: "Bugfix Nr", group: "bugfix", mono: true, colorable: true },
  { key: "properties", label: "Properties", group: "bugfix", mono: false, colorable: false },
  { key: "nexusLink", label: "Nexus Link", group: "bugfix", mono: true, colorable: true, width: "max-w-[300px]" },
  { key: "bemerkung", label: "Bemerkung", group: "bugfix", mono: false, colorable: true },
  { key: "ansprechpartner", label: "Ansprechpartner", group: "stamm", mono: false, colorable: true },
  { key: "aufrufadresse", label: "Aufrufadresse", group: "stamm", mono: true, colorable: true },
  { key: "soaEndpunkte", label: "SOA Endpunkte", group: "stamm", mono: true, colorable: true },
  { key: "basisaenderung", label: "Basisänderung", group: "stamm", mono: false, colorable: false },
];

const PALETTE = [
  { key: "none", label: "Keine", value: "transparent" },
  { key: "yellow", label: "Gelb", value: "#FEF3C7" },
  { key: "blue", label: "Blau", value: "#DBEAFE" },
  { key: "green", label: "Grün", value: "#D1FAE5" },
  { key: "purple", label: "Lila", value: "#EDE9FE" },
  { key: "gray", label: "Grau", value: "#E5E7EB" },
];

const PROPERTIES_RED = "#DC2626";
const EMPTY_ZUORDNUNG = { bugfixNr: "", bemerkung: "", properties: "nein", nexusLink: "", eingespielt: false, colors: {} };
const NO_DOMAIN = "__none__";

const VIEW_TABS = [
  { key: "alle", label: "Alle Instanzen" },
  { key: "einspielung", label: "Mit Einspielung" },
  { key: "eingespielt", label: "Eingespielt" },
];

function hasBugfixEntry(zu) {
  return !!(zu.bugfixNr && zu.bugfixNr.trim());
}
function hasEinspielung(zu) {
  return zu.properties === "ja" || !!(zu.nexusLink && zu.nexusLink.trim()) || hasBugfixEntry(zu);
}

function getISOWeek(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) return "";
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, "0");
}

function wfShortLabel(wf) {
  return wf ? `Wartungsfenster ${wf.nummer}` : "";
}
function wfFullLabel(wf) {
  return wf ? `Wartungsfenster ${wf.nummer} (${wf.datum} · KW ${wf.kw} · ${wf.atlasRelease})` : "";
}

/* ---------------------------------------------------------
   Datenermittlung erfolgt jetzt ausschließlich über die REST-API
   (siehe src/api.js) — hier bleiben nur noch reine Hilfsfunktionen.
--------------------------------------------------------- */

function getDefaultWfId(list) {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...list].sort((a, b) => a.datum.localeCompare(b.datum));
  const upcoming = sorted.find((w) => w.datum >= today);
  return (upcoming || sorted[sorted.length - 1])?.id;
}

// Nur die letzten 2 vergangenen Wartungsfenster + alle aktuellen/zukünftigen
// werden standardmäßig angezeigt. Ältere wandern ins Archiv.
function splitWfVisibility(list) {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...list].sort((a, b) => a.datum.localeCompare(b.datum));
  const past = sorted.filter((w) => w.datum < today);
  const future = sorted.filter((w) => w.datum >= today);
  const recentPast = past.slice(-2);
  const archived = past.slice(0, Math.max(0, past.length - 2));
  const visible = [...recentPast, ...future].sort((a, b) => a.datum.localeCompare(b.datum));
  return { visible, archived };
}

/* ---------------------------------------------------------
   Kleine UI-Bausteine
--------------------------------------------------------- */

function EnvDot({ color }) {
  return <span style={{ backgroundColor: color }} className="inline-block w-2 h-2 rounded-full mr-2 align-middle" />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent";

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 shrink-0">
      {PALETTE.map((p) => (
        <button
          type="button"
          key={p.key}
          title={p.label}
          onClick={() => onChange(p.key)}
          style={{ backgroundColor: p.value === "transparent" ? "#fff" : p.value }}
          className={`w-5 h-5 rounded-full border ${
            value === p.key || (!value && p.key === "none") ? "border-[#0F4C5C] border-2" : "border-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

function DomainSelect({ domains, value, onChange }) {
  return (
    <select
      value={value || NO_DOMAIN}
      onChange={(e) => onChange(e.target.value === NO_DOMAIN ? null : Number(e.target.value))}
      className={inputCls}
    >
      <option value={NO_DOMAIN}>Keine Domäne</option>
      {domains.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function EnvSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {ALL_ENV_KEYS.map((k) => (
        <option key={k} value={k}>
          {k} — {ENV_META[k].full}
        </option>
      ))}
    </select>
  );
}

function ArtefaktVorlagenEditor({ value, onChange }) {
  const list = value && value.length > 0 ? value : [""];
  function updateAt(i, v) {
    const next = [...list];
    next[i] = v;
    onChange(next);
  }
  function addRow() {
    onChange([...list, ""]);
  }
  function removeRow(i) {
    const next = list.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
  }
  return (
    <div className="space-y-2">
      {list.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input className={inputCls} placeholder="z. B. eks-service-*.ear" value={v} onChange={(e) => updateAt(i, e.target.value)} />
          {list.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-[#DC2626] px-2" title="Entfernen">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} className="text-xs text-[#0F4C5C] border border-[#0F4C5C]/30 hover:bg-[#0F4C5C]/5 px-2.5 py-1.5 rounded-md flex items-center gap-1">
        <Plus size={13} /> Vorlage hinzufügen
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Hauptkomponente
--------------------------------------------------------- */

export default function WartungsfensterApp() {
  const [domains, setDomains] = useState([]);
  const [servergruppen, setServergruppen] = useState(() => {
    const d = {};
    ALL_ENV_KEYS.forEach((env) => (d[env] = []));
    return d;
  });
  const [wartungsfenster, setWartungsfenster] = useState([]);
  const [zuordnungen, setZuordnungen] = useState({});
  const [activeWfId, setActiveWfId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const debounceTimers = useRef({});

  function buildZuordnungen(servergruppenByEnv, bugfixRows) {
    const allSg = Object.values(servergruppenByEnv).flat();
    const z = {};
    bugfixRows.forEach((row) => {
      if (!z[row.wartungsfensterId]) z[row.wartungsfensterId] = {};
      allSg
        .filter((sg) => sg.instanzId === row.instanzId)
        .forEach((sg) => {
          z[row.wartungsfensterId][sg.id] = {
            bugfixNr: row.bugfixNr || "",
            bemerkung: row.bemerkung || "",
            properties: row.properties || "nein",
            nexusLink: row.nexusLink || "",
            eingespielt: !!row.eingespielt,
            colors: row.colors || {},
          };
        });
    });
    return z;
  }

  async function ladeAllesVomServer() {
    setLoading(true);
    setLoadError(null);
    try {
      const [domainsRes, sgRes, wfRes, bugfixRes] = await Promise.all([
        api.getDomaenen(),
        api.getServergruppen(),
        api.getWartungsfenster(),
        api.getBugfixZuordnungen(),
      ]);
      const byEnv = {};
      ALL_ENV_KEYS.forEach((env) => (byEnv[env] = []));
      sgRes.forEach((sg) => {
        if (byEnv[sg.umgebungCode]) byEnv[sg.umgebungCode].push(sg);
      });
      setDomains(domainsRes);
      setServergruppen(byEnv);
      setWartungsfenster(wfRes);
      setZuordnungen(buildZuordnungen(byEnv, bugfixRes));
      setActiveWfId(getDefaultWfId(wfRes));
    } catch (e) {
      console.error(e);
      setLoadError("Daten konnten nicht vom Server geladen werden. Ist das Backend erreichbar (/api)?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ladeAllesVomServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function debouncedPersist(key, fn, delay = 600) {
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(fn, delay);
  }

  const [activeGroup, setActiveGroup] = useState("INT");
  const [activeSub, setActiveSub] = useState("REFBIU");
  const [viewTab, setViewTab] = useState("alle");
  const [columnFilters, setColumnFilters] = useState({});

  const [editZuordnung, setEditZuordnung] = useState(null);
  const [editBasis, setEditBasis] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [showNewSgModal, setShowNewSgModal] = useState(false);
  const [showBugfixModal, setShowBugfixModal] = useState(false);
  const [showNewWfModal, setShowNewWfModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [showBasisaenderungModal, setShowBasisaenderungModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  const activeEnv = activeGroup === "REF" ? activeSub : activeGroup;
  const rows = servergruppen[activeEnv] || [];
  const sortedWf = useMemo(() => [...wartungsfenster].sort((a, b) => a.datum.localeCompare(b.datum)), [wartungsfenster]);
  const activeWf = wartungsfenster.find((w) => w.id === activeWfId);
  const { visible: visibleWf, archived: archivedWf } = useMemo(() => splitWfVisibility(wartungsfenster), [wartungsfenster]);
  // Falls das aktive Fenster archiviert ist (z. B. gezielt aus dem Archiv geöffnet), trotzdem im Dropdown anzeigen.
  const dropdownWf = visibleWf.some((w) => w.id === activeWfId) || !activeWf ? visibleWf : [...visibleWf, activeWf].sort((a, b) => a.datum.localeCompare(b.datum));
  const nextWf = (() => {
    const idx = sortedWf.findIndex((w) => w.id === activeWfId);
    return idx >= 0 ? sortedWf[idx + 1] : undefined;
  })();

  function getEffectiveZuordnung(sgId, targetWfId) {
    const targetIdx = sortedWf.findIndex((w) => w.id === targetWfId);
    for (let i = targetIdx; i >= 0; i--) {
      const wf = sortedWf[i];
      const entry = zuordnungen[wf.id]?.[sgId];
      if (entry) return { ...entry, effectiveFromWf: wf, explicitHere: wf.id === targetWfId };
    }
    return { ...EMPTY_ZUORDNUNG, effectiveFromWf: null, explicitHere: false };
  }

  function saveZuordnungByName(sgId, wfId, data) {
    const allSg = Object.values(servergruppen).flat();
    const source = allSg.find((s) => s.id === sgId);
    const targets = source && source.name && source.name.trim() ? allSg.filter((s) => s.name === source.name) : [source].filter(Boolean);
    setZuordnungen((prev) => {
      const next = { ...prev, [wfId]: { ...(prev[wfId] || {}) } };
      targets.forEach((t) => {
        next[wfId][t.id] = data;
      });
      return next;
    });
    if (source?.instanzId && wfId) {
      api.saveBugfix(source.instanzId, wfId, data).catch((e) => console.error("Bugfix konnte nicht gespeichert werden:", e));
    }
  }

  function toggleEingespielt(sgId) {
    const current = getEffectiveZuordnung(sgId, activeWfId);
    const msg = current.eingespielt ? "Markierung 'eingespielt' wirklich entfernen?" : "Wurde dieser Bugfix wirklich eingespielt?";
    if (!window.confirm(msg)) return;
    const { effectiveFromWf, explicitHere, ...data } = current;
    saveZuordnungByName(sgId, activeWfId, { ...data, eingespielt: !current.eingespielt });
  }

  // Überträgt die aktuelle Bugfix-Zuordnung explizit in das nächste (chronologisch
  // folgende) Wartungsfenster — z. B. wenn ein Bugfix in diesem Fenster nicht mehr
  // eingespielt wurde und ins nächste Fenster verschoben werden soll.
  function transferToNextWindow(sgId) {
    if (!nextWf) return;
    const current = getEffectiveZuordnung(sgId, activeWfId);
    const { effectiveFromWf, explicitHere, ...data } = current;
    saveZuordnungByName(sgId, nextWf.id, data);
  }

  function updateBemerkungInline(sgId, value) {
    const current = getEffectiveZuordnung(sgId, activeWfId);
    const { effectiveFromWf, explicitHere, ...data } = current;
    const merged = { ...data, bemerkung: value };
    setZuordnungen((prev) => ({ ...prev, [activeWfId]: { ...(prev[activeWfId] || {}), [sgId]: merged } }));
    debouncedPersist(`bemerkung-${sgId}`, () => saveZuordnungByName(sgId, activeWfId, merged));
  }

  function saveBasis(env, updatedSg) {
    setServergruppen((prev) => ({
      ...prev,
      [env]: prev[env].map((sg) => (sg.id === updatedSg.id ? updatedSg : sg)),
    }));
    api.updateServergruppe(updatedSg.id, updatedSg).catch((e) => console.error("Stammdaten konnten nicht gespeichert werden:", e));
  }

  function updateBasisField(env, sgId, key, value) {
    setServergruppen((prev) => ({
      ...prev,
      [env]: prev[env].map((sg) => (sg.id === sgId ? { ...sg, [key]: value } : sg)),
    }));
    debouncedPersist(`sg-${sgId}-${key}`, () => api.updateServergruppe(sgId, { [key]: value }).catch((e) => console.error("Feld konnte nicht gespeichert werden:", e)));
  }

  async function addServergruppeToEnvs(envs, sgData) {
    try {
      const created = await api.createServergruppen({
        umgebungCodes: envs,
        instanzName: sgData.name,
        domainIdByUmgebung: sgData.domainIdByUmgebung,
        jbossAdmin: sgData.jbossAdmin,
        jiraKennzeichen: sgData.jiraKennzeichen,
        ansprechpartner: sgData.ansprechpartner,
        aufrufadresse: sgData.aufrufadresse,
        soaEndpunkte: sgData.soaEndpunkte,
        artefaktVorlagen: sgData.artefaktVorlagen,
      });
      setServergruppen((prev) => {
        const next = { ...prev };
        created.forEach((sg) => {
          next[sg.umgebungCode] = [...(next[sg.umgebungCode] || []), sg];
        });
        return next;
      });
    } catch (e) {
      console.error(e);
      window.alert("Instanz konnte nicht angelegt werden. Ist das Backend erreichbar?");
    }
  }

  async function addWartungsfenster({ datum, atlasRelease, nummer }) {
    try {
      const wf = await api.createWartungsfenster({ datum, atlasRelease, nummer });
      setWartungsfenster((prev) => [...prev, wf]);
      const bugfixRows = await api.getBugfixZuordnungen();
      setZuordnungen(buildZuordnungen(servergruppen, bugfixRows));
      setActiveWfId(wf.id);
    } catch (e) {
      console.error(e);
      window.alert(e.message?.includes("409") || e.message?.includes("bereits vergeben") ? "Diese Wartungsfenster-Nummer ist bereits vergeben. Bitte eine andere wählen." : "Wartungsfenster konnte nicht angelegt werden. Ist das Backend erreichbar?");
    }
  }

  async function deleteWartungsfenster(id) {
    const wf = wartungsfenster.find((w) => w.id === id);
    if (!window.confirm(`${wfShortLabel(wf)} wirklich unwiderruflich löschen? Alle darin erfassten Bugfix-Angaben gehen verloren.`)) return;
    try {
      await api.deleteWartungsfenster(id);
      setWartungsfenster((prev) => prev.filter((w) => w.id !== id));
      setZuordnungen((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeWfId === id) {
        const rest = wartungsfenster.filter((w) => w.id !== id);
        setActiveWfId(getDefaultWfId(rest));
      }
    } catch (e) {
      console.error(e);
      window.alert("Wartungsfenster konnte nicht gelöscht werden.");
    }
  }

  async function deleteServergruppe(env, sgId) {
    const sg = servergruppen[env]?.find((s) => s.id === sgId);
    if (!window.confirm(`${sg?.name || "Diese Instanz"} in ${env} wirklich löschen?`)) return;
    try {
      await api.deleteServergruppe(sgId);
      setServergruppen((prev) => ({ ...prev, [env]: prev[env].filter((s) => s.id !== sgId) }));
      setZuordnungen((prev) => {
        const next = {};
        Object.keys(prev).forEach((wfId) => {
          const { [sgId]: _entfernt, ...rest } = prev[wfId];
          next[wfId] = rest;
        });
        return next;
      });
    } catch (e) {
      console.error(e);
      window.alert("Instanz konnte nicht gelöscht werden.");
    }
  }

  async function applyBasisaenderungToAll(payload) {
    try {
      const aktualisiert = await api.bulkSetBasisaenderung(payload);
      const byId = new Map(aktualisiert.map((sg) => [sg.id, sg]));
      setServergruppen((prev) => {
        const next = {};
        Object.keys(prev).forEach((env) => {
          next[env] = prev[env].map((sg) => byId.get(sg.id) || sg);
        });
        return next;
      });
    } catch (e) {
      console.error(e);
      window.alert("Basisänderung konnte nicht auf alle Instanzen angewendet werden. Ist das Backend erreichbar?");
    }
  }

  async function addDomain(name) {
    const created = await api.createDomaene(name);
    setDomains((prev) => [...prev, created]);
    return created.id;
  }
  async function renameDomain(id, name) {
    await api.renameDomaene(id, name);
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  }
  async function deleteDomain(id) {
    await api.deleteDomaene(id);
    setDomains((prev) => prev.filter((d) => d.id !== id));
    setServergruppen((prev) => {
      const next = {};
      Object.keys(prev).forEach((env) => {
        next[env] = prev[env].map((sg) => (sg.domainId === id ? { ...sg, domainId: null } : sg));
      });
      return next;
    });
  }

  function cellStyleStamm(key, sg) {
    const p = PALETTE.find((p) => p.key === sg.colors?.[key]);
    return { backgroundColor: p ? p.value : "transparent" };
  }
  function cellStyleBugfix(key, zu) {
    if (key === "properties") {
      if (zu.eingespielt) return { backgroundColor: "#16A34A", color: "white", fontWeight: 600 };
      return zu.properties === "ja" ? { backgroundColor: PROPERTIES_RED, color: "white", fontWeight: 600 } : { backgroundColor: "transparent" };
    }
    const p = PALETTE.find((p) => p.key === zu.colors?.[key]);
    return { backgroundColor: p ? p.value : "transparent" };
  }

  const headerGroups = [];
  COLUMNS.forEach((c) => {
    const last = headerGroups[headerGroups.length - 1];
    if (last && last.group === c.group) last.span += 1;
    else headerGroups.push({ group: c.group, span: 1 });
  });

  function columnValue(c, sg, zu) {
    if (c.group === "stamm") return sg[c.key] || "";
    if (c.key === "properties") return zu.properties === "ja" ? "JA" : "NEIN";
    return zu[c.key] || "";
  }

  const activeFilterCount = Object.values(columnFilters).filter((v) => v && v.trim()).length;

  const filteredRows = rows.filter((sg) => {
    const zu = getEffectiveZuordnung(sg.id, activeWfId);
    if (viewTab === "einspielung" && !hasEinspielung(zu)) return false;
    if (viewTab === "eingespielt" && !zu.eingespielt) return false;
    return COLUMNS.every((c) => {
      const f = columnFilters[c.key];
      if (!f || !f.trim()) return true;
      return String(columnValue(c, sg, zu)).toLowerCase().includes(f.trim().toLowerCase());
    });
  });

  const counts = {
    alle: rows.length,
    einspielung: rows.filter((sg) => hasEinspielung(getEffectiveZuordnung(sg.id, activeWfId))).length,
    eingespielt: rows.filter((sg) => getEffectiveZuordnung(sg.id, activeWfId).eingespielt).length,
  };

  const domainGroups = useMemo(() => {
    const groups = domains.map((d) => ({ id: d.id, name: d.name, rows: filteredRows.filter((r) => r.domainId === d.id) }));
    const ohne = filteredRows.filter((r) => !r.domainId || !domains.some((d) => d.id === r.domainId));
    groups.push({ id: null, name: "Ohne Domäne", rows: ohne });
    return groups.filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, domains]);

  function exportToExcel() {
    const headerRow = ["Domäne", ...COLUMNS.map((c) => c.label), "Eingespielt"];
    const dataRows = domainGroups.flatMap((group) =>
      group.rows.map((sg) => {
        const zu = getEffectiveZuordnung(sg.id, activeWfId);
        return [
          group.name,
          ...COLUMNS.map((c) => {
            if (c.key === "basisaenderung") {
              const teile = [sg.jdkVersion, sg.eapVersion, sg.ojdbcVersion].filter((v) => v && v.trim());
              return teile.length > 0 ? `${teile.join(" · ")}${sg.basisaenderungEingespielt ? " (eingespielt)" : ""}` : "";
            }
            if (c.group === "stamm") return sg[c.key] || "";
            if (c.key === "properties") return zu.properties === "ja" ? "JA" : "NEIN";
            return zu[c.key] || "";
          }),
          zu.eingespielt ? "JA" : "NEIN",
        ];
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeEnv);
    XLSX.writeFile(wb, `Wartungsfenster_${activeEnv}_${activeWf?.nummer || ""}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {loading && (
        <div className="bg-slate-100 text-slate-500 text-sm text-center py-2 border-b border-slate-200">Daten werden vom Server geladen…</div>
      )}
      {loadError && (
        <div className="bg-red-50 text-[#DC2626] text-sm text-center py-2 border-b border-red-200 flex items-center justify-center gap-3">
          {loadError}
          <button onClick={ladeAllesVomServer} className="underline">
            Erneut versuchen
          </button>
        </div>
      )}
      <header className="bg-[#0F4C5C] text-white px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ServerCog size={22} />
          <div>
            <h1 className="font-semibold text-lg leading-tight">Wartungsfenster-Verwaltung</h1>
            <p className="text-xs text-slate-200/80">JBoss EAP 8.1 · JDK 21 · {ALL_ENV_KEYS.length} Umgebungen</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={exportToExcel} className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition">
            <Download size={16} /> Export zu Excel
          </button>
          <button
            onClick={() => setShowDomainModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition"
          >
            <Layers size={16} /> Domänen verwalten
          </button>
          <button
            onClick={() => setShowBasisaenderungModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition"
          >
            <Cpu size={16} /> Basisänderung erfassen
          </button>
          <button
            onClick={() => setShowBugfixModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition"
          >
            <Plus size={16} /> Bugfix erfassen
          </button>
          <button
            onClick={() => setShowNewSgModal(true)}
            className="bg-[#F2A541] hover:brightness-95 text-[#0F4C5C] font-medium text-sm px-3 py-2 rounded-md flex items-center gap-2 transition"
          >
            <Plus size={16} /> Instanz
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {ENV_GROUPS.map((g) => {
            const active = activeGroup === g.key;
            return (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                title={g.full}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                  active ? "border-[#0F4C5C] text-[#0F4C5C]" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <EnvDot color={g.color} />
                {g.label}
                {g.key === "PRD" && <AlertTriangle size={13} className="inline-block ml-1 -mt-1 text-[#DC2626]" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
            <CalendarClock size={15} className="text-slate-500" />
            <select value={activeWfId} onChange={(e) => setActiveWfId(e.target.value)} className="bg-transparent text-sm outline-none text-slate-700">
              {dropdownWf.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wfFullLabel(wf)}
                </option>
              ))}
            </select>
            {activeWf && (
              <button onClick={() => deleteWartungsfenster(activeWfId)} title="Dieses Wartungsfenster löschen" className="text-slate-300 hover:text-[#DC2626] transition">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowNewWfModal(true)}
            className="text-xs text-[#0F4C5C] border border-[#0F4C5C]/30 hover:bg-[#0F4C5C]/5 px-2 py-1.5 rounded-md flex items-center gap-1 transition"
          >
            <Plus size={13} /> Wartungsfenster
          </button>
          {archivedWf.length > 0 && (
            <button
              onClick={() => setShowArchiveModal(true)}
              className="text-xs text-slate-500 border border-slate-300 hover:bg-slate-50 px-2 py-1.5 rounded-md flex items-center gap-1 transition"
              title="Ältere Wartungsfenster ansehen"
            >
              <Archive size={13} /> Archiv ({archivedWf.length})
            </button>
          )}
        </div>
      </nav>

      {activeGroup === "REF" && (
        <nav className="bg-slate-100 border-b border-slate-200 px-6 flex gap-1">
          {ENV_GROUPS.find((g) => g.key === "REF").sub.map((s) => {
            const active = activeSub === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSub(s.key)}
                title={s.full}
                className={`px-3 py-2 text-xs font-medium rounded-t-md mt-1 transition ${
                  active ? "bg-white text-[#0F4C5C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </nav>
      )}

      <div className="bg-white border-b border-slate-200 px-6 flex gap-2 py-2">
        {VIEW_TABS.map((t) => {
          const active = viewTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setViewTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
                active ? "bg-[#0F4C5C] border-[#0F4C5C] text-white" : "bg-white border-slate-300 text-slate-500 hover:border-[#0F4C5C]/50"
              }`}
            >
              {t.key === "eingespielt" && <CheckCircle2 size={12} />}
              {t.label}
              <span className={`text-[10px] ${active ? "text-slate-200" : "text-slate-400"}`}>({counts[t.key]})</span>
            </button>
          );
        })}
      </div>

      <div className="px-6 pt-3 pb-1 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">
          <EnvDot color={ENV_META[activeEnv].color} />
          <span className="font-medium text-slate-700">{activeEnv}</span> — {ENV_META[activeEnv].full}
        </p>
        <p className="text-xs text-slate-400">
          {filteredRows.length} von {rows.length} Servergruppen/Instanzen · aktives Fenster: <span className="font-medium text-slate-600">{wfFullLabel(activeWf)}</span>
        </p>
      </div>

      <div className="px-6 pb-2 flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" /> Bugfix eingetragen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 inline-block" /> Eingespielt
        </span>
      </div>

      <div className="px-6 pb-10 overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0 bg-white rounded-md shadow-sm">
          <thead>
            <tr>
              {headerGroups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className={`sticky top-0 text-left px-3 py-1 text-[10px] font-semibold uppercase tracking-wide border-b ${
                    g.group === "bugfix" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-200 text-slate-500 border-slate-300"
                  }`}
                >
                  {g.group === "bugfix" ? `Bugfix — ${wfShortLabel(activeWf)}` : "Stammdaten"}
                </th>
              ))}
              <th className="sticky top-0 bg-slate-200 border-b border-slate-300"></th>
            </tr>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`sticky top-0 text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${
                    c.group === "bugfix" ? "bg-amber-50" : "bg-slate-100"
                  }`}
                >
                  {c.label}
                </th>
              ))}
              <th className="sticky top-0 bg-slate-100 px-3 py-2 border-b border-slate-200 text-center w-52">Aktionen</th>
            </tr>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`sticky top-0 px-1.5 py-1.5 border-b border-slate-200 ${c.group === "bugfix" ? "bg-amber-50/60" : "bg-slate-50"}`}>
                  <div className="relative">
                    <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <input
                      value={columnFilters[c.key] || ""}
                      onChange={(e) => setColumnFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                      placeholder="Filtern…"
                      className="w-full text-[11px] font-normal pl-5 pr-1.5 py-1 rounded border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                    />
                  </div>
                </th>
              ))}
              <th className="sticky top-0 bg-slate-50 px-2 py-1.5 border-b border-slate-200 text-center">
                {activeFilterCount > 0 && (
                  <button onClick={() => setColumnFilters({})} className="text-[10px] text-[#0F4C5C] underline whitespace-nowrap">
                    Filter ({activeFilterCount}) zurücksetzen
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {domainGroups.map((group) => (
              <React.Fragment key={group.id ?? "none"}>
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="bg-slate-700 text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5">
                    <Layers size={11} className="inline-block mr-1.5 -mt-0.5" />
                    {group.name}
                    <span className="text-slate-300 font-normal normal-case ml-2">({group.rows.length})</span>
                  </td>
                </tr>
                {group.rows.map((sg, idx) => {
                  const zu = getEffectiveZuordnung(sg.id, activeWfId);
                  const statusClass = zu.eingespielt
                    ? "bg-green-50 border-l-4 border-green-500"
                    : hasBugfixEntry(zu)
                    ? "bg-yellow-50 border-l-4 border-yellow-400"
                    : `${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} border-l-4 border-transparent`;
                  return (
                    <tr key={sg.id} className={statusClass}>
                      {COLUMNS.map((c) => {
                        if (c.key === "jbossAdmin") {
                          return (
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className={`px-1 py-1 border-b border-slate-100 ${c.width || "max-w-[200px]"}`}>
                              <input
                                value={sg.jbossAdmin}
                                onChange={(e) => updateBasisField(activeEnv, sg.id, "jbossAdmin", e.target.value)}
                                placeholder="Name eintragen…"
                                className="w-full bg-transparent px-2 py-1.5 text-xs rounded-md outline-none hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#0F4C5C]"
                              />
                            </td>
                          );
                        }
                        if (c.key === "name") {
                          const vorlagen = sg.artefaktVorlagen && sg.artefaktVorlagen.filter((v) => v && v.trim());
                          const tooltip =
                            vorlagen && vorlagen.length > 0
                              ? `Artefakt-Vorlage(n):\n${vorlagen.map((v) => `• ${v}`).join("\n")}`
                              : "Keine Artefakt-Vorlage hinterlegt";
                          return (
                            <td
                              key={c.key}
                              style={cellStyleStamm(c.key, sg)}
                              title={tooltip}
                              className="px-3 py-2 border-b border-slate-100 max-w-[200px] truncate cursor-help"
                            >
                              {sg.name || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        }
                        if (c.key === "aufrufadresse") {
                          return (
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className="px-3 py-2 border-b border-slate-100 max-w-[200px] truncate">
                              {sg.aufrufadresse ? (
                                <a href={sg.aufrufadresse} target="_blank" rel="noopener noreferrer" className="text-[#0F4C5C] underline hover:text-[#0b3540]">
                                  Link
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        }
                        if (c.key === "basisaenderung") {
                          const teile = [sg.jdkVersion, sg.eapVersion, sg.ojdbcVersion].filter((v) => v && v.trim());
                          const text = teile.length > 0 ? teile.join(" · ") : "";
                          return (
                            <td
                              key={c.key}
                              className={`px-3 py-2 border-b border-slate-100 max-w-[200px] truncate ${
                                sg.basisaenderungEingespielt ? "bg-green-50 text-green-700 font-medium" : ""
                              }`}
                            >
                              {text || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        }
                        if (c.group === "stamm") {
                          return (
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className={`px-3 py-2 border-b border-slate-100 ${c.width || "max-w-[200px]"} truncate ${c.mono ? "font-mono text-[11px]" : ""}`}>
                              {sg[c.key] || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        }
                        if (c.key === "bemerkung") {
                          return (
                            <td key={c.key} style={cellStyleBugfix(c.key, zu)} className="px-1 py-1 border-b border-slate-100 max-w-[200px]">
                              <input
                                value={zu.bemerkung}
                                onChange={(e) => updateBemerkungInline(sg.id, e.target.value)}
                                placeholder="Bemerkung eintragen…"
                                className="w-full bg-transparent px-2 py-1.5 text-xs rounded-md outline-none hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#0F4C5C]"
                              />
                            </td>
                          );
                        }
                        return (
                          <td
                            key={c.key}
                            style={cellStyleBugfix(c.key, zu)}
                            title={zu.effectiveFromWf && !zu.explicitHere ? `Übernommen aus ${wfShortLabel(zu.effectiveFromWf)}` : undefined}
                            className={`px-3 py-2 border-b border-slate-100 ${c.width || "max-w-[200px]"} truncate ${c.mono ? "font-mono text-[11px]" : ""}`}
                          >
                            {c.key === "properties" ? (zu.properties === "ja" ? "JA" : "NEIN") : zu[c.key] || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 border-b border-slate-100">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button onClick={() => setEditZuordnung({ env: activeEnv, sg })} title="Bugfix für dieses Wartungsfenster bearbeiten" className="text-slate-400 hover:text-[#0F4C5C] transition">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setHistoryFor({ env: activeEnv, sg })} title="Verlauf anzeigen" className="text-slate-400 hover:text-[#0F4C5C] transition">
                            <History size={14} />
                          </button>
                          <button onClick={() => setEditBasis({ env: activeEnv, sg })} title="Stammdaten bearbeiten" className="text-slate-400 hover:text-[#0F4C5C] transition">
                            <Settings2 size={14} />
                          </button>
                          <button
                            onClick={() => transferToNextWindow(sg.id)}
                            disabled={!hasBugfixEntry(zu) || !nextWf}
                            title={
                              !hasBugfixEntry(zu)
                                ? "Kein Bugfix zum Übertragen vorhanden"
                                : !nextWf
                                ? "Kein nächstes Wartungsfenster vorhanden"
                                : `In ${wfShortLabel(nextWf)} übertragen`
                            }
                            className={`transition ${!hasBugfixEntry(zu) || !nextWf ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-[#0F4C5C]"}`}
                          >
                            <ArrowRightCircle size={14} />
                          </button>
                          <button
                            onClick={() => toggleEingespielt(sg.id)}
                            disabled={!hasBugfixEntry(zu)}
                            title={
                              !hasBugfixEntry(zu)
                                ? "Erst möglich, wenn ein Bugfix eingetragen ist"
                                : zu.eingespielt
                                ? "Markierung 'eingespielt' entfernen"
                                : "Als eingespielt markieren"
                            }
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition flex items-center gap-1 ${
                              !hasBugfixEntry(zu)
                                ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                : zu.eingespielt
                                ? "bg-green-600 border-green-600 text-white"
                                : "bg-white border-slate-300 text-slate-500 hover:border-green-400"
                            }`}
                          >
                            <CheckCircle2 size={11} />
                            Eingespielt
                          </button>
                          <button onClick={() => deleteServergruppe(activeEnv, sg.id)} title="Diese Instanz in dieser Umgebung löschen" className="text-slate-300 hover:text-[#DC2626] transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center text-slate-400 py-8">
                  {rows.length === 0 ? "Noch keine Servergruppen/Instanzen in dieser Umgebung angelegt." : "Keine Einträge für diese Ansicht."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editZuordnung && (
        <ZuordnungModal
          sg={editZuordnung.sg}
          wf={activeWf}
          initial={getEffectiveZuordnung(editZuordnung.sg.id, activeWfId)}
          onClose={() => setEditZuordnung(null)}
          onSave={(data) => {
            saveZuordnungByName(editZuordnung.sg.id, activeWfId, data);
            setEditZuordnung(null);
          }}
        />
      )}

      {editBasis && (
        <BasisModal
          env={editBasis.env}
          sg={editBasis.sg}
          domains={domains}
          onClose={() => setEditBasis(null)}
          onSave={(updated) => {
            saveBasis(editBasis.env, updated);
            setEditBasis(null);
          }}
        />
      )}

      {historyFor && (
        <HistoryModal sg={historyFor.sg} sortedWf={sortedWf} getEffectiveZuordnung={getEffectiveZuordnung} onClose={() => setHistoryFor(null)} />
      )}

      {showNewSgModal && (
        <NewServergruppeModal
          defaultEnv={activeEnv}
          domains={domains}
          onAddDomain={addDomain}
          onClose={() => setShowNewSgModal(false)}
          onSubmit={(envs, sgData) => {
            addServergruppeToEnvs(envs, sgData);
            setShowNewSgModal(false);
          }}
        />
      )}

      {showBugfixModal && (
        <BugfixQuickModal
          defaultEnv={activeEnv}
          servergruppen={servergruppen}
          wf={activeWf}
          onClose={() => setShowBugfixModal(false)}
          onSubmit={(sgId, data) => {
            saveZuordnungByName(sgId, activeWfId, data);
            setShowBugfixModal(false);
          }}
        />
      )}

      {showNewWfModal && (
        <NewWartungsfensterModal
          nextNummer={String(
            Math.max(0, ...wartungsfenster.map((w) => parseInt(w.nummer, 10) || 0)) + 1
          ).padStart(2, "0")}
          onClose={() => setShowNewWfModal(false)}
          onSubmit={(data) => {
            addWartungsfenster(data);
            setShowNewWfModal(false);
          }}
        />
      )}

      {showDomainModal && (
        <DomainManagerModal
          domains={domains}
          servergruppen={servergruppen}
          onAdd={addDomain}
          onRename={renameDomain}
          onDelete={deleteDomain}
          onClose={() => setShowDomainModal(false)}
        />
      )}

      {showBasisaenderungModal && (
        <BasisaenderungBulkModal
          onClose={() => setShowBasisaenderungModal(false)}
          onSubmit={async (payload) => {
            await applyBasisaenderungToAll(payload);
            setShowBasisaenderungModal(false);
          }}
        />
      )}

      {showArchiveModal && (
        <ArchiveModal
          archivedWf={archivedWf}
          onSelect={(id) => {
            setActiveWfId(id);
            setShowArchiveModal(false);
          }}
          onDelete={deleteWartungsfenster}
          onClose={() => setShowArchiveModal(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Modal: Neue Servergruppe/Instanz (Stammdaten, Mehrfachumgebung + Domäne)
--------------------------------------------------------- */

function NewServergruppeModal({ defaultEnv, domains, onAddDomain, onClose, onSubmit }) {
  const [selectedEnvs, setSelectedEnvs] = useState(() => new Set([defaultEnv]));
  const [masterDomainId, setMasterDomainId] = useState(null);
  const [domainByEnv, setDomainByEnv] = useState({});
  const [newDomainName, setNewDomainName] = useState("");
  const [form, setForm] = useState({
    jbossAdmin: "",
    jiraKennzeichen: "",
    name: "",
    ansprechpartner: "",
    aufrufadresse: "",
    soaEndpunkte: "",
    artefaktVorlagen: [""],
  });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function toggleEnv(key) {
    setSelectedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setDomainByEnv((d) => (key in d ? d : { ...d, [key]: masterDomainId }));
      }
      return next;
    });
  }
  function selectAllEnvs() {
    setSelectedEnvs(new Set(ALL_ENV_KEYS));
    setDomainByEnv((prev) => {
      const next = { ...prev };
      ALL_ENV_KEYS.forEach((env) => {
        if (!(env in next)) next[env] = masterDomainId;
      });
      return next;
    });
  }
  function handleMasterDomainChange(v) {
    setMasterDomainId(v);
    setDomainByEnv((prev) => {
      const next = { ...prev };
      selectedEnvs.forEach((env) => {
        next[env] = v;
      });
      return next;
    });
  }
  async function handleAddDomainInline() {
    if (!newDomainName.trim()) return;
    const id = await onAddDomain(newDomainName.trim());
    handleMasterDomainChange(id);
    setNewDomainName("");
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (selectedEnvs.size === 0) return;
    const domainIdByUmgebung = {};
    selectedEnvs.forEach((env) => {
      domainIdByUmgebung[env] = domainByEnv[env] ?? null;
    });
    onSubmit(Array.from(selectedEnvs), { ...form, artefaktVorlagen: form.artefaktVorlagen.filter((v) => v && v.trim()), domainIdByUmgebung });
  }

  return (
    <Modal title="Neue Servergruppe/Instanz anlegen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Umgebungen">
          <div className="border border-slate-200 rounded-md p-3">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700 mr-auto">Auswahl</span>
              <button type="button" onClick={selectAllEnvs} className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">
                Alle
              </button>
              <button type="button" onClick={() => setSelectedEnvs(new Set())} className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">
                Keine
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {ENV_GROUPS.filter((g) => !g.sub).map((g) => (
                <label
                  key={g.key}
                  className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer transition ${
                    selectedEnvs.has(g.key) ? "border-[#0F4C5C]/40 bg-[#0F4C5C]/5 text-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input type="checkbox" checked={selectedEnvs.has(g.key)} onChange={() => toggleEnv(g.key)} />
                  <EnvDot color={g.color} />
                  {g.label}
                </label>
              ))}
            </div>

            {ENV_GROUPS.filter((g) => g.sub).map((g) => (
              <div key={g.key} className="bg-amber-50 border border-amber-100 rounded-md p-2.5">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center">
                  <EnvDot color={g.color} />
                  {g.label}-Gruppe
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {g.sub.map((s) => (
                    <label
                      key={s.key}
                      className={`flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 cursor-pointer transition ${
                        selectedEnvs.has(s.key) ? "border-amber-400 bg-white text-slate-700" : "border-amber-200/70 text-slate-600 hover:bg-white/60"
                      }`}
                    >
                      <input type="checkbox" checked={selectedEnvs.has(s.key)} onChange={() => toggleEnv(s.key)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedEnvs.size === 0 && <p className="text-xs text-[#DC2626] mt-1">Bitte mindestens eine Umgebung auswählen.</p>}
          {selectedEnvs.size > 1 && (
            <p className="text-xs text-slate-400 mt-1">
              Wird identisch in {selectedEnvs.size} Umgebungen angelegt (Stammdaten). Domänen können je Umgebung unten abweichend gesetzt werden.
            </p>
          )}
        </Field>

        <Field label="Domäne (Vorbelegung für alle ausgewählten Umgebungen)">
          <DomainSelect domains={domains} value={masterDomainId} onChange={handleMasterDomainChange} />
          <div className="flex gap-2 mt-2">
            <input className={inputCls} placeholder="Neue Domäne anlegen…" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} />
            <button type="button" onClick={handleAddDomainInline} className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 whitespace-nowrap">
              + Anlegen
            </button>
          </div>
        </Field>

        {selectedEnvs.size > 0 && (
          <Field label="Domäne je Umgebung (bei Bedarf einzeln anpassen)">
            <div className="space-y-2 border border-slate-200 rounded-md p-3">
              {ALL_ENV_KEYS.filter((env) => selectedEnvs.has(env)).map((env) => (
                <div key={env} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-20 shrink-0">{env}</span>
                  <DomainSelect
                    domains={domains}
                    value={domainByEnv[env] ?? null}
                    onChange={(v) => setDomainByEnv((prev) => ({ ...prev, [env]: v }))}
                  />
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Jira Kennzeichen">
          <input className={inputCls} value={form.jiraKennzeichen} onChange={(e) => set("jiraKennzeichen", e.target.value)} />
        </Field>
        <Field label="Instanz">
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Artefakt-Namensvorlage(n)">
          <ArtefaktVorlagenEditor value={form.artefaktVorlagen} onChange={(v) => set("artefaktVorlagen", v)} />
          <p className="text-xs text-slate-400 mt-1">Wird als Mouseover-Hinweis auf der Instanz-Spalte angezeigt.</p>
        </Field>
        <Field label="Ansprechpartner">
          <input className={inputCls} value={form.ansprechpartner} onChange={(e) => set("ansprechpartner", e.target.value)} />
        </Field>
        <Field label="Aufrufadresse">
          <input className={inputCls} value={form.aufrufadresse} onChange={(e) => set("aufrufadresse", e.target.value)} />
        </Field>
        <Field label="SOA Endpunkte">
          <input className={inputCls} value={form.soaEndpunkte} onChange={(e) => set("soaEndpunkte", e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" disabled={selectedEnvs.size === 0} className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            Servergruppe anlegen
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Stammdaten bearbeiten
--------------------------------------------------------- */

function BasisModal({ env, sg, domains, onClose, onSave }) {
  const [form, setForm] = useState({ ...sg, colors: { ...sg.colors }, artefaktVorlagen: sg.artefaktVorlagen && sg.artefaktVorlagen.length > 0 ? sg.artefaktVorlagen : [""] });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function setColor(key, colorKey) {
    setForm((f) => ({ ...f, colors: { ...f.colors, [key]: colorKey } }));
  }

  return (
    <Modal title={`Stammdaten bearbeiten — ${env} / ${sg.name || sg.jbossAdmin || sg.id}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, artefaktVorlagen: form.artefaktVorlagen.filter((v) => v && v.trim()) });
        }}
      >
        <Field label="Domäne">
          <DomainSelect domains={domains} value={form.domainId} onChange={(v) => set("domainId", v)} />
        </Field>
        {COLUMNS.filter((c) => c.group === "stamm" && c.key !== "basisaenderung").map((c) => (
          <React.Fragment key={c.key}>
            <Field label={c.label}>
              <div className="flex gap-2 items-center">
                <input className={inputCls} value={form[c.key] || ""} onChange={(e) => set(c.key, e.target.value)} />
                <ColorPicker value={form.colors?.[c.key]} onChange={(v) => setColor(c.key, v)} />
              </div>
            </Field>
            {c.key === "name" && (
              <Field label="Artefakt-Namensvorlage(n)">
                <ArtefaktVorlagenEditor value={form.artefaktVorlagen} onChange={(v) => set("artefaktVorlagen", v)} />
              </Field>
            )}
          </React.Fragment>
        ))}
        <Field label="Basisänderung">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input className={inputCls} placeholder="JDK-Version" value={form.jdkVersion || ""} onChange={(e) => set("jdkVersion", e.target.value)} />
            <input className={inputCls} placeholder="EAP-Version" value={form.eapVersion || ""} onChange={(e) => set("eapVersion", e.target.value)} />
            <input className={inputCls} placeholder="OJDBC-Version" value={form.ojdbcVersion || ""} onChange={(e) => set("ojdbcVersion", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.basisaenderungEingespielt} onChange={(e) => set("basisaenderungEingespielt", e.target.checked)} />
            Eingespielt (Spalte wird grün markiert)
          </label>
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Bugfix-Zuordnung bearbeiten (gilt ab dem gewählten Fenster)
--------------------------------------------------------- */

function ZuordnungModal({ sg, wf, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    bugfixNr: initial.bugfixNr,
    bemerkung: initial.bemerkung,
    properties: initial.properties,
    nexusLink: initial.nexusLink,
    eingespielt: initial.eingespielt,
    colors: { ...initial.colors },
  });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function setColor(key, colorKey) {
    setForm((f) => ({ ...f, colors: { ...f.colors, [key]: colorKey } }));
  }

  return (
    <Modal title={`Bugfix bearbeiten — ${sg.name || sg.jbossAdmin || sg.id} · ${wfShortLabel(wf)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Diese Änderung gilt ab <strong>{wfShortLabel(wf)}</strong> ({wf?.datum}) für alle Instanzen mit demselben Instanznamen in jeder Umgebung — und automatisch für alle
          späteren Wartungsfenster, bis sie dort erneut geändert wird.
        </p>
        {COLUMNS.filter((c) => c.group === "bugfix" && c.key !== "properties").map((c) => (
          <Field key={c.key} label={c.label}>
            <div className="flex gap-2 items-center">
              <input className={inputCls} value={form[c.key] || ""} onChange={(e) => set(c.key, e.target.value)} />
              <ColorPicker value={form.colors?.[c.key]} onChange={(v) => setColor(c.key, v)} />
            </div>
          </Field>
        ))}
        <Field label="Property einspielen">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="props-edit" checked={form.properties === "ja"} onChange={() => set("properties", "ja")} />
              Ja
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="props-edit" checked={form.properties === "nein"} onChange={() => set("properties", "nein")} />
              Nein
            </label>
          </div>
          {form.properties === "ja" && <p className="text-xs text-[#DC2626] mt-1">Spalte "Properties" wird rot markiert.</p>}
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.eingespielt} onChange={(e) => set("eingespielt", e.target.checked)} />
            Bereits eingespielt (Zeile wird grün markiert)
          </label>
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Bugfix erfassen (Servergruppe per Dropdown wählen)
--------------------------------------------------------- */

function BugfixQuickModal({ defaultEnv, servergruppen, wf, onClose, onSubmit }) {
  const [env, setEnv] = useState(defaultEnv);
  const [sgId, setSgId] = useState(servergruppen[defaultEnv]?.[0]?.id || "");
  const [form, setForm] = useState({ bugfixNr: "", bemerkung: "", properties: "nein", nexusLink: "" });

  const options = servergruppen[env] || [];

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (!sgId) return;
    onSubmit(sgId, { ...form, eingespielt: false, colors: {} });
  }

  return (
    <Modal title={`Bugfix erfassen — ${wfShortLabel(wf)}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Umgebung">
          <EnvSelect
            value={env}
            onChange={(v) => {
              setEnv(v);
              setSgId(servergruppen[v]?.[0]?.id || "");
            }}
          />
        </Field>
        <Field label="Servergruppe/Instanz">
          <select value={sgId} onChange={(e) => setSgId(e.target.value)} className={inputCls}>
            {options.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.name || sg.jbossAdmin || sg.id}
                {sg.name && sg.jbossAdmin ? ` — ${sg.jbossAdmin}` : ""}
              </option>
            ))}
            {options.length === 0 && <option value="">Keine Servergruppen in dieser Umgebung</option>}
          </select>
        </Field>
        <Field label="Bugfixnummer">
          <input required className={inputCls} placeholder="z. B. 42" value={form.bugfixNr} onChange={(e) => set("bugfixNr", e.target.value)} />
        </Field>
        <Field label="Nexus Link">
          <input className={inputCls} placeholder="https://nexus.internal/repo/..." value={form.nexusLink} onChange={(e) => set("nexusLink", e.target.value)} />
        </Field>
        <Field label="Bemerkung">
          <input className={inputCls} value={form.bemerkung} onChange={(e) => set("bemerkung", e.target.value)} />
        </Field>
        <Field label="Property einspielen">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="props-quick" checked={form.properties === "ja"} onChange={() => set("properties", "ja")} />
              Ja
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="props-quick" checked={form.properties === "nein"} onChange={() => set("properties", "nein")} />
              Nein
            </label>
          </div>
          {form.properties === "ja" && <p className="text-xs text-[#DC2626] mt-1">Die Spalte "Properties" wird rot markiert.</p>}
        </Field>
        <p className="text-xs text-slate-400 mb-3">
          Gilt für alle Instanzen mit diesem Instanznamen (in jeder Umgebung), ab dem aktuell gewählten Wartungsfenster und automatisch für alle folgenden.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110">
            Bugfix speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Neues Wartungsfenster
--------------------------------------------------------- */

function NewWartungsfensterModal({ nextNummer, onClose, onSubmit }) {
  const [nummer, setNummer] = useState(nextNummer);
  const [datum, setDatum] = useState("");
  const [atlasRelease, setAtlasRelease] = useState("ATLAS 10.2.2");

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ datum, atlasRelease, nummer });
  }

  const kw = getISOWeek(datum);

  return (
    <Modal title="Neues Wartungsfenster anlegen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Wird angelegt als: <strong>Wartungsfenster {nummer}</strong>
          {datum ? ` (${datum} · KW ${kw} · ${atlasRelease})` : ""}.
        </p>
        <Field label="Nummer">
          <input required className={inputCls} value={nummer} onChange={(e) => setNummer(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">Wird automatisch als nächste freie Nummer vorgeschlagen ({nextNummer}), kann bei Bedarf angepasst werden.</p>
        </Field>
        <Field label="Datum">
          <input required type="date" className={inputCls} value={datum} onChange={(e) => setDatum(e.target.value)} />
        </Field>
        <Field label="ATLAS Release">
          <input required className={inputCls} value={atlasRelease} onChange={(e) => setAtlasRelease(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110">
            Anlegen
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Domänen verwalten (anlegen / umbenennen / löschen)
--------------------------------------------------------- */

function DomainManagerModal({ domains, servergruppen, onAdd, onRename, onDelete, onClose }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  function countUsage(domainId) {
    return Object.values(servergruppen).flat().filter((sg) => sg.domainId === domainId).length;
  }
  function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
  }
  function startEdit(d) {
    setEditingId(d.id);
    setEditingName(d.name);
  }
  function saveEdit() {
    if (editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
  }
  function handleDelete(d) {
    const usage = countUsage(d.id);
    const msg = usage > 0 ? `"${d.name}" wird bei ${usage} Servergruppe(n) auf "Ohne Domäne" gesetzt. Wirklich löschen?` : `Domäne "${d.name}" wirklich löschen?`;
    if (window.confirm(msg)) onDelete(d.id);
  }

  return (
    <Modal title="Domänen verwalten" onClose={onClose}>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input className={inputCls} placeholder="Neue Domäne, z. B. zoll-atlasneu" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="px-3 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 whitespace-nowrap flex items-center gap-1">
          <Plus size={14} /> Anlegen
        </button>
      </form>

      <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
        {domains.length === 0 && <p className="text-sm text-slate-400 px-3 py-4 text-center">Noch keine Domänen angelegt.</p>}
        {domains.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-3 py-2">
            {editingId === d.id ? (
              <input autoFocus className={inputCls + " mr-2"} value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
            ) : (
              <span className="text-sm text-slate-700">
                {d.name} <span className="text-slate-400 text-xs">({countUsage(d.id)} Servergruppen)</span>
              </span>
            )}
            <div className="flex gap-2 shrink-0 ml-2">
              {editingId === d.id ? (
                <button onClick={saveEdit} className="text-xs text-[#0F4C5C] font-medium">
                  Speichern
                </button>
              ) : (
                <button onClick={() => startEdit(d)} className="text-slate-400 hover:text-[#0F4C5C]" title="Umbenennen">
                  <Pencil size={14} />
                </button>
              )}
              <button onClick={() => handleDelete(d)} className="text-slate-400 hover:text-[#DC2626]" title="Löschen">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Schließen
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Basisänderung erfassen (wird auf alle Instanzen angewendet)
--------------------------------------------------------- */

function BasisaenderungBulkModal({ onClose, onSubmit }) {
  const [jdkVersion, setJdkVersion] = useState("");
  const [eapVersion, setEapVersion] = useState("");
  const [ojdbcVersion, setOjdbcVersion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ jdkVersion, eapVersion, ojdbcVersion });
    setSubmitting(false);
  }

  return (
    <Modal title="Basisänderung erfassen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Wird auf <strong>alle</strong> Instanzen in allen Umgebungen angewendet. Der "Eingespielt"-Status wird dabei für alle zurückgesetzt. Einzelne Instanzen lassen sich danach über "Stammdaten bearbeiten" individuell abweichend anpassen oder als eingespielt markieren.
        </p>
        <Field label="JDK-Version">
          <input required className={inputCls} placeholder="z. B. 21" value={jdkVersion} onChange={(e) => setJdkVersion(e.target.value)} />
        </Field>
        <Field label="EAP-Version">
          <input required className={inputCls} placeholder="z. B. 8.1" value={eapVersion} onChange={(e) => setEapVersion(e.target.value)} />
        </Field>
        <Field label="OJDBC-Version">
          <input required className={inputCls} placeholder="z. B. 23.4" value={ojdbcVersion} onChange={(e) => setOjdbcVersion(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 disabled:opacity-50">
            {submitting ? "Wird angewendet…" : "Auf alle Instanzen anwenden"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Verlauf (fortgeschriebene Werte je Wartungsfenster)
--------------------------------------------------------- */

/* ---------------------------------------------------------
   Modal: Wartungsfenster-Archiv (ältere Fenster, nicht mehr im Standard-Dropdown)
--------------------------------------------------------- */

function ArchiveModal({ archivedWf, onSelect, onDelete, onClose }) {
  const rows = [...archivedWf].sort((a, b) => b.datum.localeCompare(a.datum));
  return (
    <Modal title="Wartungsfenster-Archiv" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-4">
        Diese Wartungsfenster liegen weiter als die letzten 2 vergangenen zurück und werden im normalen Auswahlfeld nicht mehr angezeigt. Zum Ansehen einfach anklicken.
      </p>
      <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
        {rows.map((wf) => (
          <div key={wf.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition">
            <button onClick={() => onSelect(wf.id)} className="text-left text-sm text-slate-600 flex-1">
              {wfFullLabel(wf)}
            </button>
            <span className="text-xs text-[#0F4C5C] mr-3 cursor-pointer" onClick={() => onSelect(wf.id)}>
              Ansehen →
            </span>
            <button onClick={() => onDelete(wf.id)} title="Löschen" className="text-slate-300 hover:text-[#DC2626] transition">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Schließen
        </button>
      </div>
    </Modal>
  );
}

function HistoryModal({ sg, sortedWf, getEffectiveZuordnung, onClose }) {
  const rows = [...sortedWf].reverse();
  const hasAny = rows.some((wf) => getEffectiveZuordnung(sg.id, wf.id).effectiveFromWf);

  return (
    <Modal title={`Verlauf — ${sg.name || sg.jbossAdmin || sg.id}`} onClose={onClose} wide>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Wartungsfenster</th>
            <th className="py-2 pr-3">Datum</th>
            <th className="py-2 pr-3">KW</th>
            <th className="py-2 pr-3">ATLAS Release</th>
            <th className="py-2 pr-3">Bugfix Nr</th>
            <th className="py-2 pr-3">Properties</th>
            <th className="py-2 pr-3">Nexus Link</th>
            <th className="py-2 pr-3">Bemerkung</th>
            <th className="py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((wf) => {
            const zu = getEffectiveZuordnung(sg.id, wf.id);
            return (
              <tr key={wf.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-700">{wfShortLabel(wf)}</td>
                <td className="py-2 pr-3 font-mono">{wf.datum}</td>
                <td className="py-2 pr-3 font-mono">{wf.kw}</td>
                <td className="py-2 pr-3">{wf.atlasRelease}</td>
                <td className="py-2 pr-3 font-mono">{zu.bugfixNr || <span className="text-slate-300">—</span>}</td>
                <td className="py-2 pr-3">
                  {zu.effectiveFromWf ? (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${zu.properties === "ja" ? "bg-[#DC2626] text-white" : "bg-slate-100 text-slate-500"}`}>
                      {zu.properties === "ja" ? "JA" : "NEIN"}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono truncate max-w-[160px]">{zu.nexusLink || <span className="text-slate-300">—</span>}</td>
                <td className="py-2 pr-3">{zu.bemerkung || <span className="text-slate-300">—</span>}</td>
                <td className="py-2 pr-3 text-[11px]">
                  {!zu.effectiveFromWf ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <>
                      {zu.eingespielt && <span className="text-green-600 font-medium mr-1">eingespielt</span>}
                      {zu.explicitHere ? <span className="text-slate-600">geändert</span> : <span className="text-slate-400">übernommen seit {wfShortLabel(zu.effectiveFromWf)}</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!hasAny && <p className="text-center text-slate-400 py-6 text-sm">Für diese Servergruppe/Instanz wurde bisher kein Bugfix erfasst.</p>}
    </Modal>
  );
}
