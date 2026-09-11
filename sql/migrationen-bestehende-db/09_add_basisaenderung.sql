-- ============================================================
-- Neue Spalten für "Basisänderung" (JDK/EAP/OJDBC-Version je
-- Servergruppe/Instanz-Platzierung). Bewusst an der Servergruppe
-- (nicht an der Instanz) verortet, da diese Werte je Umgebung
-- unterschiedlich sein können (z. B. manche Umgebungen bereits auf
-- neuerem JDK).
-- ============================================================
USE wartungsfenster;

ALTER TABLE servergruppe
  ADD COLUMN jdk_version VARCHAR(30) NOT NULL DEFAULT '' AFTER soa_endpunkte,
  ADD COLUMN eap_version VARCHAR(30) NOT NULL DEFAULT '' AFTER jdk_version,
  ADD COLUMN ojdbc_version VARCHAR(30) NOT NULL DEFAULT '' AFTER eap_version,
  ADD COLUMN basisaenderung_eingespielt TINYINT(1) NOT NULL DEFAULT 0 AFTER ojdbc_version;
