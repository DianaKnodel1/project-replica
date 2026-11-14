# Zweite Portal-Instanz – günstig und komplett getrennt

## Ziel
Eine zweite, völlig eigene Kopie von Portal, Landing Pages, Web-ID und Backup. Eigene Daten, eigene Logins, eigene Domain. Kosten deutlich unter den heutigen 200 € im Monat.

## Idee: Weniger Server, gleiche Programme
Heute läuft jeder Teil auf einem eigenen Server. Für den Start der zweiten Instanz reicht es, alles auf **einen** stärkeren Server zu legen. Nur das Backup bleibt getrennt, damit es bei einem Ausfall sicher ist.

```text
Server A (alles in einem, ca. 15–25 € / Monat)
  - Portal (Admin + Mitarbeiter)
  - Datenbank und Logins (eigener Backend-Teil)
  - Landing Pages
  - Web-ID
Backup-Speicher (ca. 4–5 € / Monat)
  - holt sich jede Nacht die Daten von Server A
```

Geschätzt: **ca. 20–30 € im Monat**, z. B. Hetzner CPX31 (4 Kerne, 8 GB) plus Hetzner Storage Box. Wächst die Instanz, kann man einzelne Teile später wieder auf eigene Server auslagern.

## Schritte
1. Neue Domain für die zweite Instanz festlegen (z. B. `portal2.de`) und in Cloudflare anlegen.
2. Server A kaufen (KVM, Ubuntu 24.04 bevorzugt) und Backup-Speicher buchen.
3. Ein Einrichtungs-Skript bauen, das Portal, Backend, Landing-Server und Web-ID zusammen auf einem Server installiert. Die bestehenden Einzel-Skripte werden dafür wiederverwendet.
4. Leere Datenbank mit allen Tabellen anlegen und den ersten Admin erstellen.
5. Backup so einstellen, dass der Backup-Speicher die Daten holt (wie bei der ersten Instanz).
6. Mail-Versand (Resend) und Cloudflare-Schlüssel für die zweite Instanz neu eintragen.
7. Test: Login, Bewerbung über eine Landing Page, Web-ID-Ablauf, ein Backup und eine Wiederherstellung.

## Was gleich bleibt
- Beide Instanzen bekommen Updates aus demselben Programm-Code. Ein Update spielst du einfach auf beiden ein.
- Die erste Instanz wird dabei nicht angefasst.

## Offen / von dir gebraucht
- Die Domain für die zweite Instanz.
- Kauf des Servers und des Backup-Speichers.
- Eigener Resend-Zugang oder eigene Absenderdomain für die zweite Instanz.

## Technische Details
- Neues Skript `scripts/setup-all-in-one.sh` ruft die vorhandenen Setup-Teile nacheinander auf, mit getrennten Ports und einem gemeinsamen Caddy für alle Domains.
- Pro Instanz eigene `.env.server` mit eigenen Schlüsseln; keine geteilten Datenbanken oder Tokens.
- Backup-Orchestrator bekommt die zweite Instanz als eigenes Ziel; Archivaufbau bleibt gleich, damit `restore.sh` funktioniert.
- Deploy-Skript bekommt eine Option für die All-in-one-Variante.
