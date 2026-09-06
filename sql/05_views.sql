-- ============================================================
-- View: v_bugfix_effektiv
--
-- Bildet die "Fortschreibung" der Anwendung in SQL ab: für jede
-- Kombination aus Instanz und Wartungsfenster wird der zuletzt
-- gültige (explizit gesetzte) Bugfix-Datensatz ermittelt - also
-- entweder eine Änderung genau in diesem Fenster, oder - falls es
-- dort keine gibt - die letzte Änderung aus einem früheren Fenster.
-- Neue Wartungsfenster, für die es (noch) keine bugfix_zuordnung
-- gibt, liefern entsprechend NULL-Werte (= "kein Bugfix").
-- ============================================================
USE wartungsfenster;

CREATE OR REPLACE VIEW v_bugfix_effektiv AS
SELECT
  wf.id                              AS wartungsfenster_id,
  wf.nummer                          AS wartungsfenster_nummer,
  i.id                               AS instanz_id,
  i.name                             AS instanz_name,
  q.bugfix_nr,
  q.properties,
  q.nexus_link,
  q.bemerkung,
  q.eingespielt,
  q.wartungsfenster_id               AS quelle_wartungsfenster_id,
  (q.wartungsfenster_id = wf.id)     AS explizit_in_diesem_fenster
FROM wartungsfenster wf
CROSS JOIN instanz i
LEFT JOIN bugfix_zuordnung q
  ON q.instanz_id = i.id
 AND q.wartungsfenster_id = (
       SELECT z.wartungsfenster_id
       FROM bugfix_zuordnung z
       JOIN wartungsfenster zwf ON zwf.id = z.wartungsfenster_id
       WHERE z.instanz_id = i.id
         AND zwf.datum <= wf.datum
       ORDER BY zwf.datum DESC
       LIMIT 1
     );

-- Beispiel: effektiver Stand aller Instanzen für ein bestimmtes Fenster
--   SELECT * FROM v_bugfix_effektiv WHERE wartungsfenster_nummer = '03';

-- Beispiel: komplette Tabellenansicht für eine Umgebung + Fenster
--   SELECT
--     sg.jbossadmin, sg.jira_kennzeichen, i.name AS instanz,
--     v.bugfix_nr, v.properties, v.nexus_link, v.bemerkung,
--     sg.ansprechpartner, sg.aufrufadresse, sg.soa_endpunkte,
--     v.eingespielt, d.name AS domaene
--   FROM servergruppe sg
--   JOIN instanz i   ON i.id = sg.instanz_id
--   LEFT JOIN domaene d ON d.id = sg.domaene_id
--   JOIN v_bugfix_effektiv v ON v.instanz_id = sg.instanz_id
--   WHERE sg.umgebung_code = 'INT' AND v.wartungsfenster_nummer = '03';
