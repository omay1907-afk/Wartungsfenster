-- ============================================================
-- Korrektur: id-Spalten (und die darauf verweisenden Fremdschlüssel)
-- von INT UNSIGNED auf BIGINT UNSIGNED ändern, damit sie zu den
-- Java-Entities passen (dort wird überall "Long" verwendet, Hibernate
-- erwartet beim Schema-Abgleich dafür BIGINT statt INT UNSIGNED).
--
-- MySQL prüft bei ALTER TABLE ... MODIFY die Typkompatibilität
-- bestehender Fremdschlüssel auch dann, wenn FOREIGN_KEY_CHECKS=0
-- gesetzt ist (Fehler 3780). Deshalb werden die Fremdschlüssel hier
-- zuerst entfernt, dann die Spaltentypen geändert, und die
-- Fremdschlüssel danach sauber neu angelegt.
--
-- Sicher ausführbar auch mit bereits vorhandenen Daten - eine
-- Vergrößerung von INT auf BIGINT verliert keine Werte.
-- ============================================================
USE wartungsfenster;

-- 1. Fremdschlüssel entfernen
ALTER TABLE servergruppe DROP FOREIGN KEY fk_servergruppe_instanz;
ALTER TABLE servergruppe DROP FOREIGN KEY fk_servergruppe_domaene;
ALTER TABLE servergruppe_artefakt_vorlage DROP FOREIGN KEY fk_vorlage_servergruppe;
ALTER TABLE bugfix_zuordnung DROP FOREIGN KEY fk_zuordnung_instanz;
ALTER TABLE bugfix_zuordnung DROP FOREIGN KEY fk_zuordnung_wartungsfenster;

-- 2. Spaltentypen anpassen
ALTER TABLE domaene MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;
ALTER TABLE instanz MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;

ALTER TABLE servergruppe MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;
ALTER TABLE servergruppe MODIFY instanz_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE servergruppe MODIFY domaene_id BIGINT UNSIGNED NULL;

ALTER TABLE servergruppe_artefakt_vorlage MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;
ALTER TABLE servergruppe_artefakt_vorlage MODIFY servergruppe_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE wartungsfenster MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;

ALTER TABLE bugfix_zuordnung MODIFY id BIGINT UNSIGNED AUTO_INCREMENT;
ALTER TABLE bugfix_zuordnung MODIFY instanz_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE bugfix_zuordnung MODIFY wartungsfenster_id BIGINT UNSIGNED NOT NULL;

-- 3. Fremdschlüssel wieder anlegen
ALTER TABLE servergruppe
  ADD CONSTRAINT fk_servergruppe_instanz FOREIGN KEY (instanz_id) REFERENCES instanz(id) ON DELETE CASCADE;
ALTER TABLE servergruppe
  ADD CONSTRAINT fk_servergruppe_domaene FOREIGN KEY (domaene_id) REFERENCES domaene(id) ON DELETE SET NULL;

ALTER TABLE servergruppe_artefakt_vorlage
  ADD CONSTRAINT fk_vorlage_servergruppe FOREIGN KEY (servergruppe_id) REFERENCES servergruppe(id) ON DELETE CASCADE;

ALTER TABLE bugfix_zuordnung
  ADD CONSTRAINT fk_zuordnung_instanz FOREIGN KEY (instanz_id) REFERENCES instanz(id) ON DELETE CASCADE;
ALTER TABLE bugfix_zuordnung
  ADD CONSTRAINT fk_zuordnung_wartungsfenster FOREIGN KEY (wartungsfenster_id) REFERENCES wartungsfenster(id) ON DELETE CASCADE;
