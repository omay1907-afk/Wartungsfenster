-- ============================================================
-- Korrektur: id-Spalten (und die darauf verweisenden Fremdschlüssel)
-- von INT UNSIGNED auf BIGINT UNSIGNED ändern, damit sie zu den
-- Java-Entities passen (dort wird überall "Long" verwendet, Hibernate
-- erwartet beim Schema-Abgleich dafür BIGINT statt INT UNSIGNED).
--
-- Sicher ausführbar auch mit bereits vorhandenen Daten - eine
-- Vergrößerung von INT auf BIGINT verliert keine Werte. Foreign-Key-
-- Prüfungen werden während der Migration kurz deaktiviert, damit die
-- Reihenfolge der ALTER-Anweisungen keine Rolle spielt.
-- ============================================================
USE wartungsfenster;

SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;
