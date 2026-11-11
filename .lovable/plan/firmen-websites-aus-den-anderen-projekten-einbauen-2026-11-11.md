# Firmen-Websites aus den anderen Projekten einbauen

## Ziel
Die 9 Websites werden 1:1 übernommen, jeweils fest ihrer Firma und Domain zugeordnet. Bewerbung und Kontakt landen zuverlässig im Portal.

| Domain | Quelle (Lovable-Projekt) |
|---|---|
| dme-managment.com | DME Management Website |
| gab-management.com | GAB Management |
| szp-gmbh.com | SZP Management |
| isi-softsolutions.com | ISI Management Group |
| fts-beratung.com | FTS Management Berlin |
| hd-agentur.com | HD Agentur Website |
| wvdigital-gmbh.com | WV Management Digital |
| md-mgmtgmbh.com | MD Management Future |
| bst-beratung.com | BST Corporate Website |

(PV Agentur Augsburg ist nicht dabei – sag Bescheid, falls doch.)

## Schritte
1. **Notlösung entfernen:** Knopf „Reset-Link" in der Mitarbeiterliste wieder ausbauen.
2. **Websites übernehmen:** Jede Seite wird mit allen Unterseiten, Bildern, Texten, Impressum und Datenschutz als eigenes, fest zugeordnetes Design eingebaut (nächste freie Nummern ab site-17).
3. **Firma + Domain zuordnen:** Jede Domain zeigt automatisch die passende Website; die alten Designs bleiben bestehen, werden für diese Firmen aber nicht mehr genutzt.
4. **Bewerbungsformular:** Alle „Jetzt bewerben"-Knöpfe führen in den bestehenden Bewerbungsablauf des Portals, die Bewerbung wird der richtigen Firma zugeordnet, danach erscheint eine Danke-Seite im Design der jeweiligen Firma.
5. **Kontaktformular:** Anfragen werden gespeichert und erscheinen im Admin-Postfach (mit Firmenname). Zusätzlich optional eine Benachrichtigungs-Mail über Resend, sobald die Absender-Domain dort bestätigt ist.
6. **Prüfen:** Pro Website je eine Test-Bewerbung und Test-Kontaktanfrage abschicken, Ankunft im Portal kontrollieren, Testeinträge löschen.

## Was du danach tun musst
- Die 9 Domains auf das Portal zeigen lassen (DNS), wie bei den bisherigen Landing Pages.
- Für Mails: Domain in Resend bestätigen (gleiche Absender-Adresse wie beim Passwort-Reset reicht).

## Technische Details
- Quellcode per Cross-Project-Checkout, Umbau in das Premium-Theme-Format (meta.json, template.html, style.css, assets) laut docs/PREMIUM-THEMES.md; Test premium-theme-standard muss grün sein.
- Formulare posten an den bestehenden Endpunkt /api/public/applications bzw. einen Kontakt-Endpunkt, der in lead_messages schreibt (kind=lead, Firma via Tenant).
- Tenant-Zuordnung über die Domain-Tabelle des eigenen Servers (api.mb-portal.com).
