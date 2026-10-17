# Weltweite Bestenliste – Server einrichten (Cloudflare, kostenlos)

Der Server ist ein Cloudflare Worker mit einer D1-Datenbank. Der kostenlose Tarif reicht für sehr viele Nutzer
(100.000 Anfragen pro Tag, 5 GB Datenbank).

## Einmalig

1. Konto anlegen: https://dash.cloudflare.com/sign-up (kostenlos, keine Kreditkarte nötig).
2. In diesem Ordner (`PrimSieb_Mobile/server`) ein Terminal öffnen und anmelden – öffnet den Browser:
   ```bash
   npx wrangler login
   ```
3. Datenbank anlegen, die ausgegebene `database_id` in `wrangler.toml` eintragen:
   ```bash
   npx wrangler d1 create primsieb
   ```
4. Tabellen anlegen:
   ```bash
   npm run db:init
   ```
5. Geheimen Schlüssel setzen – **derselbe Wert wie `VITE_LB_KEY` in `PrimSieb_Mobile/.env`**:
   ```bash
   npx wrangler secret put APP_KEY
   ```
6. Hochladen:
   ```bash
   npm run deploy
   ```
   Am Ende steht die Adresse, z. B. `https://primsieb-leaderboard.<name>.workers.dev`.
7. Diese Adresse in `PrimSieb_Mobile/.env` bei `VITE_LB_URL=` eintragen und die App neu bauen
   (`npm run android` bzw. iOS-Build). Ab dann ist die weltweite Bestenliste aktiv.

## Hinweise

- Ergebnisse werden auf Plausibilität geprüft, pro Installation höchstens 30 am Tag; für den Durchschnitt zählt je
  Installation und Modell nur das beste Ergebnis.
- Der Schlüssel steckt in der App und kann von Experten ausgelesen werden – er hält Gelegenheits-Fälschungen ab, ist
  aber kein absoluter Schutz. Bei Bedarf einzelne Einträge löschen:
  ```bash
  npx wrangler d1 execute primsieb --remote --command "DELETE FROM results WHERE id = 123"
  ```
- Lokal testen: `npm run db:init:local`, dann `npm run dev` (läuft auf http://127.0.0.1:8787, Schlüssel in `.dev.vars`).
- Für die Stores: Bei Google Play unter „Datensicherheit“ angeben „Geräte- oder andere IDs“ und „App-Aktivität / Leistung“
  werden **optional, anonym, nicht geteilt** erfasst; bei Apple „Diagnose → Leistungsdaten“, nicht mit der Identität verknüpft,
  kein Tracking.
