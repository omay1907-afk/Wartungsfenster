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
  Copy,
  Boxes,
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
  { key: "basisaenderung", label: "Basisänderung", group: "stamm", mono: false, colorable: false },
  { key: "bugfixNr", label: "Bugfix Nr", group: "bugfix", mono: true, colorable: true },
  { key: "properties", label: "Properties", group: "bugfix", mono: false, colorable: false },
  { key: "nexusLink", label: "Nexus Link", group: "bugfix", mono: true, colorable: true, width: "max-w-[300px]" },
  { key: "bemerkung", label: "Bemerkung", group: "bugfix", mono: false, colorable: true },
  { key: "ansprechpartner", label: "Ansprechpartner", group: "stamm", mono: false, colorable: true },
  { key: "aufrufadresse", label: "Aufrufadresse", group: "stamm", mono: true, colorable: true },
  { key: "soaEndpunkte", label: "SOA Endpunkte", group: "stamm", mono: true, colorable: true },
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
const NO_DOMAIN = "__none__";
const EMPTY_ZU = { bugfixNr: "", nexusLink: "", properties: "nein", bemerkung: "", eingespielt: false, colors: {}, bugfixId: null, bugfixInstanzId: null };
const EMPTY_BASIS = { jdkVersionAlt: "", jdkVersionNeu: "", jdkAufNeuerVersion: false, eapVersion: "", ojdbcVersion: "", eingespielt: false };

const VIEW_TABS = [
  { key: "alle", label: "Alle Instanzen" },
  { key: "einspielung", label: "Mit Einspielung" },
  { key: "eingespielt", label: "Eingespielt" },
];

function hasBugfixEntry(zu) {
  return !!(zu.bugfixNr && zu.bugfixNr.trim());
}
function formatBf(nr) {
  return nr && nr.trim() ? `BF ${nr.trim()}` : "";
}
function hasEinspielung(zu) {
  return zu.properties === "ja" || !!(zu.nexusLink && zu.nexusLink.trim()) || hasBugfixEntry(zu);
}
function hasBasisaenderungEntry(basis) {
  return !!((basis.jdkVersionAlt && basis.jdkVersionAlt.trim()) || (basis.jdkVersionNeu && basis.jdkVersionNeu.trim()) || (basis.eapVersion && basis.eapVersion.trim()) || (basis.ojdbcVersion && basis.ojdbcVersion.trim()));
}

// Liefert die aktuell "geltende" JDK-Version: je nachdem, ob laut Umschalter schon auf
// der neueren Version oder noch auf der aktuellen Version.
function effektiveJdkVersion(basis) {
  return basis.jdkAufNeuerVersion ? basis.jdkVersionNeu : basis.jdkVersionAlt;
}
function basisaenderungText(basis) {
  const teile = [effektiveJdkVersion(basis), basis.eapVersion, basis.ojdbcVersion].filter((v) => v && v.trim());
  return teile.join(" · ");
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

function FastTooltip({ text, children }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  function handleEnter() {
    timerRef.current = setTimeout(() => setShow(true), 150);
  }
  function handleLeave() {
    clearTimeout(timerRef.current);
    setShow(false);
  }
  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-slate-800 text-white text-[11px] rounded-md px-2.5 py-1.5 whitespace-pre-line shadow-lg max-w-xs pointer-events-none">
          {text}
        </div>
      )}
    </div>
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
  const [bugfixe, setBugfixe] = useState([]); // flache Liste, jedes Element inkl. .instanzen[]
  const [basisaenderungen, setBasisaenderungen] = useState({}); // [wartungsfensterId][servergruppeId] = {...}
  const [activeWfId, setActiveWfId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const debounceTimers = useRef({});

  const [activeGroup, setActiveGroup] = useState("INT");
  const [activeSub, setActiveSub] = useState("REFBIU");
  const [viewTab, setViewTab] = useState("alle");
  const [columnFilters, setColumnFilters] = useState({});

  const [editBugfixFor, setEditBugfixFor] = useState(null); // { sg, zu }
  const [editBasis, setEditBasis] = useState(null); // { env, sg }
  const [historyFor, setHistoryFor] = useState(null); // { sg }
  const [transferFor, setTransferFor] = useState(null); // { bugfixId }
  const [deleteBugfixFor, setDeleteBugfixFor] = useState(null); // { sg, zu }
  const [eingespieltFor, setEingespieltFor] = useState(null); // { sg, zu, basis }
  const [showInstanzManagerModal, setShowInstanzManagerModal] = useState(false);
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
  const dropdownWf = visibleWf.some((w) => w.id === activeWfId) || !activeWf ? visibleWf : [...visibleWf, activeWf].sort((a, b) => a.datum.localeCompare(b.datum));

  function buildBasisaenderungen(rowsByEnv, basisRows) {
    const map = {};
    basisRows.forEach((row) => {
      if (!map[row.wartungsfensterId]) map[row.wartungsfensterId] = {};
      map[row.wartungsfensterId][row.servergruppeId] = {
        jdkVersionAlt: row.jdkVersionAlt || "",
        jdkVersionNeu: row.jdkVersionNeu || "",
        jdkAufNeuerVersion: !!row.jdkAufNeuerVersion,
        eapVersion: row.eapVersion || "",
        ojdbcVersion: row.ojdbcVersion || "",
        eingespielt: !!row.eingespielt,
      };
    });
    return map;
  }

  // Basisänderung schreibt sich fort: gilt ab dem Fenster, in dem sie gesetzt wurde,
  // auch für alle späteren Fenster, bis sie dort erneut geändert wird (Infrastruktur-
  // Zustand wie JDK/EAP/OJDBC bleibt naturgemäß bestehen, bis er aktiv geändert wird).
  function getEffectiveBasisaenderung(sgId, targetWfId) {
    const targetIdx = sortedWf.findIndex((w) => w.id === targetWfId);
    for (let i = targetIdx; i >= 0; i--) {
      const wf = sortedWf[i];
      const entry = basisaenderungen[wf.id]?.[sgId];
      if (entry) return { ...entry, effectiveFromWf: wf, explicitHere: wf.id === targetWfId };
    }
    return { ...EMPTY_BASIS, effectiveFromWf: null, explicitHere: false };
  }

  // Bugfix gilt IMMER NUR für das Fenster, in dem er eingetragen wurde - keine
  // Fortschreibung mehr. Direkter Lookup: welcher Bugfix (falls vorhanden) betrifft
  // diese Instanz in genau diesem Fenster?
  function findBugfixMatch(instanzId, wfId) {
    for (const bf of bugfixe) {
      if (bf.wartungsfensterId !== wfId) continue;
      const bi = bf.instanzen.find((i) => i.instanzId === instanzId);
      if (bi) return { bugfix: bf, bi };
    }
    return null;
  }
  function getZu(sg, wfId) {
    const match = findBugfixMatch(sg.instanzId, wfId);
    if (!match) return { ...EMPTY_ZU };
    return {
      bugfixNr: match.bugfix.bugfixNr || "",
      nexusLink: match.bugfix.nexusLink || "",
      properties: match.bi.properties || "nein",
      bemerkung: match.bi.bemerkung || "",
      eingespielt: !!match.bi.eingespielt,
      colors: match.bi.colors || {},
      bugfixId: match.bugfix.id,
      bugfixInstanzId: match.bi.id,
    };
  }

  async function ladeAllesVomServer() {
    setLoading(true);
    setLoadError(null);
    try {
      const [domainsRes, sgRes, wfRes, basisRes, bugfixRes] = await Promise.all([
        api.getDomaenen(),
        api.getServergruppen(),
        api.getWartungsfenster(),
        api.getBasisaenderungen(),
        api.getBugfixe(),
      ]);
      const byEnv = {};
      ALL_ENV_KEYS.forEach((env) => (byEnv[env] = []));
      sgRes.forEach((sg) => {
        if (byEnv[sg.umgebungCode]) byEnv[sg.umgebungCode].push(sg);
      });
      setDomains(domainsRes);
      setServergruppen(byEnv);
      setWartungsfenster(wfRes);
      setBasisaenderungen(buildBasisaenderungen(byEnv, basisRes));
      setBugfixe(bugfixRes);
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

  /* ------------------- Bugfix: erfassen / bearbeiten / löschen / verschieben ------------------- */

  async function createBugfix(payload) {
    try {
      const created = await api.createBugfix(payload);
      setBugfixe((prev) => [...prev, created]);
    } catch (e) {
      console.error(e);
      window.alert("Bugfix konnte nicht angelegt werden: " + e.message);
    }
  }

  function replaceBugfixInState(updated) {
    setBugfixe((prev) => prev.map((bf) => (bf.id === updated.id ? updated : bf)));
  }

  async function saveBugfixHeader(bugfixId, headerPayload) {
    const updated = await api.updateBugfix(bugfixId, headerPayload);
    replaceBugfixInState(updated);
  }

  async function saveBugfixInstanzRow(bugfixInstanzId, bugfixId, rowPayload) {
    await api.updateBugfixInstanz(bugfixInstanzId, rowPayload);
    setBugfixe((prev) =>
      prev.map((bf) => {
        if (bf.id !== bugfixId) return bf;
        return { ...bf, instanzen: bf.instanzen.map((bi) => (bi.id === bugfixInstanzId ? { ...bi, ...rowPayload } : bi)) };
      })
    );
  }

  // Konsolidiertes Markieren als "eingespielt" - kann Bugfix, Basisänderung oder beides
  // betreffen, je nachdem was im Modal gewählt wurde. Bewusst ohne Sicherheitsabfrage,
  // da die Auswahl im Modal selbst schon die bewusste Bestätigung ist.
  async function markEingespielt(sg, zu, basis, wahl) {
    try {
      if ((wahl === "bugfix" || wahl === "beides") && zu.bugfixInstanzId) {
        await saveBugfixInstanzRow(zu.bugfixInstanzId, zu.bugfixId, { properties: zu.properties, bemerkung: zu.bemerkung, eingespielt: true, colors: zu.colors });
      }
      if ((wahl === "basis" || wahl === "beides") && hasBasisaenderungEntry(basis)) {
        await saveBasisaenderungRow(sg.id, activeWfId, { ...basis, eingespielt: true });
      }
    } catch (e) {
      console.error(e);
      window.alert("Konnte nicht gespeichert werden.");
    }
  }

  function updateBemerkungInline(sg, value) {
    const zu = getZu(sg, activeWfId);
    if (!zu.bugfixInstanzId) return; // ohne bestehenden Bugfix gibt es hier nichts zu editieren
    // Optimistisches lokales Update, damit Tippen nicht ruckelt
    setBugfixe((prev) =>
      prev.map((bf) => {
        if (bf.id !== zu.bugfixId) return bf;
        return { ...bf, instanzen: bf.instanzen.map((bi) => (bi.id === zu.bugfixInstanzId ? { ...bi, bemerkung: value } : bi)) };
      })
    );
    debouncedPersist(`bemerkung-${zu.bugfixInstanzId}`, () => {
      api.updateBugfixInstanz(zu.bugfixInstanzId, { properties: zu.properties, bemerkung: value, eingespielt: zu.eingespielt, colors: zu.colors }).catch((e) => console.error(e));
    });
  }

  async function deleteBugfixInstanzRow(bugfixInstanzId) {
    await api.deleteBugfixInstanz(bugfixInstanzId);
    setBugfixe((prev) =>
      prev
        .map((bf) => ({ ...bf, instanzen: bf.instanzen.filter((bi) => bi.id !== bugfixInstanzId) }))
        .filter((bf) => bf.instanzen.length > 0)
    );
  }

  async function deleteWholeBugfix(bugfixId) {
    await api.deleteBugfix(bugfixId);
    setBugfixe((prev) => prev.filter((bf) => bf.id !== bugfixId));
  }

  async function moveBugfix(bugfixId, zielWfId) {
    try {
      const updated = await api.moveBugfix(bugfixId, zielWfId);
      replaceBugfixInState(updated);
    } catch (e) {
      console.error(e);
      window.alert("Bugfix konnte nicht verschoben werden.");
    }
  }

  /* ------------------- Basisänderung ------------------- */

  async function saveBasisaenderungRow(sgId, wfId, payload) {
    const saved = await api.saveBasisaenderung(sgId, wfId, payload);
    setBasisaenderungen((prev) => ({
      ...prev,
      [wfId]: { ...(prev[wfId] || {}), [sgId]: { jdkVersionAlt: saved.jdkVersionAlt, jdkVersionNeu: saved.jdkVersionNeu, jdkAufNeuerVersion: saved.jdkAufNeuerVersion, eapVersion: saved.eapVersion, ojdbcVersion: saved.ojdbcVersion, eingespielt: saved.eingespielt } },
    }));
  }

  async function applyBasisaenderungToAll(payload) {
    try {
      const aktualisiert = await api.bulkSetBasisaenderung(activeWfId, payload);
      setBasisaenderungen((prev) => {
        const next = { ...prev, [activeWfId]: { ...(prev[activeWfId] || {}) } };
        aktualisiert.forEach((row) => {
          next[activeWfId][row.servergruppeId] = {
            jdkVersionAlt: row.jdkVersionAlt,
            jdkVersionNeu: row.jdkVersionNeu,
            jdkAufNeuerVersion: row.jdkAufNeuerVersion,
            eapVersion: row.eapVersion,
            ojdbcVersion: row.ojdbcVersion,
            eingespielt: row.eingespielt,
          };
        });
        return next;
      });
    } catch (e) {
      console.error(e);
      window.alert("Basisänderung konnte nicht auf alle Instanzen angewendet werden. Ist das Backend erreichbar?");
    }
  }

  /* ------------------- Domänen ------------------- */

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

  /* ------------------- Servergruppen / Instanzen ------------------- */

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
        jdkAufNeuerVersion: sgData.jdkAufNeuerVersion,
      });
      setServergruppen((prev) => {
        const next = { ...prev };
        created.forEach((sg) => {
          next[sg.umgebungCode] = [...(next[sg.umgebungCode] || []), sg];
        });
        return next;
      });
      // Basisänderung neu laden, da das Backend beim Anlegen automatisch einen Eintrag übernimmt
      const basisRes = await api.getBasisaenderungen();
      setBasisaenderungen((prevMap) => buildBasisaenderungen(null, basisRes));
    } catch (e) {
      console.error(e);
      window.alert("Instanz konnte nicht angelegt werden. Ist das Backend erreichbar?");
    }
  }

  async function deleteServergruppe(env, sgId) {
    const sg = servergruppen[env]?.find((s) => s.id === sgId);
    if (!window.confirm(`${sg?.name || "Diese Instanz"} in ${env} wirklich löschen?`)) return;
    try {
      await api.deleteServergruppe(sgId);
      setServergruppen((prev) => ({ ...prev, [env]: prev[env].filter((s) => s.id !== sgId) }));
    } catch (e) {
      console.error(e);
      window.alert("Instanz konnte nicht gelöscht werden.");
    }
  }

  /* ------------------- Wartungsfenster ------------------- */

  async function addWartungsfenster({ datum, atlasRelease, nummer }) {
    try {
      const wf = await api.createWartungsfenster({ datum, atlasRelease, nummer });
      setWartungsfenster((prev) => [...prev, wf]);
      setActiveWfId(wf.id);
    } catch (e) {
      console.error(e);
      window.alert(e.message?.includes("409") || e.message?.includes("bereits vergeben") ? "Diese Wartungsfenster-Nummer ist bereits vergeben. Bitte eine andere wählen." : "Wartungsfenster konnte nicht angelegt werden. Ist das Backend erreichbar?");
    }
  }

  async function deleteWartungsfenster(id) {
    const wf = wartungsfenster.find((w) => w.id === id);
    if (!window.confirm(`${wfShortLabel(wf)} wirklich unwiderruflich löschen? Alle darin erfassten Bugfixe und Basisänderungen gehen verloren.`)) return;
    try {
      await api.deleteWartungsfenster(id);
      setWartungsfenster((prev) => prev.filter((w) => w.id !== id));
      setBugfixe((prev) => prev.filter((bf) => bf.wartungsfensterId !== id));
      setBasisaenderungen((prev) => {
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

  /* ------------------- Darstellung ------------------- */

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
    if (c.key === "basisaenderung") return basisaenderungText(getEffectiveBasisaenderung(sg.id, activeWfId));
    if (c.group === "stamm") return sg[c.key] || "";
    if (c.key === "properties") return zu.properties === "ja" ? "JA" : "NEIN";
    if (c.key === "bugfixNr") return formatBf(zu.bugfixNr);
    return zu[c.key] || "";
  }

  const activeFilterCount = Object.values(columnFilters).filter((v) => v && v.trim()).length;

  const filteredRows = rows.filter((sg) => {
    const zu = getZu(sg, activeWfId);
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
    einspielung: rows.filter((sg) => hasEinspielung(getZu(sg, activeWfId))).length,
    eingespielt: rows.filter((sg) => getZu(sg, activeWfId).eingespielt).length,
  };

  const domainGroups = useMemo(() => {
    const groups = domains.map((d) => ({ id: d.id, name: d.name, rows: filteredRows.filter((r) => r.domainId === d.id) }));
    const ohne = filteredRows.filter((r) => !r.domainId || !domains.some((d) => d.id === r.domainId));
    groups.push({ id: null, name: "Ohne Domäne", rows: ohne });
    return groups.filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, domains]);

  // Alle bekannten Instanzen (Name + ID), global über alle Umgebungen hinweg - für die
  // Mehrfachauswahl beim Anlegen eines Bugfix.
  const alleInstanzen = useMemo(() => {
    const seen = new Map();
    Object.values(servergruppen)
      .flat()
      .forEach((sg) => {
        if (sg.instanzId && !seen.has(sg.instanzId)) seen.set(sg.instanzId, { id: sg.instanzId, name: sg.name });
      });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [servergruppen]);

  function exportToExcel() {
    const headerRow = ["Domäne", ...COLUMNS.map((c) => c.label), "Eingespielt"];
    const dataRows = domainGroups.flatMap((group) =>
      group.rows.map((sg) => {
        const zu = getZu(sg, activeWfId);
        return [
          group.name,
          ...COLUMNS.map((c) => {
            if (c.key === "basisaenderung") {
              const basis = getEffectiveBasisaenderung(sg.id, activeWfId);
              const text = basisaenderungText(basis);
              return text ? `${text}${basis.eingespielt ? " (eingespielt)" : ""}` : "";
            }
            if (c.group === "stamm") return sg[c.key] || "";
            if (c.key === "properties") return zu.properties === "ja" ? "JA" : "NEIN";
            if (c.key === "bugfixNr") return formatBf(zu.bugfixNr);
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
      {loading && <div className="bg-slate-100 text-slate-500 text-sm text-center py-2 border-b border-slate-200">Daten werden vom Server geladen…</div>}
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
          <button onClick={() => setShowDomainModal(true)} className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition">
            <Layers size={16} /> Domänen verwalten
          </button>
          <button onClick={() => setShowBasisaenderungModal(true)} className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition">
            <Cpu size={16} /> Basisänderung erfassen
          </button>
          <button onClick={() => setShowInstanzManagerModal(true)} className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition" title="Instanzen anlegen oder komplett löschen">
            <Boxes size={16} /> Instanzen verwalten
          </button>
          <button onClick={() => setShowBugfixModal(true)} className="bg-[#F2A541] hover:brightness-95 text-[#0F4C5C] font-medium text-sm px-3 py-2 rounded-md flex items-center gap-2 transition">
            <Plus size={16} /> Bugfix erfassen
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
          <button onClick={exportToExcel} className="text-xs text-slate-600 border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition">
            <Download size={13} /> Export zu Excel
          </button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
            <CalendarClock size={15} className="text-slate-500" />
            <select value={activeWfId} onChange={(e) => setActiveWfId(Number(e.target.value))} className="bg-transparent text-sm outline-none text-slate-700">
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
          <button onClick={() => setShowNewWfModal(true)} className="text-xs text-[#0F4C5C] border border-[#0F4C5C]/30 hover:bg-[#0F4C5C]/5 px-2 py-1.5 rounded-md flex items-center gap-1 transition">
            <Plus size={13} /> Wartungsfenster
          </button>
          {archivedWf.length > 0 && (
            <button onClick={() => setShowArchiveModal(true)} className="text-xs text-slate-500 border border-slate-300 hover:bg-slate-50 px-2 py-1.5 rounded-md flex items-center gap-1 transition" title="Ältere Wartungsfenster ansehen">
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
                <th key={c.key} className={`sticky top-0 text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${c.group === "bugfix" ? "bg-amber-50" : "bg-slate-100"}`}>
                  {c.label}
                </th>
              ))}
              <th className="sticky top-0 bg-slate-100 px-3 py-2 border-b border-slate-200 text-center w-56">Aktionen</th>
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
                  const zu = getZu(sg, activeWfId);
                  const basis = getEffectiveBasisaenderung(sg.id, activeWfId);
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
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className="px-1 py-1 border-b border-slate-100 max-w-[110px]">
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
                          const tooltip = vorlagen && vorlagen.length > 0 ? `Artefakt-Vorlage(n):\n${vorlagen.map((v) => `• ${v}`).join("\n")}` : "Keine Artefakt-Vorlage hinterlegt";
                          return (
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className="px-3 py-2 border-b border-slate-100 max-w-[200px]">
                              <FastTooltip text={tooltip}>
                                <span className="block truncate cursor-help">{sg.name || <span className="text-slate-300">—</span>}</span>
                              </FastTooltip>
                            </td>
                          );
                        }
                        if (c.key === "basisaenderung") {
                          const text = basisaenderungText(basis);
                          return (
                            <td key={c.key} className={`px-3 py-2 border-b border-slate-100 max-w-[200px] truncate ${basis.eingespielt ? "bg-green-50 text-green-700 font-medium" : ""}`}>
                              {text || <span className="text-slate-300">—</span>}
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
                              {zu.bugfixInstanzId ? (
                                <input
                                  value={zu.bemerkung}
                                  onChange={(e) => updateBemerkungInline(sg, e.target.value)}
                                  placeholder="Bemerkung eintragen…"
                                  className="w-full bg-transparent px-2 py-1.5 text-xs rounded-md outline-none hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#0F4C5C]"
                                />
                              ) : (
                                <span className="px-2 text-slate-300">—</span>
                              )}
                            </td>
                          );
                        }
                        if (c.key === "bugfixNr") {
                          return (
                            <td key={c.key} style={cellStyleBugfix(c.key, zu)} className={`px-3 py-2 border-b border-slate-100 ${c.width || "max-w-[200px]"} truncate font-mono text-[11px]`}>
                              {formatBf(zu.bugfixNr) || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        }
                        if (c.key === "nexusLink") {
                          return (
                            <td key={c.key} style={cellStyleBugfix(c.key, zu)} className={`px-3 py-2 border-b border-slate-100 ${c.width || "max-w-[300px]"}`}>
                              {zu.nexusLink ? (
                                <div className="flex items-start gap-1.5">
                                  <span className="font-mono text-[11px] whitespace-normal break-all">{zu.nexusLink}</span>
                                  <button type="button" onClick={() => navigator.clipboard?.writeText(zu.nexusLink)} title="Link kopieren" className="shrink-0 text-slate-300 hover:text-[#0F4C5C] transition mt-0.5">
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} style={cellStyleBugfix(c.key, zu)} className={`px-3 py-2 border-b border-slate-100 ${c.width || "max-w-[200px]"} truncate ${c.mono ? "font-mono text-[11px]" : ""}`}>
                            {c.key === "properties" ? (zu.properties === "ja" ? "JA" : "NEIN") : zu[c.key] || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 border-b border-slate-100">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => zu.bugfixInstanzId && setEditBugfixFor({ sg, zu })}
                            disabled={!zu.bugfixInstanzId}
                            title={zu.bugfixInstanzId ? "Bugfix bearbeiten" : "Noch kein Bugfix erfasst"}
                            className={zu.bugfixInstanzId ? "text-slate-400 hover:text-[#0F4C5C] transition" : "text-slate-200 cursor-not-allowed"}
                          >
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setHistoryFor({ sg })} title="Verlauf anzeigen" className="text-slate-400 hover:text-[#0F4C5C] transition">
                            <History size={14} />
                          </button>
                          <button onClick={() => setEditBasis({ env: activeEnv, sg })} title="Stammdaten bearbeiten" className="text-slate-400 hover:text-[#0F4C5C] transition">
                            <Settings2 size={14} />
                          </button>
                          <button
                            onClick={() => zu.bugfixId && setTransferFor({ bugfixId: zu.bugfixId, sg })}
                            disabled={!zu.bugfixId || wartungsfenster.length < 2}
                            title={!zu.bugfixId ? "Kein Bugfix zum Übertragen vorhanden" : "Bugfix in anderes Wartungsfenster übertragen"}
                            className={`transition ${!zu.bugfixId || wartungsfenster.length < 2 ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-[#0F4C5C]"}`}
                          >
                            <ArrowRightCircle size={14} />
                          </button>
                          <button
                            onClick={() => (zu.bugfixInstanzId || hasBasisaenderungEntry(basis)) && setEingespieltFor({ sg, zu, basis })}
                            disabled={!zu.bugfixInstanzId && !hasBasisaenderungEntry(basis)}
                            title={
                              !zu.bugfixInstanzId && !hasBasisaenderungEntry(basis)
                                ? "Erst möglich, wenn ein Bugfix oder eine Basisänderung eingetragen ist"
                                : "Als eingespielt markieren"
                            }
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition flex items-center gap-1 ${
                              !zu.bugfixInstanzId && !hasBasisaenderungEntry(basis)
                                ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                : (!zu.bugfixInstanzId || zu.eingespielt) && (!hasBasisaenderungEntry(basis) || basis.eingespielt)
                                ? "bg-green-600 border-green-600 text-white"
                                : "bg-white border-slate-300 text-slate-500 hover:border-green-400"
                            }`}
                          >
                            <CheckCircle2 size={11} />
                            Eingespielt
                          </button>
                          <button
                            onClick={() => zu.bugfixInstanzId && setDeleteBugfixFor({ sg, zu })}
                            disabled={!zu.bugfixInstanzId}
                            title={zu.bugfixInstanzId ? "Bugfix löschen" : "Kein Bugfix vorhanden"}
                            className={zu.bugfixInstanzId ? "text-slate-300 hover:text-[#DC2626] transition" : "text-slate-200 cursor-not-allowed"}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button onClick={() => deleteServergruppe(activeEnv, sg.id)} title="Diese Instanz in dieser Umgebung löschen" className="text-slate-300 hover:text-[#DC2626] transition">
                            <X size={14} />
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

      {editBugfixFor && (
        <BugfixEditModal
          sg={editBugfixFor.sg}
          zu={editBugfixFor.zu}
          activeWf={activeWf}
          onClose={() => setEditBugfixFor(null)}
          onSave={async (headerPayload, rowPayload) => {
            try {
              await saveBugfixHeader(editBugfixFor.zu.bugfixId, headerPayload);
              await saveBugfixInstanzRow(editBugfixFor.zu.bugfixInstanzId, editBugfixFor.zu.bugfixId, rowPayload);
              setEditBugfixFor(null);
            } catch (e) {
              console.error(e);
              window.alert("Änderungen konnten nicht gespeichert werden.");
            }
          }}
        />
      )}

      {editBasis && (
        <BasisModal
          env={editBasis.env}
          sg={editBasis.sg}
          domains={domains}
          activeWf={activeWf}
          initialBasis={getEffectiveBasisaenderung(editBasis.sg.id, activeWfId)}
          onClose={() => setEditBasis(null)}
          onSave={async (updated, basisPayload) => {
            saveBasis(editBasis.env, updated);
            try {
              await saveBasisaenderungRow(editBasis.sg.id, activeWfId, basisPayload);
            } catch (e) {
              console.error(e);
            }
            setEditBasis(null);
          }}
        />
      )}

      {historyFor && <HistoryModal sg={historyFor.sg} sortedWf={sortedWf} bugfixe={bugfixe} onClose={() => setHistoryFor(null)} />}

      {transferFor && (
        <TransferModal
          sg={transferFor.sg}
          activeWf={activeWf}
          sortedWf={sortedWf}
          onTransfer={async (zielWfId) => {
            await moveBugfix(transferFor.bugfixId, zielWfId);
            setTransferFor(null);
          }}
          onClose={() => setTransferFor(null)}
        />
      )}

      {deleteBugfixFor && (
        <DeleteBugfixModal
          sg={deleteBugfixFor.sg}
          zu={deleteBugfixFor.zu}
          onDeleteRow={async () => {
            await deleteBugfixInstanzRow(deleteBugfixFor.zu.bugfixInstanzId);
            setDeleteBugfixFor(null);
          }}
          onDeleteAll={async () => {
            await deleteWholeBugfix(deleteBugfixFor.zu.bugfixId);
            setDeleteBugfixFor(null);
          }}
          onClose={() => setDeleteBugfixFor(null)}
        />
      )}

      {eingespieltFor && (
        <EingespieltModal
          hasBugfix={!!eingespieltFor.zu.bugfixInstanzId}
          hasBasis={hasBasisaenderungEntry(eingespieltFor.basis)}
          onChoose={async (wahl) => {
            await markEingespielt(eingespieltFor.sg, eingespieltFor.zu, eingespieltFor.basis, wahl);
            setEingespieltFor(null);
          }}
          onClose={() => setEingespieltFor(null)}
        />
      )}

      {showInstanzManagerModal && (
        <InstanzManagerModal
          servergruppen={servergruppen}
          onDeleteEverywhere={async (name) => {
            if (!window.confirm(`Instanz "${name}" wirklich in ALLEN Umgebungen löschen?`)) return;
            const targets = [];
            Object.entries(servergruppen).forEach(([env, rows]) => rows.forEach((sg) => sg.name === name && targets.push({ env, id: sg.id })));
            try {
              await Promise.all(targets.map((t) => api.deleteServergruppe(t.id)));
              setServergruppen((prev) => {
                const next = { ...prev };
                targets.forEach((t) => {
                  next[t.env] = next[t.env].filter((sg) => sg.id !== t.id);
                });
                return next;
              });
            } catch (e) {
              console.error(e);
              window.alert("Instanz konnte nicht überall gelöscht werden.");
            }
          }}
          onOpenNew={() => {
            setShowInstanzManagerModal(false);
            setShowNewSgModal(true);
          }}
          onClose={() => setShowInstanzManagerModal(false)}
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
        <BugfixCreateModal
          activeWf={activeWf}
          dropdownWf={dropdownWf}
          alleInstanzen={alleInstanzen}
          onClose={() => setShowBugfixModal(false)}
          onSubmit={async (payload) => {
            await createBugfix(payload);
            setShowBugfixModal(false);
          }}
        />
      )}

      {showNewWfModal && (
        <NewWartungsfensterModal
          nextNummer={String(Math.max(0, ...wartungsfenster.map((w) => parseInt(w.nummer, 10) || 0)) + 1).padStart(2, "0")}
          onClose={() => setShowNewWfModal(false)}
          onSubmit={(data) => {
            addWartungsfenster(data);
            setShowNewWfModal(false);
          }}
        />
      )}

      {showDomainModal && (
        <DomainManagerModal domains={domains} servergruppen={servergruppen} onAdd={addDomain} onRename={renameDomain} onDelete={deleteDomain} onClose={() => setShowDomainModal(false)} />
      )}

      {showBasisaenderungModal && (
        <BasisaenderungBulkModal
          activeWf={activeWf}
          onClose={() => setShowBasisaenderungModal(false)}
          onSubmit={async (payload) => {
            await applyBasisaenderungToAll(payload);
            setShowBasisaenderungModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Modal: Neue Servergruppe/Instanz (Stammdaten, Mehrfachumgebung + Domäne je Umgebung)
--------------------------------------------------------- */

function NewServergruppeModal({ defaultEnv, domains, onAddDomain, onClose, onSubmit }) {
  const [selectedEnvs, setSelectedEnvs] = useState(() => new Set([defaultEnv]));
  const [masterDomainId, setMasterDomainId] = useState(null);
  const [domainByEnv, setDomainByEnv] = useState({});
  const [newDomainName, setNewDomainName] = useState("");
  const [jdkAufNeuerVersion, setJdkAufNeuerVersion] = useState(false);
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
    onSubmit(Array.from(selectedEnvs), { ...form, artefaktVorlagen: form.artefaktVorlagen.filter((v) => v && v.trim()), domainIdByUmgebung, jdkAufNeuerVersion });
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
                <label key={g.key} className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer transition ${selectedEnvs.has(g.key) ? "border-[#0F4C5C]/40 bg-[#0F4C5C]/5 text-slate-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
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
                    <label key={s.key} className={`flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 cursor-pointer transition ${selectedEnvs.has(s.key) ? "border-amber-400 bg-white text-slate-700" : "border-amber-200/70 text-slate-600 hover:bg-white/60"}`}>
                      <input type="checkbox" checked={selectedEnvs.has(s.key)} onChange={() => toggleEnv(s.key)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedEnvs.size === 0 && <p className="text-xs text-[#DC2626] mt-1">Bitte mindestens eine Umgebung auswählen.</p>}
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
                  <DomainSelect domains={domains} value={domainByEnv[env] ?? null} onChange={(v) => setDomainByEnv((prev) => ({ ...prev, [env]: v }))} />
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
        <Field label="Basisänderung">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={jdkAufNeuerVersion} onChange={(e) => setJdkAufNeuerVersion(e.target.checked)} />
            Läuft bereits auf der neueren Java-Version
          </label>
          <p className="text-xs text-slate-400 mt-1">JDK-/EAP-/OJDBC-Version werden automatisch von der zuletzt erfassten Basisänderung übernommen und können danach über "Stammdaten bearbeiten" angepasst werden.</p>
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
   Modal: Stammdaten bearbeiten (inkl. Basisänderung für aktives Fenster)
--------------------------------------------------------- */

function BasisModal({ env, sg, domains, activeWf, initialBasis, onClose, onSave }) {
  const [form, setForm] = useState({ ...sg, colors: { ...sg.colors }, artefaktVorlagen: sg.artefaktVorlagen && sg.artefaktVorlagen.length > 0 ? sg.artefaktVorlagen : [""] });
  const [basis, setBasis] = useState({ ...initialBasis });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function setBasisField(key, val) {
    setBasis((b) => ({ ...b, [key]: val }));
  }

  return (
    <Modal title={`Stammdaten bearbeiten — ${env} / ${sg.name || sg.jbossAdmin || sg.id}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, artefaktVorlagen: form.artefaktVorlagen.filter((v) => v && v.trim()) }, basis);
        }}
      >
        <Field label="Domäne">
          <DomainSelect domains={domains} value={form.domainId} onChange={(v) => set("domainId", v)} />
        </Field>
        {COLUMNS.filter((c) => c.group === "stamm" && c.key !== "basisaenderung").map((c) => (
          <React.Fragment key={c.key}>
            <Field label={c.label}>
              <input className={inputCls} value={form[c.key] || ""} onChange={(e) => set(c.key, e.target.value)} />
            </Field>
            {c.key === "name" && (
              <Field label="Artefakt-Namensvorlage(n)">
                <ArtefaktVorlagenEditor value={form.artefaktVorlagen} onChange={(v) => set("artefaktVorlagen", v)} />
              </Field>
            )}
          </React.Fragment>
        ))}

        <Field label={`Basisänderung — gilt ab ${wfShortLabel(activeWf)}`}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={inputCls} placeholder="JDK-Version aktuell (z. B. 17.0.x)" value={basis.jdkVersionAlt || ""} onChange={(e) => setBasisField("jdkVersionAlt", e.target.value)} />
            <input className={inputCls} placeholder="JDK-Version neu (z. B. 21.0.x)" value={basis.jdkVersionNeu || ""} onChange={(e) => setBasisField("jdkVersionNeu", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={!!basis.jdkAufNeuerVersion} onChange={(e) => setBasisField("jdkAufNeuerVersion", e.target.checked)} />
            Läuft bereits auf der neueren Java-Version
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={inputCls} placeholder="EAP-Version (z. B. 8.1.x)" value={basis.eapVersion || ""} onChange={(e) => setBasisField("eapVersion", e.target.value)} />
            <input className={inputCls} placeholder="OJDBC-Version (z. B. 19.xx)" value={basis.ojdbcVersion || ""} onChange={(e) => setBasisField("ojdbcVersion", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!basis.eingespielt} onChange={(e) => setBasisField("eingespielt", e.target.checked)} />
            Eingespielt (Spalte wird grün markiert)
          </label>
          {basis.effectiveFromWf && !basis.explicitHere && (
            <p className="text-xs text-slate-400 mt-1">Übernommen aus {wfShortLabel(basis.effectiveFromWf)}. Speichern legt einen eigenen Stand ab {wfShortLabel(activeWf)} an.</p>
          )}
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
   Modal: Bugfix bearbeiten (Header gilt für alle Instanzen darunter,
   Bemerkung/Properties/Eingespielt nur für diese Zeile)
--------------------------------------------------------- */

function BugfixEditModal({ sg, zu, activeWf, onClose, onSave }) {
  const [bugfixNr, setBugfixNr] = useState(zu.bugfixNr);
  const [nexusLink, setNexusLink] = useState(zu.nexusLink);
  const [properties, setProperties] = useState(zu.properties);
  const [bemerkung, setBemerkung] = useState(zu.bemerkung);
  const [eingespielt, setEingespielt] = useState(zu.eingespielt);

  return (
    <Modal title={`Bugfix bearbeiten — ${sg.name || sg.jbossAdmin || sg.id} · ${wfShortLabel(activeWf)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ bugfixNr, nexusLink }, { properties, bemerkung, eingespielt, colors: zu.colors });
        }}
      >
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Bugfixnummer und Nexus Link gelten für <strong>alle</strong> Instanzen, die zu diesem Bugfix gehören — eine Änderung hier wirkt sich auf alle davon aus. Bemerkung,
          Properties und Eingespielt-Status gelten nur für diese Instanz.
        </p>
        <Field label="Bugfixnummer">
          <input required className={inputCls} placeholder="z. B. 42" value={bugfixNr} onChange={(e) => setBugfixNr(e.target.value)} />
        </Field>
        <Field label="Nexus Link">
          <input className={inputCls} value={nexusLink} onChange={(e) => setNexusLink(e.target.value)} />
        </Field>
        <Field label="Bemerkung (nur diese Instanz)">
          <input className={inputCls} value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </Field>
        <Field label="Property einspielen (nur diese Instanz)">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="props-edit" checked={properties === "ja"} onChange={() => setProperties("ja")} />
              Ja
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="props-edit" checked={properties === "nein"} onChange={() => setProperties("nein")} />
              Nein
            </label>
          </div>
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={eingespielt} onChange={(e) => setEingespielt(e.target.checked)} />
            Eingespielt (Zeile wird grün markiert)
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
   Modal: Bugfix erfassen (1-n Instanzen auf einmal auswählbar)
--------------------------------------------------------- */

function BugfixCreateModal({ activeWf, dropdownWf, alleInstanzen, onClose, onSubmit }) {
  const [wartungsfensterId, setWartungsfensterId] = useState(activeWf?.id ?? "");
  const [bugfixNr, setBugfixNr] = useState("");
  const [nexusLink, setNexusLink] = useState("");
  const [bemerkung, setBemerkung] = useState("");
  const [properties, setProperties] = useState("nein");
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  function toggleInstanz(name) {
    setAusgewaehlt((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (ausgewaehlt.size === 0 || !wartungsfensterId) return;
    setSubmitting(true);
    await onSubmit({ wartungsfensterId, bugfixNr, nexusLink, bemerkung, properties, instanzNamen: Array.from(ausgewaehlt) });
    setSubmitting(false);
  }

  return (
    <Modal title="Bugfix erfassen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Wartungsfenster">
          <select className={inputCls} value={wartungsfensterId} onChange={(e) => setWartungsfensterId(Number(e.target.value))}>
            {dropdownWf.map((w) => (
              <option key={w.id} value={w.id}>
                {wfFullLabel(w)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Betroffene Instanzen (1-n)">
          <div className="border border-slate-200 rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
            {alleInstanzen.length === 0 && <p className="text-sm text-slate-400">Noch keine Instanzen angelegt.</p>}
            {alleInstanzen.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={ausgewaehlt.has(i.name)} onChange={() => toggleInstanz(i.name)} />
                {i.name}
              </label>
            ))}
          </div>
          {ausgewaehlt.size === 0 && <p className="text-xs text-[#DC2626] mt-1">Bitte mindestens eine Instanz auswählen.</p>}
          <p className="text-xs text-slate-400 mt-1">Gilt jeweils automatisch in jeder Umgebung, in der die gewählte Instanz vorkommt.</p>
        </Field>
        <Field label="Bugfixnummer">
          <input required className={inputCls} placeholder="z. B. 42" value={bugfixNr} onChange={(e) => setBugfixNr(e.target.value)} />
        </Field>
        <Field label="Nexus Link">
          <input className={inputCls} placeholder="https://nexus.internal/repo/..." value={nexusLink} onChange={(e) => setNexusLink(e.target.value)} />
        </Field>
        <Field label="Bemerkung">
          <input className={inputCls} value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </Field>
        <Field label="Property einspielen">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="props-quick" checked={properties === "ja"} onChange={() => setProperties("ja")} />
              Ja
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="props-quick" checked={properties === "nein"} onChange={() => setProperties("nein")} />
              Nein
            </label>
          </div>
          {properties === "ja" && <p className="text-xs text-[#DC2626] mt-1">Die Spalte "Properties" wird rot markiert.</p>}
        </Field>
        <p className="text-xs text-slate-400 mb-3">Gilt ausschließlich für das gewählte Wartungsfenster — keine automatische Übernahme in andere.</p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
          <button type="submit" disabled={submitting || ausgewaehlt.size === 0} className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 disabled:opacity-50">
            {submitting ? "Wird gespeichert…" : "Bugfix speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Bugfix in ein anderes Wartungsfenster übertragen (auch rückwärts)
--------------------------------------------------------- */

function TransferModal({ sg, activeWf, sortedWf, onTransfer, onClose }) {
  const auswahl = sortedWf.filter((w) => w.id !== activeWf?.id);
  const [zielWfId, setZielWfId] = useState(auswahl[0]?.id ?? "");

  return (
    <Modal title={`Bugfix übertragen — ${sg.name || sg.jbossAdmin || sg.id}`} onClose={onClose}>
      <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
        Verschiebt den kompletten Bugfix (mit <strong>allen</strong> zugehörigen Instanzen) von <strong>{wfShortLabel(activeWf)}</strong> in das gewählte Wartungsfenster — auch ein
        früheres ist möglich.
      </p>
      <Field label="Ziel-Wartungsfenster">
        <select className={inputCls} value={zielWfId} onChange={(e) => setZielWfId(Number(e.target.value))}>
          {auswahl.map((w) => (
            <option key={w.id} value={w.id}>
              {wfFullLabel(w)}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Abbrechen
        </button>
        <button type="button" onClick={() => zielWfId && onTransfer(zielWfId)} disabled={!zielWfId} className="px-4 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 disabled:opacity-50">
          Übertragen
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Bugfix löschen (nur diese Instanz oder komplett)
--------------------------------------------------------- */

function DeleteBugfixModal({ sg, zu, onDeleteRow, onDeleteAll, onClose }) {
  const [busy, setBusy] = useState(false);
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Bugfix löschen — ${formatBf(zu.bugfixNr)}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Dieser Bugfix betrifft eventuell noch weitere Instanzen. Möchten Sie ihn nur bei <strong>{sg.name || sg.jbossAdmin || sg.id}</strong> entfernen, oder komplett löschen (bei
        allen betroffenen Instanzen)?
      </p>
      <div className="flex flex-col gap-2">
        <button
          disabled={busy}
          onClick={() => run(onDeleteRow)}
          className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-left disabled:opacity-50"
        >
          Nur bei dieser Instanz entfernen
        </button>
        <button
          disabled={busy}
          onClick={() => run(onDeleteAll)}
          className="px-4 py-2 text-sm border border-[#DC2626]/40 text-[#DC2626] rounded-md hover:bg-red-50 text-left disabled:opacity-50"
        >
          Kompletten Bugfix löschen (alle Instanzen)
        </button>
      </div>
      <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Abbrechen
        </button>
      </div>
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
   Modal: Basisänderung erfassen (auf alle Instanzen im aktiven Fenster)
--------------------------------------------------------- */

function BasisaenderungBulkModal({ activeWf, onClose, onSubmit }) {
  const [jdkVersionAlt, setJdkVersionAlt] = useState("");
  const [jdkVersionNeu, setJdkVersionNeu] = useState("");
  const [eapVersion, setEapVersion] = useState("");
  const [ojdbcVersion, setOjdbcVersion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ jdkVersionAlt, jdkVersionNeu, eapVersion, ojdbcVersion });
    setSubmitting(false);
  }

  return (
    <Modal title={`Basisänderung erfassen — ${wfShortLabel(activeWf)}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Wird auf <strong>alle</strong> Instanzen in allen Umgebungen angewendet, gültig ab {wfShortLabel(activeWf)} (gilt automatisch auch für spätere Fenster, bis dort erneut
          geändert). Der "Eingespielt"-Status wird dabei für alle zurückgesetzt. Alle Felder sind optional.
        </p>
        <Field label="JDK-Version aktuell">
          <input className={inputCls} placeholder="z. B. 17.0.x" value={jdkVersionAlt} onChange={(e) => setJdkVersionAlt(e.target.value)} />
        </Field>
        <Field label="JDK-Version neu">
          <input className={inputCls} placeholder="z. B. 21.0.x" value={jdkVersionNeu} onChange={(e) => setJdkVersionNeu(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">Bei jeder Instanz lässt sich einzeln angeben, ob sie schon auf der neueren oder noch auf der aktuellen Version läuft.</p>
        </Field>
        <Field label="EAP-Version">
          <input className={inputCls} placeholder="z. B. 8.1.x" value={eapVersion} onChange={(e) => setEapVersion(e.target.value)} />
        </Field>
        <Field label="OJDBC-Version">
          <input className={inputCls} placeholder="z. B. 19.xx" value={ojdbcVersion} onChange={(e) => setOjdbcVersion(e.target.value)} />
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
   Modal: Wartungsfenster-Archiv
--------------------------------------------------------- */

function ArchiveModal({ archivedWf, onSelect, onDelete, onClose }) {
  const rows = [...archivedWf].sort((a, b) => b.datum.localeCompare(a.datum));
  return (
    <Modal title="Wartungsfenster-Archiv" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-4">Diese Wartungsfenster liegen weiter als die letzten 2 vergangenen zurück und werden im normalen Auswahlfeld nicht mehr angezeigt.</p>
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

/* ---------------------------------------------------------
   Modal: Verlauf einer Instanz (alle Bugfixe über alle Wartungsfenster)
--------------------------------------------------------- */

function HistoryModal({ sg, sortedWf, bugfixe, onClose }) {
  const rows = [...sortedWf]
    .reverse()
    .map((wf) => {
      let treffer = null;
      for (const bf of bugfixe) {
        if (bf.wartungsfensterId !== wf.id) continue;
        const bi = bf.instanzen.find((i) => i.instanzId === sg.instanzId);
        if (bi) {
          treffer = { bugfixNr: bf.bugfixNr, nexusLink: bf.nexusLink, properties: bi.properties, bemerkung: bi.bemerkung, eingespielt: bi.eingespielt };
          break;
        }
      }
      return { wf, treffer };
    });
  const hasAny = rows.some((r) => r.treffer);

  return (
    <Modal title={`Verlauf — ${sg.name || sg.jbossAdmin || sg.id}`} onClose={onClose} wide>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Wartungsfenster</th>
            <th className="py-2 pr-3">Datum</th>
            <th className="py-2 pr-3">Bugfix Nr</th>
            <th className="py-2 pr-3">Properties</th>
            <th className="py-2 pr-3">Nexus Link</th>
            <th className="py-2 pr-3">Bemerkung</th>
            <th className="py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ wf, treffer }) => (
            <tr key={wf.id} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-medium text-slate-700">{wfShortLabel(wf)}</td>
              <td className="py-2 pr-3 font-mono">{wf.datum}</td>
              <td className="py-2 pr-3 font-mono">{formatBf(treffer?.bugfixNr) || <span className="text-slate-300">—</span>}</td>
              <td className="py-2 pr-3">
                {treffer ? (
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${treffer.properties === "ja" ? "bg-[#DC2626] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {treffer.properties === "ja" ? "JA" : "NEIN"}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="py-2 pr-3 font-mono truncate max-w-[160px]">{treffer?.nexusLink || <span className="text-slate-300">—</span>}</td>
              <td className="py-2 pr-3">{treffer?.bemerkung || <span className="text-slate-300">—</span>}</td>
              <td className="py-2 pr-3 text-[11px]">{treffer?.eingespielt ? <span className="text-green-600 font-medium">eingespielt</span> : treffer ? <span className="text-slate-400">nicht eingespielt</span> : <span className="text-slate-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasAny && <p className="text-center text-slate-400 py-6 text-sm">Für diese Instanz wurde bisher in keinem Wartungsfenster ein Bugfix erfasst.</p>}
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Konsolidiertes "Eingespielt" - Basissystem, Bugfix oder beides
--------------------------------------------------------- */

function EingespieltModal({ hasBugfix, hasBasis, onChoose, onClose }) {
  return (
    <Modal title="Was wurde eingespielt?" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">Bitte auswählen, was tatsächlich eingespielt wurde.</p>
      <div className="flex flex-col gap-2">
        <button
          disabled={!hasBasis}
          onClick={() => onChoose("basis")}
          className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Nur Basissystem
        </button>
        <button
          disabled={!hasBugfix}
          onClick={() => onChoose("bugfix")}
          className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Nur Bugfix
        </button>
        <button
          disabled={!hasBugfix || !hasBasis}
          onClick={() => onChoose("beides")}
          className="px-4 py-2 text-sm border border-[#0F4C5C]/40 text-[#0F4C5C] rounded-md hover:bg-[#0F4C5C]/5 text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Beides
        </button>
      </div>
      <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   Modal: Instanzen verwalten - eine Instanz komplett (alle Umgebungen
   auf einmal) löschen
--------------------------------------------------------- */

function InstanzManagerModal({ servergruppen, onDeleteEverywhere, onOpenNew, onClose }) {
  const map = new Map();
  Object.entries(servergruppen).forEach(([env, rows]) => {
    rows.forEach((sg) => {
      if (!map.has(sg.name)) map.set(sg.name, []);
      map.get(sg.name).push(env);
    });
  });
  const list = Array.from(map.entries())
    .map(([name, envs]) => ({ name, envs }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal title="Instanzen verwalten" onClose={onClose} wide>
      <div className="flex justify-end mb-3">
        <button onClick={onOpenNew} className="px-3 py-2 text-sm bg-[#0F4C5C] text-white rounded-md hover:brightness-110 flex items-center gap-1.5">
          <Plus size={14} /> Neue Instanz anlegen
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Zeigt jede Instanz mit den Umgebungen, in denen sie vorkommt. "Überall löschen" entfernt die Instanz aus <strong>allen</strong> Umgebungen auf einmal. Um nur eine einzelne
        Umgebung zu entfernen, den Lösch-Button direkt in der Tabellenzeile nutzen.
      </p>
      <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {list.length === 0 && <p className="text-sm text-slate-400 px-3 py-4 text-center">Noch keine Instanzen angelegt.</p>}
        {list.map((item) => (
          <div key={item.name} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-slate-700">
              {item.name} <span className="text-slate-400 text-xs">({item.envs.length} Umgebung{item.envs.length !== 1 ? "en" : ""}: {item.envs.join(", ")})</span>
            </span>
            <button onClick={() => onDeleteEverywhere(item.name)} className="text-slate-400 hover:text-[#DC2626] shrink-0 ml-2" title="Überall löschen">
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
