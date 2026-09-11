-- ============================================================
-- Entfernt die Testdaten aus 04_seed_demo_daten.sql wieder.
-- Umgebungen und die 12 Musterdomänen bleiben unangetastet (echte
-- Stammdaten). Dank ON DELETE CASCADE genügt das Löschen der
-- Instanz-Datensätze - Servergruppen, Artefakt-Vorlagen und
-- Bugfix-Zuordnungen der Testinstanzen werden automatisch mit
-- entfernt.
-- ============================================================
USE wartungsfenster;

DELETE FROM instanz
WHERE name IN (
  'aks30-std', 'atm-std', 'bewa-std', 'eks-std', 'impost-std',
  'jasper-std', 'phonetik-std', 'riko-std', 'stdservice-std', 'wks-std'
);

-- Die 4 Demo-Wartungsfenster ebenfalls entfernen (ungefährlich, da die
-- Anwendung noch nicht produktiv läuft und nichts Echtes daranhängt).
-- Falls Sie diese lieber behalten möchten, einfach die folgende Zeile
-- weglassen bzw. auskommentieren.
DELETE FROM wartungsfenster WHERE nummer IN ('01', '02', '03', '04');

-- Kontrolle: sollte danach 0 liefern
SELECT COUNT(*) AS verbleibende_testinstanzen FROM instanz
WHERE name IN (
  'aks30-std', 'atm-std', 'bewa-std', 'eks-std', 'impost-std',
  'jasper-std', 'phonetik-std', 'riko-std', 'stdservice-std', 'wks-std'
);
