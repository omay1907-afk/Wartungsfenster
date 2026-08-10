# Wartungsfenster-Verwaltung — lokaler Build (ohne CDN-Abhängigkeit)

Dieses Projekt erzeugt eine Version der Anwendung, die **keine externen
CDN-Aufrufe** (kein esm.sh, kein cdnjs, kein Tailwind-CDN) mehr benötigt.
React, Tailwind und die Icons werden fest in die ausgelieferten Dateien
eingebaut. Das ist der richtige Weg für ein internes/abgeschottetes Netz.

## Voraussetzung

Node.js (LTS-Version) auf einem Rechner **mit Internetzugang**, z. B. Ihr
Arbeitsplatzrechner — NICHT der JBoss-Server selbst. Download:
https://nodejs.org

## 1. Abhängigkeiten installieren

```bash
cd wartungsfenster-app-source
npm install
```

## 2. Produktions-Build erzeugen

```bash
npm run build
```

Das erzeugt einen Ordner `dist/` mit fertigen, gebündelten HTML/CSS/JS-
Dateien — ganz ohne Internet-Abhängigkeit zur Laufzeit.

Optional vorab lokal testen: `npm run dev` startet einen Entwicklungsserver
unter `http://localhost:5173`.

## 3. In die WAR-Struktur einpacken

Der Ordner `deploy/` enthält bereits die passende `WEB-INF/web.xml` und
`WEB-INF/jboss-web.xml` (Context-Root `/wartungsfenster`, wie zuvor). Den
Inhalt von `dist/` einfach dort hinein kopieren:

```bash
cp -r dist/* deploy/
cd deploy
zip -r ../wartungsfenster.war .
cd ..
```

Damit haben Sie eine neue `wartungsfenster.war`, die genauso deploybar ist
wie die vorherige — nur ohne CDN-Abhängigkeit.

## 4. Deployment

Wie gehabt über `deploy.cli` (Pfad zur neuen WAR-Datei darin anpassen) oder
per Kopieren in `standalone/deployments/`.

## Wichtig: base-Pfad

In `vite.config.js` ist `base: "/wartungsfenster/"` gesetzt. Das muss zum
Context-Root passen, den Sie tatsächlich verwenden. Falls Sie den
Context-Root ändern (z. B. weil `/wartungsfenster` auf dem gemeinsamen
JBoss schon belegt ist), muss dieser Wert **und** der `<context-root>` in
`deploy/WEB-INF/jboss-web.xml` konsistent angepasst werden — sonst zeigen
die Asset-Pfade ins Leere und die Seite bleibt wieder weiß.
