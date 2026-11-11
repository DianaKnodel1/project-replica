# Firmen-Websites: eigene Bewerbungsformulare, Original-Impressum, Postfach-Trennung

## 1. Bewerbungsformular der jeweiligen Website
- Jede der 9 Seiten bekommt wieder ihr **eigenes Bewerbungsformular** im Original-Look (Felder, Texte, Gestaltung wie auf der Quellseite).
- Die „Bewerben“-Knöpfe führen zu diesem eigenen Formular statt zum einheitlichen Portal-Formular.
- Beim Absenden geht die Bewerbung trotzdem ins Portal (richtige Firma, Bewerberliste wie bisher). Danach erscheint die Danke-Meldung bzw. Danke-Seite der jeweiligen Website.
- Pflichtangaben, die das Portal braucht (z. B. Name, E-Mail, Telefon), werden auf das Originalformular abgebildet; fehlt etwas, ergänze ich das Feld im gleichen Stil.

## 2. Impressum und Datenschutz im Original
- Impressum- und Datenschutz-Texte werden 1:1 von den Originalseiten übernommen und als eigene Unterseiten der jeweiligen Website eingebaut.
- Sie sind danach im Generator als Text bearbeitbar, falls du etwas ändern willst.

## 3. Admin-Postfach: E-Mails und Kontaktanfragen getrennt
- Kontaktanfragen aus den Website-Formularen bekommen eine eigene Kategorie „Kontaktanfrage“.
- Im Postfach gibt es einen Filter bzw. Reiter: Alle / E-Mails / Kontaktanfragen, plus eine Kennzeichnung an jedem Eintrag.
- Bei Kontaktanfragen siehst du zusätzlich, von welcher Website sie kamen.

## Technische Details
- Quellen erneut per Cross-Project-Snapshot lesen; Formular-Markup je site-17…25 in template.html übernehmen, ohne `<form>`-Tag (Theme-Vertrag) mit `data-lv-apply`-Feldern; script.js sendet an `/api/public/applications` mit den vom Endpunkt erwarteten Feldern und zeigt die Original-Danke-Ansicht. Theme-Vertrag/Test anpassen, falls der Shared-Modal-Zwang greift (docs/PREMIUM-THEMES.md + premium-theme-standard.test.ts gemeinsam).
- Impressum/Datenschutz als zusätzliche `pages` in meta.json mit Rich-Text-Slots (Default = Originaltext), statt Tenant-generierter Rechtsseiten für diese Themes.
- Kontakt-Endpunkt speichert `lead_messages` mit eigenem Kennzeichen (neuer `kind`-Wert `contact` bzw. Quellfeld); Postfach-Threading, KIND_LABEL und Filter in admin.postfach.tsx erweitern; ggf. Migration für erlaubte kind-Werte.
- Prüfen: Theme-Tests, Render-Check aller 9 Seiten, Bewerbung und Kontakt je einmal mit Test-Eintrag, danach Test-Einträge löschen.
