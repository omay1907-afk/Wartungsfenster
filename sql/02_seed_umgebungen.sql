-- ============================================================
-- Stammdaten: Umgebungen (fest, entsprechen den Tabs der Anwendung)
-- ============================================================
USE wartungsfenster;

INSERT INTO umgebung (code, bezeichnung, gruppe, farbe, sortierung) VALUES
  ('INT',      'Abnahmetestumgebung',                'INT', '#2563EB', 1),
  ('REFBIU',   'Betriebliche Integrationsumgebung',  'REF', '#D97706', 2),
  ('REFPROBE', 'Probebetriebsumgebung',              'REF', '#D97706', 3),
  ('REFZERT',  'Zertifizierungsumgebung',            'REF', '#D97706', 4),
  ('ABN',      'Referenzumgebung',                   'ABN', '#7C3AED', 5),
  ('EDU',      'Schulungsumgebung',                  'EDU', '#059669', 6),
  ('PRD',      'Produktion / Echtbetrieb',           'PRD', '#DC2626', 7);
