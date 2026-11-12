# bst-beratung.com wieder erreichbar machen

## Ursache (geprüft)
- Die Domain zeigt auf die IP 185.53.179.149, nicht auf den neuen Landing-Server 190.97.165.54.
- Die Nameserver sind ns1/ns2.dyna-ns.net, also nicht Cloudflare. Das sind meist Parkserver vom Domain-Anbieter, oft weil die Domain abgelaufen ist oder nie umgestellt wurde.
- Der neue Server antwortet und die Landing ist dort bereit. Am Portal muss nichts geändert werden.

## Was du tun musst
1. Beim Domain-Anbieter von bst-beratung.com prüfen, ob die Domain bezahlt und aktiv ist.
2. Wenn die Domain bei Cloudflare liegen soll: die Nameserver beim Anbieter auf die zwei Cloudflare-Nameserver ändern, die Cloudflare dir anzeigt.
3. In Cloudflare (oder beim Anbieter) einen A-Eintrag für `@` und für `www` auf 190.97.165.54 setzen.
4. 10 Minuten bis einige Stunden warten, dann die Seite neu öffnen.

## Danach
Ich prüfe die Domain noch einmal und sag dir, ob sie richtig zeigt.
