-- ============================================================
-- Ersetzt bugfix_zuordnung (ein Eintrag pro Instanz+Fenster, mit
-- impliziter Fortschreibung in spätere Fenster) durch ein neues,
-- fenster-zentriertes Modell:
--
--   bugfix           - EIN Bugfix-Datensatz gehört zu GENAU EINEM
--                       Wartungsfenster (keine Fortschreibung mehr -
--                       jedes Fenster ist unabhängig).
--   bugfix_instanz   - Zuordnungstabelle: ein Bugfix kann mehrere
--                       Instanzen betreffen (1-n), jede mit eigenem
--                       Properties/Bemerkung/Eingespielt-Status.
--                       Da an der Instanz hängend, gilt jede
--                       Zuordnung automatisch in allen Umgebungen,
--                       in denen die jeweilige Instanz vorkommt.
--                       Einzeln UND komplett (über den Bugfix)
--                       löschbar.
-- ============================================================
USE wartungsfenster;

CREATE TABLE bugfix (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wartungsfenster_id  BIGINT UNSIGNED NOT NULL,
  bugfix_nr           VARCHAR(30)  NOT NULL DEFAULT '',
  nexus_link          VARCHAR(255) NOT NULL DEFAULT '',
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bugfix_wartungsfenster
    FOREIGN KEY (wartungsfenster_id) REFERENCES wartungsfenster(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE bugfix_instanz (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bugfix_id       BIGINT UNSIGNED NOT NULL,
  instanz_id      BIGINT UNSIGNED NOT NULL,
  properties      VARCHAR(10)  NOT NULL DEFAULT 'nein',
  bemerkung       VARCHAR(500) NOT NULL DEFAULT '',
  eingespielt     TINYINT(1)   NOT NULL DEFAULT 0,
  farben          JSON         NULL,

  CONSTRAINT fk_bugfix_instanz_bugfix
    FOREIGN KEY (bugfix_id) REFERENCES bugfix(id) ON DELETE CASCADE,
  CONSTRAINT fk_bugfix_instanz_instanz
    FOREIGN KEY (instanz_id) REFERENCES instanz(id) ON DELETE CASCADE,

  UNIQUE KEY uq_bugfix_instanz (bugfix_id, instanz_id)
) ENGINE=InnoDB;

-- Vorhandene Daten aus bugfix_zuordnung übernehmen: pro (instanz, wartungsfenster)
-- mit tatsächlich eingetragenem Bugfix wird ein eigener bugfix-Datensatz mit genau
-- einer zugeordneten Instanz angelegt (die bisherige automatische Fortschreibung in
-- spätere Fenster entfällt dabei bewusst - jedes Fenster zeigt ab jetzt nur noch,
-- was für dieses Fenster auch tatsächlich explizit eingetragen war).
INSERT INTO bugfix (wartungsfenster_id, bugfix_nr, nexus_link)
SELECT wartungsfenster_id, bugfix_nr, nexus_link
FROM bugfix_zuordnung
WHERE bugfix_nr <> '' OR nexus_link <> '' OR properties = 'ja';

INSERT INTO bugfix_instanz (bugfix_id, instanz_id, properties, bemerkung, eingespielt)
SELECT b.id, z.instanz_id, z.properties, z.bemerkung, z.eingespielt
FROM bugfix_zuordnung z
JOIN bugfix b
  ON b.wartungsfenster_id = z.wartungsfenster_id
 AND b.bugfix_nr = z.bugfix_nr
 AND b.nexus_link = z.nexus_link
WHERE z.bugfix_nr <> '' OR z.nexus_link <> '' OR z.properties = 'ja';

DROP TABLE bugfix_zuordnung;

-- Diese View basierte auf dem alten, instanz-zentrierten Fortschreibungsmodell
-- und wird mit dem neuen fenster-zentrierten Bugfix-Modell nicht mehr gebraucht.
DROP VIEW IF EXISTS v_bugfix_effektiv;
