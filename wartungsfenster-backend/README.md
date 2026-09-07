# Wartungsfenster-Backend

Jakarta-EE-10-Backend (JAX-RS + JPA) für JBoss EAP 8.1, das die
Wartungsfenster-Verwaltung an Ihre MySQL-Datenbank anbindet. Liefert
eine REST-API unter `/api/*` und kann zusätzlich das gebaute
React-Frontend mit ausliefern (eine WAR, eine Deployment-Einheit).

## Voraussetzungen

- Java 17 (JDK)
- Maven
- Eine MySQL-Datenbank, auf der `sql/01_schema.sql` bis `sql/05_views.sql`
  bereits eingespielt wurden (siehe das separate `sql/`-Verzeichnis aus
  der vorherigen Lieferung) — **ohne** `04_seed_demo_daten.sql`, da das
  reine Testdaten waren.

## 1. MySQL-Datenquelle auf dem JBoss einrichten

Im Ordner `cli/`:

1. `01_mysql_module.cli`: Pfad zur vorher heruntergeladenen
   `mysql-connector-j`-JAR eintragen (z. B. von Maven Central,
   `com.mysql:mysql-connector-j:8.4.0`), dann ausführen:
   ```
   EAP_HOME/bin/jboss-cli.sh --connect --file=01_mysql_module.cli
   ```
2. `02_datasource.cli`: `DB_HOST`, `DB_BENUTZER`, `DB_PASSWORT` und bei
   Bedarf den Datenbanknamen anpassen, dann ausführen:
   ```
   EAP_HOME/bin/jboss-cli.sh --connect --file=02_datasource.cli
   ```
   Das legt die Datenquelle `WartungsfensterDS` an, auf die
   `persistence.xml` im Backend über JNDI zugreift.

## 2. Frontend einbauen (optional, aber empfohlen für eine einzige WAR)

Im Frontend-Projekt (`wartungsfenster-app-source`):
```
npm install
npm run build
```
Den entstandenen `dist/`-Inhalt nach `src/main/webapp/` in **diesem**
Backend-Projekt kopieren (die vorhandenen `WEB-INF/web.xml` und
`WEB-INF/jboss-web.xml` bleiben unangetastet, nur die `dist`-Dateien
kommen dazu, insbesondere `index.html` und der `assets`-Ordner).

**Wichtig:** In `vite.config.js` des Frontend-Projekts muss
`base: "/wartungsfenster/"` gesetzt bleiben, damit die Pfade zum
Context-Root passen (siehe `jboss-web.xml` unten).

Falls Sie Frontend und Backend getrennt betreiben möchten (z. B.
Frontend weiterhin über einen eigenen Webserver ausliefern), können Sie
diesen Schritt auch weglassen — dann muss das Frontend nur die
API-Aufrufe an den Host mit dem Backend richten (in `src/api.js` die
Konstante `API_BASE` entsprechend anpassen, z. B. auf eine volle URL).

## 3. Backend bauen

```
cd wartungsfenster-backend
mvn clean package
```
Das erzeugt `target/wartungsfenster.war`.

## 4. Deployment

Wie gehabt über die JBoss-Management-CLI oder Kopieren nach
`standalone/deployments/`. Der Context-Root ist über
`src/main/webapp/WEB-INF/jboss-web.xml` fest auf `/wartungsfenster`
gesetzt — bei Bedarf dort anpassen (und ggf. `vite.config.js` im
Frontend entsprechend mitziehen).

Nach dem Deployment ist die Anwendung erreichbar unter:
```
http://<ihr-server>:8080/wartungsfenster/
```
und die REST-API testweise direkt unter z. B.:
```
http://<ihr-server>:8080/wartungsfenster/api/domaenen
```

## API-Übersicht

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/domaenen` | Alle Domänen |
| POST | `/api/domaenen` | Domäne anlegen `{name}` |
| PUT | `/api/domaenen/{id}` | Domäne umbenennen `{name}` |
| DELETE | `/api/domaenen/{id}` | Domäne löschen |
| GET | `/api/servergruppen` | Alle Servergruppen (alle Umgebungen) |
| POST | `/api/servergruppen` | Instanz in 1-n Umgebungen anlegen |
| PUT | `/api/servergruppen/{id}` | Stammdaten aktualisieren (auch teilweise) |
| GET | `/api/wartungsfenster` | Alle Wartungsfenster |
| POST | `/api/wartungsfenster` | Neues Wartungsfenster `{datum, atlasRelease}` |
| GET | `/api/bugfix-zuordnungen` | Alle expliziten Bugfix-Einträge |
| PUT | `/api/instanzen/{instanzId}/bugfix/{wartungsfensterId}` | Bugfix für eine Instanz + Fenster speichern |

## Wichtige Designentscheidung

Ein Bugfix hängt an der **Instanz** (`instanz_id`), nicht an der
einzelnen Servergruppe. Dadurch gilt ein per PUT gespeicherter Bugfix
automatisch für jede Umgebung, in der die Instanz vorkommt — es muss
nichts serverseitig repliziert werden. Das Frontend übernimmt die
lokale Mehrfachanzeige (gleiche Instanz in mehreren Umgebungen) rein
zur Darstellung, persistiert aber pro Instanz nur einmal.

Beim Anlegen eines neuen Wartungsfensters (`POST /api/wartungsfenster`)
legt das Backend automatisch für jede bestehende Instanz einen leeren
Bugfix-Eintrag an — dadurch startet ein neues Fenster bewusst ohne
übernommene Bugfixe, wie in der Anwendung vorgesehen.

## Bekannte Einschränkungen / mögliche nächste Schritte

- Keine Authentifizierung/Autorisierung — für den produktiven Einsatz
  ggf. einen Security-Layer (z. B. JBoss EAP Elytron mit LDAP/Kerberos)
  ergänzen.
- Keine Undeploy-/Lösch-Endpunkte für Servergruppen oder
  Wartungsfenster — bei Bedarf leicht ergänzbar.
- Der Java-Code wurde hier ohne Internetzugang geschrieben und konnte
  nicht kompiliert/getestet werden. Bitte nach `mvn package` bzw. dem
  ersten Start etwaige Fehlermeldungen prüfen — bei Bedarf gerne mit
  der genauen Meldung zurückmelden.
