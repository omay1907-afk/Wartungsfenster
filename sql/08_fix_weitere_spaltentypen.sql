-- ============================================================
-- Weitere Spaltentyp-Korrekturen, damit sie zu den (jetzt ebenfalls
-- korrigierten) Java-Entities passen. Betroffen sind keine Primär-
-- oder Fremdschlüssel-Spalten, daher ist hier kein Entfernen/Neu-
-- Anlegen von Foreign Keys nötig wie bei 07_fix_id_spaltentypen.sql.
--
-- 1) umgebung.farbe: CHAR(7) -> VARCHAR(7)
--    (String-Felder ohne native Länge werden von Hibernate als
--    VARCHAR erwartet, nicht als CHAR - unterschiedliche JDBC-Typen)
--
-- 2) umgebung.sortierung: TINYINT UNSIGNED -> INT UNSIGNED
--    (Java-Feld ist Integer, dafür erwartet Hibernate INTEGER/INT,
--    nicht TINYINT)
--
-- 3) wartungsfenster.kw: TINYINT UNSIGNED -> INT UNSIGNED
--    (gleicher Grund wie bei sortierung; da es eine generierte Spalte
--    ist, muss die komplette GENERATED-Definition mit angegeben werden)
--
-- 4) bugfix_zuordnung.properties: ENUM('ja','nein') -> VARCHAR(10)
--    (Hibernates @Enumerated(EnumType.STRING) erwartet eine normale
--    VARCHAR-Spalte, keine native MySQL-ENUM-Spalte)
-- ============================================================
USE wartungsfenster;

ALTER TABLE umgebung MODIFY farbe VARCHAR(7) NOT NULL;

ALTER TABLE umgebung MODIFY sortierung INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE wartungsfenster MODIFY kw INT UNSIGNED GENERATED ALWAYS AS (WEEKOFYEAR(datum)) STORED;

ALTER TABLE bugfix_zuordnung MODIFY properties VARCHAR(10) NOT NULL DEFAULT 'nein';
