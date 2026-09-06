-- ============================================================
-- OPTIONALE Testdaten – entsprechen dem Demo-/Testdatenstand der
-- React-Anwendung. Für den produktiven Einsatz einfach weglassen
-- bzw. später löschen (TRUNCATE der betroffenen Tabellen).
-- ============================================================
USE wartungsfenster;

-- ------------------------------------------------------------
-- 10 Testinstanzen (alphanumerisch)
-- ------------------------------------------------------------
INSERT INTO instanz (name) VALUES
  ('aks30-std'), ('atm-std'), ('bewa-std'), ('eks-std'), ('impost-std'),
  ('jasper-std'), ('phonetik-std'), ('riko-std'), ('stdservice-std'), ('wks-std');

-- ------------------------------------------------------------
-- Platzierung je Umgebung + Domäne (eks-std und riko-std kommen
-- in jeder Umgebung vor, die übrigen variieren je Umgebung)
-- ------------------------------------------------------------
INSERT INTO servergruppe (instanz_id, umgebung_code, domaene_id, aufrufadresse)
SELECT i.id, t.umgebung_code, d.id,
       CONCAT('https://', LOWER(t.umgebung_code), '.example.local/', t.instanz_name)
FROM (
  SELECT 'INT' AS umgebung_code, 'aks30-std' AS instanz_name, 'zoll-atlas' AS domaene_name UNION ALL
  SELECT 'INT', 'atm-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'INT', 'bewa-std', 'zoll-atlasro' UNION ALL
  SELECT 'INT', 'eks-std', 'zoll-atlas' UNION ALL
  SELECT 'INT', 'impost-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'INT', 'jasper-std', 'zoll-atlasro' UNION ALL
  SELECT 'INT', 'phonetik-std', 'zoll-atlas' UNION ALL
  SELECT 'INT', 'riko-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'INT', 'stdservice-std', 'zoll-atlasro' UNION ALL
  SELECT 'INT', 'wks-std', 'zoll-atlas' UNION ALL

  SELECT 'REFBIU', 'eks-std', 'zoll-atlas' UNION ALL
  SELECT 'REFBIU', 'riko-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'REFBIU', 'bewa-std', 'zoll-atlasro' UNION ALL
  SELECT 'REFBIU', 'impost-std', 'zoll-atlas' UNION ALL

  SELECT 'REFPROBE', 'eks-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'REFPROBE', 'riko-std', 'zoll-atlasro' UNION ALL
  SELECT 'REFPROBE', 'aks30-std', 'zoll-atlas' UNION ALL

  SELECT 'REFZERT', 'eks-std', 'zoll-atlasro' UNION ALL
  SELECT 'REFZERT', 'riko-std', 'zoll-atlas' UNION ALL
  SELECT 'REFZERT', 'atm-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'REFZERT', 'jasper-std', 'zoll-atlasro' UNION ALL
  SELECT 'REFZERT', 'wks-std', 'zoll-atlas' UNION ALL

  SELECT 'ABN', 'eks-std', 'zoll-atlas' UNION ALL
  SELECT 'ABN', 'riko-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'ABN', 'stdservice-std', 'zoll-atlasro' UNION ALL

  SELECT 'EDU', 'eks-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'EDU', 'riko-std', 'zoll-atlasro' UNION ALL
  SELECT 'EDU', 'phonetik-std', 'zoll-atlas' UNION ALL

  SELECT 'PRD', 'eks-std', 'zoll-atlasro' UNION ALL
  SELECT 'PRD', 'riko-std', 'zoll-atlas' UNION ALL
  SELECT 'PRD', 'aks30-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'PRD', 'atm-std', 'zoll-atlasro' UNION ALL
  SELECT 'PRD', 'bewa-std', 'zoll-atlas' UNION ALL
  SELECT 'PRD', 'impost-std', 'zoll-atlaszwei' UNION ALL
  SELECT 'PRD', 'jasper-std', 'zoll-atlasro'
) t
JOIN instanz i  ON i.name = t.instanz_name
JOIN domaene d  ON d.name = t.domaene_name;

-- ------------------------------------------------------------
-- Artefakt-Namensvorlagen (gelten für jede Platzierung der Instanz)
-- ------------------------------------------------------------
INSERT INTO servergruppe_artefakt_vorlage (servergruppe_id, vorlage)
SELECT sg.id, v.vorlage
FROM servergruppe sg
JOIN instanz i ON i.id = sg.instanz_id
JOIN (
  SELECT 'eks-std' AS instanz_name, 'eks-service-*.ear' AS vorlage UNION ALL
  SELECT 'eks-std', 'eks-config-*.zip' UNION ALL
  SELECT 'impost-std', 'impost-app-*.war'
) v ON v.instanz_name = i.name;

-- ------------------------------------------------------------
-- Ansprechpartner (Musterdaten)
-- ------------------------------------------------------------
UPDATE servergruppe sg
JOIN instanz i ON i.id = sg.instanz_id
SET sg.ansprechpartner = CASE i.name
  WHEN 'aks30-std'  THEN 'Max Mustermann'
  WHEN 'eks-std'    THEN 'Erika Mustermann'
  WHEN 'impost-std' THEN 'Max Mustermann'
  WHEN 'riko-std'   THEN 'Erika Mustermann'
  WHEN 'wks-std'    THEN 'Max Mustermann'
END
WHERE i.name IN ('aks30-std', 'eks-std', 'impost-std', 'riko-std', 'wks-std');

-- ------------------------------------------------------------
-- Wartungsfenster
-- ------------------------------------------------------------
INSERT INTO wartungsfenster (nummer, datum, atlas_release) VALUES
  ('01', '2026-06-14', 'ATLAS 10.2.0'),
  ('02', '2026-07-19', 'ATLAS 10.2.1'),
  ('03', '2026-08-16', 'ATLAS 10.2.2'),
  ('04', '2026-09-20', 'ATLAS 10.2.3');

-- ------------------------------------------------------------
-- Bugfix-Beispiele, gesetzt im ersten Wartungsfenster (gelten über
-- die Fortschreibungslogik/View automatisch auch für die späteren)
-- ------------------------------------------------------------
INSERT INTO bugfix_zuordnung (instanz_id, wartungsfenster_id, bugfix_nr, properties, nexus_link, bemerkung, eingespielt)
SELECT i.id, wf.id, v.bugfix_nr, v.properties, v.nexus_link, v.bemerkung, v.eingespielt
FROM (
  SELECT 'aks30-std' AS instanz_name, '42'  AS bugfix_nr, 'ja'   AS properties, ''                                                          AS nexus_link, ''                             AS bemerkung, 0 AS eingespielt UNION ALL
  SELECT 'atm-std',   '7',              'ja',   '',                                                                                                                         '',                           0 UNION ALL
  SELECT 'bewa-std',  '128',            'nein', 'https://nexus.internal/repo/app-core/bewa-1.2.0',                                                                          '',                           0 UNION ALL
  SELECT 'eks-std',   '15',             'ja',   'https://nexus.internal/repo/app-core/eks-1.0.3',                                                                           'Servicepatch Exportmodul',   1 UNION ALL
  SELECT 'impost-std','203',            'ja',   'https://nexus.internal/repo/app-core/impost-2.1.0',                                                                        '',                           0
) v
JOIN instanz i ON i.name = v.instanz_name
JOIN wartungsfenster wf ON wf.nummer = '01';
