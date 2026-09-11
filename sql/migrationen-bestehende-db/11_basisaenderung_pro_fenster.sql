-- ============================================================
-- Verschiebt die Basisänderung (JDK/EAP/OJDBC) von einer flachen
-- Spalte je Servergruppe in eine eigene Tabelle, die pro Servergruppe
-- UND Wartungsfenster geführt wird - analog zu bugfix_zuordnung, nur
-- an der Servergruppe statt an der Instanz (da JDK/EAP/OJDBC je
-- Umgebung unterschiedlich sein können).
-- ============================================================
USE wartungsfenster;

CREATE TABLE basisaenderung (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servergruppe_id     BIGINT UNSIGNED NOT NULL,
  wartungsfenster_id  BIGINT UNSIGNED NOT NULL,
  jdk_version_alt     VARCHAR(30)  NOT NULL DEFAULT '',
  jdk_version_neu     VARCHAR(30)  NOT NULL DEFAULT '',
  jdk_auf_neuer_version TINYINT(1) NOT NULL DEFAULT 0,
  eap_version         VARCHAR(30)  NOT NULL DEFAULT '',
  ojdbc_version       VARCHAR(30)  NOT NULL DEFAULT '',
  eingespielt         TINYINT(1)   NOT NULL DEFAULT 0,
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_basisaenderung_servergruppe
    FOREIGN KEY (servergruppe_id) REFERENCES servergruppe(id) ON DELETE CASCADE,
  CONSTRAINT fk_basisaenderung_wartungsfenster
    FOREIGN KEY (wartungsfenster_id) REFERENCES wartungsfenster(id) ON DELETE CASCADE,

  UNIQUE KEY uq_basisaenderung_sg_fenster (servergruppe_id, wartungsfenster_id)
) ENGINE=InnoDB;

-- Vorhandene, flache Basisänderungswerte je Servergruppe in das aktuelle
-- (nächste anstehende, sonst letzte) Wartungsfenster übernehmen, damit
-- nichts verloren geht.
INSERT INTO basisaenderung (servergruppe_id, wartungsfenster_id, jdk_version_alt, jdk_version_neu, jdk_auf_neuer_version, eap_version, ojdbc_version, eingespielt)
SELECT
  s.id,
  (SELECT w.id FROM wartungsfenster w
     WHERE w.datum >= CURDATE()
     ORDER BY w.datum ASC LIMIT 1) AS ziel_frueher,
  s.jdk_version_alt, s.jdk_version_neu, s.jdk_auf_neuer_version, s.eap_version, s.ojdbc_version, s.basisaenderung_eingespielt
FROM servergruppe s
WHERE (SELECT w.id FROM wartungsfenster w WHERE w.datum >= CURDATE() ORDER BY w.datum ASC LIMIT 1) IS NOT NULL
  AND (s.jdk_version_alt <> '' OR s.jdk_version_neu <> '' OR s.eap_version <> '' OR s.ojdbc_version <> '');

-- Falls es kein zukünftiges Wartungsfenster gibt, stattdessen ins letzte vorhandene übernehmen
INSERT INTO basisaenderung (servergruppe_id, wartungsfenster_id, jdk_version_alt, jdk_version_neu, jdk_auf_neuer_version, eap_version, ojdbc_version, eingespielt)
SELECT
  s.id,
  (SELECT w.id FROM wartungsfenster w ORDER BY w.datum DESC LIMIT 1),
  s.jdk_version_alt, s.jdk_version_neu, s.jdk_auf_neuer_version, s.eap_version, s.ojdbc_version, s.basisaenderung_eingespielt
FROM servergruppe s
WHERE NOT EXISTS (SELECT 1 FROM wartungsfenster w WHERE w.datum >= CURDATE())
  AND EXISTS (SELECT 1 FROM wartungsfenster)
  AND (s.jdk_version_alt <> '' OR s.jdk_version_neu <> '' OR s.eap_version <> '' OR s.ojdbc_version <> '');

-- Alte, flache Spalten an der Servergruppe entfernen
ALTER TABLE servergruppe
  DROP COLUMN jdk_version_alt,
  DROP COLUMN jdk_version_neu,
  DROP COLUMN jdk_auf_neuer_version,
  DROP COLUMN eap_version,
  DROP COLUMN ojdbc_version,
  DROP COLUMN basisaenderung_eingespielt;
