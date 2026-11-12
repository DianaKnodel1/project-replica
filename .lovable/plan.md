# bst-beratung.com wieder erreichbar machen

## Ursache (geprüft)
- Die Einträge in Cloudflare sind richtig (190.97.165.54).
- Die Domain ist aber noch nicht bei Cloudflare aktiv: Im Internet gelten noch die alten Nameserver ns1/ns2.dyna-ns.net, die auf 185.53.179.149 zeigen.
- Am Portal und am Server muss nichts geändert werden.

## Was du tun musst
1. In Cloudflare auf „Continue to activation" klicken. Cloudflare zeigt dir zwei Nameserver (z. B. `xxx.ns.cloudflare.com`).
2. Beim Domain-Anbieter von bst-beratung.com (wo die Domain gekauft wurde) die Nameserver auf genau diese zwei ändern.
3. In Cloudflare unter SSL/TLS den Modus „Full" einstellen (nicht „Flexible"), sonst gibt es eine Endlos-Weiterleitung.
4. Warten, bis Cloudflare „Active" meldet (meist unter 1 Stunde, maximal 24 Stunden).

## Danach
Ich prüfe die Domain erneut und bestätige, dass die Seite lädt.
