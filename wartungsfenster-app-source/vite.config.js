import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Wichtig: muss zum Context-Root auf dem JBoss passen (siehe WEB-INF/jboss-web.xml).
  // Sonst zeigen die erzeugten JS/CSS-Pfade ins Leere und die Seite bleibt weiß.
  base: "/wartungsfenster/",
});
