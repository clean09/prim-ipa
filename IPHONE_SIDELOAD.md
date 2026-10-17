# PrimSieb aufs iPhone (Sideload, ohne Mac, ohne App Store)

iPhone-Apps lassen sich nur auf einem Mac übersetzen. Das übernimmt GitHub kostenlos auf einem Mac in der Cloud
(Workflow `.github/workflows/ios-ipa.yml`). Heraus kommt eine **unsignierte `PrimSieb-4.0.0.ipa`**. Beim Installieren
signiert **Sideloadly** sie mit deiner normalen Apple-ID. Ein Entwicklerkonto für 99 €/Jahr brauchst du dafür nicht.

## Einmalig: Code auf GitHub
1. Auf github.com ein Konto anlegen und ein **privates** Repository `primsieb-mobile` erstellen, ohne README.
2. Den Ordner hochladen (Claude kann das übernehmen, sobald das Repo existiert):
   ```
   git remote add origin https://github.com/DEIN-NAME/primsieb-mobile.git
   git push -u origin main
   ```
   Beim ersten Push öffnet sich ein Browserfenster zum Anmelden bei GitHub.
3. Optional für die weltweite Bestenliste: Unter *Settings → Secrets and variables → Actions* die Werte
   `VITE_LB_URL` und `VITE_LB_KEY` aus der lokalen `.env` eintragen. Ohne sie läuft die App, die Bestenliste zeigt
   dann nur „Noch nicht verbunden“.

## Die .ipa bauen
- Jeder Push auf `main` startet den Bau automatisch. Von Hand: *Actions → iPhone-IPA → Run workflow*.
- Nach ≈ 10 Minuten unten beim Lauf unter **Artifacts** `PrimSieb-iPhone-ipa` herunterladen und entpacken. Darin liegt
  die `.ipa`.
- Private Repos haben 2000 Freiminuten im Monat, macOS zählt dabei zehnfach. Ein Bau kostet ≈ 100 davon, also reicht es
  für ≈ 20 Builds im Monat.

## Einmalig auf dem PC: Sideloadly
1. **iTunes** und **iCloud** installieren, und zwar die Versionen direkt von apple.com, **nicht** aus dem Microsoft Store
   (Sideloadly braucht deren Treiber).
2. **Sideloadly** von sideloadly.io installieren.

## Installieren
1. iPhone per Kabel anschließen und auf dem iPhone „Diesem Computer vertrauen“ bestätigen.
2. Sideloadly öffnen, die `.ipa` hineinziehen, die eigene Apple-ID eintragen und auf **Start** klicken.
3. Auf dem iPhone: *Einstellungen → Allgemein → VPN und Geräteverwaltung →* deine Apple-ID antippen und **Vertrauen**.
4. Ab iOS 16: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* einschalten. Danach startet das iPhone neu.

## Gut zu wissen
- Mit einer kostenlosen Apple-ID läuft die Signatur **nach 7 Tagen ab**. Dann in Sideloadly einfach erneut auf Start
  klicken. Die Daten in der App (Bestenliste, Einstellungen) bleiben erhalten. Sideloadly kann das auch automatisch
  erneuern, solange PC und iPhone im selben WLAN sind.
- Höchstens 3 selbst signierte Apps gleichzeitig.
- Unterschiede zu Android: Der Geräte-Check zeigt weniger echte Hardwaredaten, weil iOS keine Taktfrequenzen und keine
  Akkukapazität herausgibt. Alles andere läuft gleich: Benchmarks, Sternenleben, Singularität, Spiele, Designs.
