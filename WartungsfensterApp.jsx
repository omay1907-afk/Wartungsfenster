import React, { useState, useMemo } from "react";
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
  { key: "jbossAdmin", label: "JBossAdmin", group: "stamm", mono: false, colorable: true },
  { key: "name", label: "Instanz", group: "stamm", mono: false, colorable: true },
  { key: "server", label: "Server", group: "stamm", mono: true, colorable: true },
  { key: "bugfixNr", label: "Bugfix Nr", group: "bugfix", mono: true, colorable: true },
  { key: "properties", label: "Properties", group: "bugfix", mono: false, colorable: false },
  { key: "nexusLink", label: "Nexus Link", group: "bugfix", mono: true, colorable: true },
  { key: "bemerkung", label: "Bemerkung", group: "bugfix", mono: false, colorable: true },
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
const EMPTY_ZUORDNUNG = { bugfixNr: "", bemerkung: "", properties: "nein", nexusLink: "", eingespielt: false, colors: {} };
const NO_DOMAIN = "__none__";

const VIEW_TABS = [
  { key: "alle", label: "Alle Instanzen" },
  { key: "einspielung", label: "Mit Einspielung" },
  { key: "eingespielt", label: "Eingespielt" },
];

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

// Leitet aus einem Datum (yyyy-mm-dd) die Standard-Bezeichnung ab, z. B. "Wartungsfenster August 2026"
function nameFromDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return `Wartungsfenster ${MONTH_NAMES_DE[d.getMonth()]} ${d.getFullYear()}`;
}

// Eingetragener Bugfix (unabhängig vom Status) -> gelbe Markierung
function hasBugfixEntry(zu) {
  return !!(zu.bugfixNr && zu.bugfixNr.trim());
}
// Irgendeine Einspielung vorhanden: nur Konfig, nur Deployment (Nexus Link/Bugfix) oder beides
function hasEinspielung(zu) {
  return zu.properties === "ja" || !!(zu.nexusLink && zu.nexusLink.trim()) || hasBugfixEntry(zu);
}

/* ---------------------------------------------------------
   Demo-/Testdaten
--------------------------------------------------------- */

const DOMAIN_ZOLL_ATLAS_ID = "dom-zoll-atlas";

function createDomains() {
  return [
    { id: DOMAIN_ZOLL_ATLAS_ID, name: "zoll-atlas-*-80" },
    { id: "dom-nord", name: "Domäne Nord" },
    { id: "dom-sued", name: "Domäne Süd" },
  ];
}

// 10 Testinstanzen, alphanumerisch sortiert. Name-Spalte bewusst leer,
// da bei diesen Testdaten nur der technische JBossAdmin-Bezeichner vorliegt.
const TEST_INSTANCE_NAMES = [
  "aks30-std",
  "atm-std",
  "bewa-std",
  "eks-std",
  "impost-std",
  "jasper-std",
  "phonetik-std",
  "riko-std",
  "stdservice-std",
  "wks-std",
];

// Bei 5 von 10 Instanzen ist ein (realistischer, 1-3-stelliger, rein numerischer) Bugfix hinterlegt:
// 2x nur Konfig, 1x nur Nexus Link (Deployment) ohne Konfig, 2x beides.
const TEST_BUGFIX_DATA = {
  "aks30-std": { bugfixNr: "42", properties: "ja", nexusLink: "" }, // nur Konfig
  "atm-std": { bugfixNr: "7", properties: "ja", nexusLink: "" }, // nur Konfig
  "bewa-std": { bugfixNr: "128", properties: "nein", nexusLink: "https://nexus.internal/repo/app-core/bewa-1.2.0" }, // nur Nexus Link
  "eks-std": { bugfixNr: "15", properties: "ja", nexusLink: "https://nexus.internal/repo/app-core/eks-1.0.3", eingespielt: true }, // beides, zusätzlich bereits eingespielt (Demo)
  "impost-std": { bugfixNr: "203", properties: "ja", nexusLink: "https://nexus.internal/repo/app-core/impost-2.1.0" }, // beides
};

function createServergruppen() {
  const data = {};
  ALL_ENV_KEYS.forEach((env) => {
    data[env] = [];
  });
  data.INT = TEST_INSTANCE_NAMES.map((name, i) => ({
    id: `INT-SG-${i + 1}`,
    jbossAdmin: "",
    name,
    server: "",
    aufrufadresse: "",
    soaEndpunkte: "",
    domainId: DOMAIN_ZOLL_ATLAS_ID,
    colors: {},
  }));
  return data;
}

function createWartungsfenster() {
  return [
    { id: "wf-1", name: "Wartungsfenster Juni 2026", datum: "2026-06-14" },
    { id: "wf-2", name: "Wartungsfenster Juli 2026", datum: "2026-07-19" },
    { id: "wf-3", name: "Wartungsfenster August 2026", datum: "2026-08-16" },
    { id: "wf-4", name: "Wartungsfenster September 2026", datum: "2026-09-20" },
  ];
}

// Nur "explizite" Änderungen werden gespeichert, alles Weitere wird zur Laufzeit
// fortgeschrieben (siehe getEffectiveZuordnung). Die Testdaten werden im ersten
// Wartungsfenster gesetzt und gelten damit automatisch auch für die späteren.
function createZuordnungen(servergruppen, wartungsfenster) {
  const sorted = [...wartungsfenster].sort((a, b) => a.datum.localeCompare(b.datum));
  const z = {};
  sorted.forEach((wf) => (z[wf.id] = {}));
  const firstWf = sorted[0];
  servergruppen.INT.forEach((sg) => {
    const bf = TEST_BUGFIX_DATA[sg.name];
    if (bf) {
      z[firstWf.id][sg.id] = {
        bugfixNr: bf.bugfixNr,
        bemerkung: "",
        properties: bf.properties,
        nexusLink: bf.nexusLink,
        eingespielt: !!bf.eingespielt,
        colors: {},
      };
    }
  });
  return z;
}

function getDefaultWfId(list) {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...list].sort((a, b) => a.datum.localeCompare(b.datum));
  const upcoming = sorted.find((w) => w.datum >= today);
  return (upcoming || sorted[sorted.length - 1])?.id;
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
    <select value={value || NO_DOMAIN} onChange={(e) => onChange(e.target.value === NO_DOMAIN ? null : e.target.value)} className={inputCls}>
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

/* ---------------------------------------------------------
   Hauptkomponente
--------------------------------------------------------- */

export default function WartungsfensterApp() {
  const [domains, setDomains] = useState(createDomains);
  const [servergruppen, setServergruppen] = useState(createServergruppen);
  const [wartungsfenster, setWartungsfenster] = useState(createWartungsfenster);
  const [zuordnungen, setZuordnungen] = useState(() => createZuordnungen(createServergruppen(), createWartungsfenster()));
  const [activeWfId, setActiveWfId] = useState(() => getDefaultWfId(createWartungsfenster()));

  const [activeGroup, setActiveGroup] = useState("INT");
  const [activeSub, setActiveSub] = useState("REFBIU");
  const [viewTab, setViewTab] = useState("alle");

  const [editZuordnung, setEditZuordnung] = useState(null);
  const [editBasis, setEditBasis] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [showNewSgModal, setShowNewSgModal] = useState(false);
  const [showBugfixModal, setShowBugfixModal] = useState(false);
  const [showNewWfModal, setShowNewWfModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);

  const activeEnv = activeGroup === "REF" ? activeSub : activeGroup;
  const rows = servergruppen[activeEnv] || [];
  const sortedWf = useMemo(() => [...wartungsfenster].sort((a, b) => a.datum.localeCompare(b.datum)), [wartungsfenster]);
  const activeWf = wartungsfenster.find((w) => w.id === activeWfId);

  // Fortschreibung: die letzte explizite Änderung bis (und mit) dem Zielfenster gilt.
  function getEffectiveZuordnung(sgId, targetWfId) {
    const targetIdx = sortedWf.findIndex((w) => w.id === targetWfId);
    for (let i = targetIdx; i >= 0; i--) {
      const wf = sortedWf[i];
      const entry = zuordnungen[wf.id]?.[sgId];
      if (entry) return { ...entry, effectiveFromWf: wf, explicitHere: wf.id === targetWfId };
    }
    return { ...EMPTY_ZUORDNUNG, effectiveFromWf: null, explicitHere: false };
  }

  function saveZuordnung(sgId, wfId, data) {
    setZuordnungen((prev) => ({ ...prev, [wfId]: { ...(prev[wfId] || {}), [sgId]: data } }));
  }

  function toggleEingespielt(sgId) {
    const current = getEffectiveZuordnung(sgId, activeWfId);
    const { effectiveFromWf, explicitHere, ...data } = current;
    saveZuordnung(sgId, activeWfId, { ...data, eingespielt: !current.eingespielt });
  }

  function saveBasis(env, updatedSg) {
    setServergruppen((prev) => ({
      ...prev,
      [env]: prev[env].map((sg) => (sg.id === updatedSg.id ? updatedSg : sg)),
    }));
  }

  function updateBasisField(env, sgId, key, value) {
    setServergruppen((prev) => ({
      ...prev,
      [env]: prev[env].map((sg) => (sg.id === sgId ? { ...sg, [key]: value } : sg)),
    }));
  }

  function addServergruppeToEnvs(envs, sgData) {
    setServergruppen((prev) => {
      const next = { ...prev };
      envs.forEach((env, i) => {
        const sg = { ...sgData, id: `${env}-SG-${Date.now()}-${i}`, colors: {} };
        next[env] = [...next[env], sg];
      });
      return next;
    });
  }

  function addWartungsfenster(wf) {
    setWartungsfenster((prev) => [...prev, wf]);
    // Instanzen/Domänen bleiben unverändert (sind global), aber Bugfix-Einträge und
    // "eingespielt"-Markierungen starten für ein neues Fenster immer bei Null.
    setZuordnungen((prev) => {
      const emptyForAll = {};
      Object.values(servergruppen)
        .flat()
        .forEach((sg) => {
          emptyForAll[sg.id] = { ...EMPTY_ZUORDNUNG, colors: {} };
        });
      return { ...prev, [wf.id]: emptyForAll };
    });
    setActiveWfId(wf.id);
  }

  function addDomain(name) {
    const id = `dom-${Date.now()}`;
    setDomains((prev) => [...prev, { id, name }]);
    return id;
  }
  function renameDomain(id, name) {
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  }
  function deleteDomain(id) {
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

  // Header-Gruppen (Stammdaten / Bugfix) aus der Spaltenreihenfolge ableiten
  const headerGroups = [];
  COLUMNS.forEach((c) => {
    const last = headerGroups[headerGroups.length - 1];
    if (last && last.group === c.group) last.span += 1;
    else headerGroups.push({ group: c.group, span: 1 });
  });

  // Reiter-Filter (Alle / Mit Einspielung / Eingespielt) auf Basis der aktiven Umgebung + aktiven Wartungsfensters
  const filteredRows = rows.filter((sg) => {
    const zu = getEffectiveZuordnung(sg.id, activeWfId);
    if (viewTab === "einspielung") return hasEinspielung(zu);
    if (viewTab === "eingespielt") return zu.eingespielt;
    return true;
  });

  const counts = {
    alle: rows.length,
    einspielung: rows.filter((sg) => hasEinspielung(getEffectiveZuordnung(sg.id, activeWfId))).length,
    eingespielt: rows.filter((sg) => getEffectiveZuordnung(sg.id, activeWfId).eingespielt).length,
  };

  // Gefilterte Zeilen der aktiven Umgebung nach Domäne gruppieren
  const domainGroups = useMemo(() => {
    const groups = domains.map((d) => ({ id: d.id, name: d.name, rows: filteredRows.filter((r) => r.domainId === d.id) }));
    const ohne = filteredRows.filter((r) => !r.domainId || !domains.some((d) => d.id === r.domainId));
    groups.push({ id: null, name: "Ohne Domäne", rows: ohne });
    return groups.filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, domains]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-[#0F4C5C] text-white px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ServerCog size={22} />
          <div>
            <h1 className="font-semibold text-lg leading-tight">Wartungsfenster-Verwaltung</h1>
            <p className="text-xs text-slate-200/80">JBoss EAP 8.1 · JDK 21 · {ALL_ENV_KEYS.length} Umgebungen</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setShowDomainModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 transition"
          >
            <Layers size={16} /> Domänen verwalten
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

      {/* Umgebungs-Tabs + Wartungsfenster-Auswahl oben rechts */}
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
              {sortedWf.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.datum})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowNewWfModal(true)}
            className="text-xs text-[#0F4C5C] border border-[#0F4C5C]/30 hover:bg-[#0F4C5C]/5 px-2 py-1.5 rounded-md flex items-center gap-1 transition"
          >
            <Plus size={13} /> Wartungsfenster
          </button>
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

      {/* Ansichts-Reiter: Alle / Mit Einspielung / Eingespielt */}
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
          {filteredRows.length} von {rows.length} Servergruppen/Instanzen · aktives Wartungsfenster: <span className="font-medium text-slate-600">{activeWf?.name}</span>
        </p>
      </div>

      {/* Legende */}
      <div className="px-6 pb-2 flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" /> Bugfix eingetragen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 inline-block" /> Eingespielt
        </span>
      </div>

      {/* Tabelle, gruppiert nach Domäne */}
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
                  {g.group === "bugfix" ? `Bugfix — ${activeWf?.name}` : "Stammdaten"}
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
              <th className="sticky top-0 bg-slate-100 px-3 py-2 border-b border-slate-200 text-center w-40">Aktionen</th>
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
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className="px-1 py-1 border-b border-slate-100 max-w-[200px]">
                              <input
                                value={sg.jbossAdmin}
                                onChange={(e) => updateBasisField(activeEnv, sg.id, "jbossAdmin", e.target.value)}
                                placeholder="Name eintragen…"
                                className="w-full bg-transparent px-2 py-1.5 text-xs rounded-md outline-none hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#0F4C5C]"
                              />
                            </td>
                          );
                        }
                        if (c.group === "stamm") {
                          return (
                            <td key={c.key} style={cellStyleStamm(c.key, sg)} className={`px-3 py-2 border-b border-slate-100 max-w-[200px] truncate ${c.mono ? "font-mono text-[11px]" : ""}`}>
                              {sg[c.key] || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={c.key}
                            style={cellStyleBugfix(c.key, zu)}
                            title={zu.effectiveFromWf && !zu.explicitHere ? `Übernommen aus ${zu.effectiveFromWf.name}` : undefined}
                            className={`px-3 py-2 border-b border-slate-100 max-w-[200px] truncate ${c.mono ? "font-mono text-[11px]" : ""}`}
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
            saveZuordnung(editZuordnung.sg.id, activeWfId, data);
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
            saveZuordnung(sgId, activeWfId, data);
            setShowBugfixModal(false);
          }}
        />
      )}

      {showNewWfModal && (
        <NewWartungsfensterModal
          onClose={() => setShowNewWfModal(false)}
          onSubmit={(wf) => {
            addWartungsfenster(wf);
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
    </div>
  );
}

/* ---------------------------------------------------------
   Modal: Neue Servergruppe/Instanz (Stammdaten, Mehrfachumgebung + Domäne)
--------------------------------------------------------- */

function NewServergruppeModal({ defaultEnv, domains, onAddDomain, onClose, onSubmit }) {
  const [selectedEnvs, setSelectedEnvs] = useState(() => new Set([defaultEnv]));
  const [domainId, setDomainId] = useState(null);
  const [newDomainName, setNewDomainName] = useState("");
  const [form, setForm] = useState({ jbossAdmin: "", name: "", server: "", aufrufadresse: "", soaEndpunkte: "" });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function toggleEnv(key) {
    setSelectedEnvs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function handleAddDomainInline() {
    if (!newDomainName.trim()) return;
    const id = onAddDomain(newDomainName.trim());
    setDomainId(id);
    setNewDomainName("");
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (selectedEnvs.size === 0) return;
    onSubmit(Array.from(selectedEnvs), { ...form, domainId });
  }

  return (
    <Modal title="Neue Servergruppe/Instanz anlegen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Umgebungen">
          <div className="border border-slate-200 rounded-md p-3">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700 mr-auto">Auswahl</span>
              <button type="button" onClick={() => setSelectedEnvs(new Set(ALL_ENV_KEYS))} className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">
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
              Wird identisch in {selectedEnvs.size} Umgebungen angelegt. Abweichungen lassen sich danach je Umgebung über "Stammdaten bearbeiten" anpassen.
            </p>
          )}
        </Field>

        <Field label="Domäne">
          <DomainSelect domains={domains} value={domainId} onChange={setDomainId} />
          <div className="flex gap-2 mt-2">
            <input className={inputCls} placeholder="Neue Domäne anlegen…" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} />
            <button type="button" onClick={handleAddDomainInline} className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 whitespace-nowrap">
              + Anlegen
            </button>
          </div>
        </Field>

        <Field label="Instanz">
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Server">
          <input className={inputCls} value={form.server} onChange={(e) => set("server", e.target.value)} />
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
  const [form, setForm] = useState({ ...sg, colors: { ...sg.colors } });

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
          onSave(form);
        }}
      >
        <Field label="Domäne">
          <DomainSelect domains={domains} value={form.domainId} onChange={(v) => set("domainId", v)} />
        </Field>
        {COLUMNS.filter((c) => c.group === "stamm").map((c) => (
          <Field key={c.key} label={c.label}>
            <div className="flex gap-2 items-center">
              <input className={inputCls} value={form[c.key] || ""} onChange={(e) => set(c.key, e.target.value)} />
              <ColorPicker value={form.colors?.[c.key]} onChange={(v) => setColor(c.key, v)} />
            </div>
          </Field>
        ))}
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
    <Modal title={`Bugfix bearbeiten — ${sg.name || sg.jbossAdmin || sg.id} · ${wf?.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
        <p className="text-xs text-slate-500 mb-4 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Diese Änderung gilt ab <strong>{wf?.name}</strong> ({wf?.datum}) und automatisch für alle späteren Wartungsfenster, bis sie dort erneut geändert wird.
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
    <Modal title={`Bugfix erfassen — ${wf?.name}`} onClose={onClose}>
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
                {sg.server ? ` (${sg.server})` : ""}
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
        <p className="text-xs text-slate-400 mb-3">Gilt ab dem aktuell gewählten Wartungsfenster und automatisch für alle folgenden. Die Zeile wird gelb markiert, bis sie als "eingespielt" bestätigt wird.</p>
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

function NewWartungsfensterModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [datum, setDatum] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  function handleDatumChange(v) {
    setDatum(v);
    if (!nameTouched) setName(nameFromDate(v));
  }
  function handleNameChange(v) {
    setName(v);
    setNameTouched(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ id: `wf-${Date.now()}`, name, datum });
  }

  return (
    <Modal title="Neues Wartungsfenster anlegen" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Datum">
          <input required type="date" className={inputCls} value={datum} onChange={(e) => handleDatumChange(e.target.value)} />
        </Field>
        <Field label="Bezeichnung">
          <input required className={inputCls} placeholder="z. B. Wartungsfenster Oktober 2026" value={name} onChange={(e) => handleNameChange(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">Wird aus dem Datum vorgeschlagen, lässt sich aber jederzeit anpassen.</p>
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
        <input className={inputCls} placeholder="Neue Domäne, z. B. Domäne West" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
   Modal: Verlauf (fortgeschriebene Werte je Wartungsfenster)
--------------------------------------------------------- */

function HistoryModal({ sg, sortedWf, getEffectiveZuordnung, onClose }) {
  const rows = [...sortedWf].reverse();
  const hasAny = rows.some((wf) => getEffectiveZuordnung(sg.id, wf.id).effectiveFromWf);

  return (
    <Modal title={`Verlauf — ${sg.name || sg.jbossAdmin || sg.id} (${sg.server || "kein Server hinterlegt"})`} onClose={onClose} wide>
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
          {rows.map((wf) => {
            const zu = getEffectiveZuordnung(sg.id, wf.id);
            return (
              <tr key={wf.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-700">{wf.name}</td>
                <td className="py-2 pr-3 font-mono">{wf.datum}</td>
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
                      {zu.explicitHere ? <span className="text-slate-600">geändert</span> : <span className="text-slate-400">übernommen seit {zu.effectiveFromWf.name}</span>}
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
