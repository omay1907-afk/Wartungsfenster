-- ============================================================
-- Ersetzt die einzelne Spalte jdk_version durch zwei Kandidaten-
-- Versionen (aktuell/neu) plus einen Umschalter je Servergruppe, der
-- bestimmt, welche der beiden Versionen aktuell gilt.
-- ============================================================
USE wartungsfenster;

ALTER TABLE servergruppe
  DROP COLUMN jdk_version,
  ADD COLUMN jdk_version_alt VARCHAR(30) NOT NULL DEFAULT '' AFTER soa_endpunkte,
  ADD COLUMN jdk_version_neu VARCHAR(30) NOT NULL DEFAULT '' AFTER jdk_version_alt,
  ADD COLUMN jdk_auf_neuer_version TINYINT(1) NOT NULL DEFAULT 0 AFTER jdk_version_neu;
