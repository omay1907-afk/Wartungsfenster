-- ============================================================
-- Wartungsfenster-Verwaltung – Datenbankschema (MySQL 8.0+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS wartungsfenster
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE wartungsfenster;

-- ------------------------------------------------------------
-- Umgebungen (fest: INT, REFBIU, REFPROBE, REFZERT, ABN, EDU, PRD)
-- ------------------------------------------------------------
CREATE TABLE umgebung (
  code            VARCHAR(20)  NOT NULL PRIMARY KEY,
  bezeichnung     VARCHAR(120) NOT NULL,
  gruppe          VARCHAR(20)  NOT NULL,        -- Tab-Gruppe: INT, REF, ABN, EDU, PRD
  farbe           VARCHAR(7)   NOT NULL,        -- Hex-Farbe für die Tab-Anzeige
  sortierung      INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Domänen (JBoss-EAP-Domains innerhalb einer Umgebung)
-- ------------------------------------------------------------
CREATE TABLE domaene (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL UNIQUE,
  erstellt_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Instanz: die logische Instanz (z. B. "eks-std"). Bugfixe hängen
-- an dieser Tabelle, nicht an der einzelnen Umgebungs-Platzierung –
-- dadurch gilt ein Bugfix automatisch für jede Umgebung, in der
-- die Instanz vorkommt, ohne Daten zu duplizieren.
-- ------------------------------------------------------------
CREATE TABLE instanz (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL UNIQUE,
  erstellt_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Servergruppe: konkrete Platzierung einer Instanz in einer
-- Umgebung (inkl. Domäne) mit den zugehörigen Stammdaten.
-- ------------------------------------------------------------
CREATE TABLE servergruppe (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instanz_id          BIGINT UNSIGNED NOT NULL,
  umgebung_code       VARCHAR(20)  NOT NULL,
  domaene_id          BIGINT UNSIGNED NULL,
  jbossadmin          VARCHAR(120) NOT NULL DEFAULT '',
  jira_kennzeichen    VARCHAR(60)  NOT NULL DEFAULT '',
  ansprechpartner     VARCHAR(120) NOT NULL DEFAULT '',
  aufrufadresse       VARCHAR(255) NOT NULL DEFAULT '',
  soa_endpunkte       VARCHAR(255) NOT NULL DEFAULT '',
  farben              JSON         NULL,          -- z. B. {"aufrufadresse":"yellow"}
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_servergruppe_instanz
    FOREIGN KEY (instanz_id) REFERENCES instanz(id) ON DELETE CASCADE,
  CONSTRAINT fk_servergruppe_umgebung
    FOREIGN KEY (umgebung_code) REFERENCES umgebung(code),
  CONSTRAINT fk_servergruppe_domaene
    FOREIGN KEY (domaene_id) REFERENCES domaene(id) ON DELETE SET NULL,

  UNIQUE KEY uq_instanz_je_umgebung (instanz_id, umgebung_code)
) ENGINE=InnoDB;

CREATE INDEX idx_servergruppe_umgebung ON servergruppe(umgebung_code);
CREATE INDEX idx_servergruppe_domaene  ON servergruppe(domaene_id);

-- ------------------------------------------------------------
-- Artefakt-Namensvorlage(n) je Servergruppe (1-n, für den
-- Mouseover-Hinweis auf der Instanz-Spalte)
-- ------------------------------------------------------------
CREATE TABLE servergruppe_artefakt_vorlage (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servergruppe_id BIGINT UNSIGNED NOT NULL,
  vorlage         VARCHAR(255) NOT NULL,

  CONSTRAINT fk_vorlage_servergruppe
    FOREIGN KEY (servergruppe_id) REFERENCES servergruppe(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Wartungsfenster
-- ------------------------------------------------------------
CREATE TABLE wartungsfenster (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nummer          VARCHAR(4)   NOT NULL UNIQUE,     -- '01', '02', ... (fortlaufend, von der Anwendung vergeben)
  datum           DATE         NOT NULL,
  kw              INT UNSIGNED GENERATED ALWAYS AS (WEEKOFYEAR(datum)) STORED,
  atlas_release   VARCHAR(40)  NOT NULL,
  erstellt_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_wartungsfenster_datum ON wartungsfenster(datum);

-- ------------------------------------------------------------
-- Bugfix-Zuordnung: EIN Eintrag pro Instanz + Wartungsfenster.
-- Es werden nur EXPLIZITE Änderungen gespeichert - die
-- "Fortschreibung" (ein Bugfix gilt automatisch auch für alle
-- späteren Wartungsfenster, bis er dort erneut geändert wird)
-- wird zur Laufzeit über die View v_bugfix_effektiv berechnet
-- (siehe 05_views.sql), nicht redundant abgespeichert.
-- ------------------------------------------------------------
CREATE TABLE bugfix_zuordnung (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instanz_id          BIGINT UNSIGNED NOT NULL,
  wartungsfenster_id  BIGINT UNSIGNED NOT NULL,
  bugfix_nr           VARCHAR(30)  NOT NULL DEFAULT '',
  properties          VARCHAR(10)  NOT NULL DEFAULT 'nein',
  nexus_link          VARCHAR(255) NOT NULL DEFAULT '',
  bemerkung           VARCHAR(500) NOT NULL DEFAULT '',
  eingespielt         TINYINT(1)   NOT NULL DEFAULT 0,
  farben              JSON         NULL,
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_zuordnung_instanz
    FOREIGN KEY (instanz_id) REFERENCES instanz(id) ON DELETE CASCADE,
  CONSTRAINT fk_zuordnung_wartungsfenster
    FOREIGN KEY (wartungsfenster_id) REFERENCES wartungsfenster(id) ON DELETE CASCADE,

  UNIQUE KEY uq_instanz_fenster (instanz_id, wartungsfenster_id)
) ENGINE=InnoDB;
