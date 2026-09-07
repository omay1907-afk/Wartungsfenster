# Wartungsfenster-Verwaltung — Frontend

Dieses Projekt erzeugt die React-Oberfläche, die keine externen
CDN-Aufrufe mehr benötigt (React/Tailwind/Icons werden fest eingebaut)
und über eine REST-API (`src/api.js`) mit dem Backend
(`wartungsfenster-backend`, separates Projekt) spricht. Die Anwendung
enthält **keine Testdaten mehr** — sie startet leer und lädt beim
Öffnen die Daten vom Server.

## Voraussetzung

Node.js (LTS-Version) auf einem Rechner **mit Internetzugang**, z. B.
Ihr Arbeitsplatzrechner — NICHT der JBoss-Server selbst.
Download: https://nodejs.org

## 1. Abhängigkeiten installieren

```bash
cd wartungsfenster-app-source
npm install
```

## 2. Produktions-Build erzeugen

```bash
npm run build
```

Erzeugt den Ordner `dist/` mit den fertigen, gebündelten Dateien.

## 3. Mit dem Backend zusammenführen

Den kompletten Inhalt von `dist/` in `src/main/webapp/` des
**Backend**-Projekts (`wartungsfenster-backend`) kopieren. Von dort aus
wird dann eine gemeinsame WAR-Datei gebaut (`mvn package`), die sowohl
die Oberfläche als auch die REST-API (`/api/*`) enthält.

Details dazu stehen in der README des Backend-Projekts.

## Wichtig: base-Pfad

In `vite.config.js` ist `base: "/wartungsfenster/"` gesetzt. Das muss
zum tatsächlichen Context-Root passen (siehe `jboss-web.xml` im
Backend-Projekt). Bei Änderung des Context-Roots bitte an beiden
Stellen konsistent anpassen.

## Lokal gegen ein laufendes Backend testen

```bash
npm run dev
```
Der Vite-Dev-Server läuft unter `http://localhost:5173`. Damit die
API-Aufrufe (`/api/...`) beim lokalen Testen durchgereicht werden,
in `vite.config.js` einen Proxy ergänzen:
```js
server: {
  proxy: { "/api": "http://localhost:8080" }
}
```
(Adresse an Ihr lokal laufendes Backend anpassen.)
