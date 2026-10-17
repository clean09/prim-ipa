# PrimSieb Mobile – vom Code in Play Store und App Store

Die App ist eine Web-App (TypeScript, Web Workers, WebGL2), die Capacitor als echte native App für Android und iOS verpackt.
Sie läuft komplett offline. Android baust du auf diesem PC, iOS in der Cloud (GitHub Actions auf macOS).

```
PrimSieb_Mobile/
  src/            App (Seiten, Rechenkerne, Shader)
  android/        Android-Studio-Projekt (von Capacitor erzeugt, angepasst)
  ios/            Xcode-Projekt (von Capacitor erzeugt, angepasst)
  docs/           Datenschutzerklärung (für die Store-Einträge online stellen)
  tools/icons.*   erzeugt App-Icons und Startbilder mit dem Schwarzen-Loch-Renderer
  resources/      Icon 1024 px und Play-Store-Icon 512 px
  .github/        iOS-Cloud-Build
```

## Entwickeln und testen

```bash
npm run dev          # im Browser testen: http://localhost:5174 (Handy im selben WLAN: http://<PC-IP>:5174)
npm run android      # Web-App bauen + ins Android-Projekt kopieren
```

Test-APK bauen (liegt danach in `android/app/build/outputs/apk/debug/app-debug.apk`, per USB oder Mail aufs Handy):

```bash
cd android && ./gradlew assembleDebug
```

Nach Änderungen am Icon-Motiv: `npm run dev`, dann `http://localhost:5174/tools/icons.html` öffnen – alle Größen werden neu geschrieben.

## Google Play Store

1. **Entwicklerkonto** anlegen: play.google.com/console (einmalig 25 $). Private Konten, die nach Nov. 2023 erstellt wurden,
   müssen vor der Veröffentlichung einen **geschlossenen Test mit mindestens 12 Testern über 14 Tage** durchführen.
2. **Signaturschlüssel** einmalig erzeugen und gut sichern (ohne ihn keine Updates – Google Play App Signing hilft, aber den Upload-Schlüssel brauchst du trotzdem):
   ```bash
   keytool -genkeypair -v -keystore primsieb-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   Dann `android/keystore.properties` anlegen (wird nie mit hochgeladen, steht in `.gitignore`):
   ```
   storeFile=C:/Pfad/zu/primsieb-upload.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
3. **App-Bundle bauen** (Play verlangt .aab):
   ```bash
   npm run android
   cd android && ./gradlew bundleRelease
   ```
   Ergebnis: `android/app/build/outputs/bundle/release/app-release.aab`.
   Für jedes Update `versionCode` in `android/app/build.gradle` um 1 erhöhen.
4. In der Play Console: App erstellen → Store-Eintrag (Texte unten, Icon `resources/playstore-icon-512.png`,
   Grafik 1024×500, mind. 2 Screenshots) → **Datenschutzerklärung-URL** (siehe unten) →
   **Datensicherheit**: „Es werden keine Nutzerdaten erhoben oder geteilt“ → Inhaltseinstufung (Fragebogen, ergibt „Ab 0“) →
   Zielgruppe „ab 13“ oder „alle“ → App-Bundle in „Interner Test“ hochladen, dann geschlossener Test, dann Produktion.

## Apple App Store

1. **Apple Developer Program** beitreten: developer.apple.com (99 $/Jahr).
2. In **App Store Connect** eine App anlegen: Bundle-ID `app.primsieb.mobile` (vorher unter developer.apple.com → Identifiers registrieren),
   Name „PrimSieb“ (falls vergeben: z. B. „PrimSieb Benchmark“).
3. **API-Schlüssel** für den Cloud-Build: App Store Connect → Benutzer und Zugriff → Integrationen → Team-Schlüssel → neuer Schlüssel mit Rolle „App-Manager“.
   `.p8`-Datei herunterladen (geht nur einmal), Key ID und Issuer ID notieren.
4. **Projekt auf GitHub** hochladen (privates Repository genügt; der Ordner `PrimSieb_Mobile` ist die Wurzel).
   Unter Settings → Secrets and variables → Actions anlegen: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (Inhalt der .p8-Datei).
5. Actions → **iOS** → „Run workflow“. Der Build landet nach ca. 10–20 Minuten in App Store Connect unter **TestFlight**.
   Dort auf dem eigenen iPhone testen (TestFlight-App), dann im App-Store-Eintrag den Build auswählen und zur Prüfung einreichen.
   GitHub stellt für private Repositories monatlich Freiminuten bereit; macOS-Minuten zählen 10-fach – ein Build kostet also grob 150–200 Freiminuten.
6. Für den Eintrag: Screenshots 6,9" (1320×2868) und 13" iPad (2064×2752), Datenschutz-URL, „App-Datenschutz“: **Keine Daten erfasst**,
   Altersfreigabe 4+, Kategorie „Dienstprogramme“ (oder „Bildung“).
   Exportkonformität ist schon im Projekt eingetragen (keine Verschlüsselung).

**Hinweis zur Prüfung (Guideline 4.2):** Apple lehnt Apps ab, die nur eine Website verpacken. PrimSieb läuft komplett offline,
nutzt alle Kerne und die GPU und bietet echte Funktionen – im Prüfhinweis kurz erwähnen:
„Offline benchmark app. All calculations (prime sieve, black hole ray tracing, n-body, AI matrix tests) run locally on CPU and GPU.“

## Datenschutzerklärung online stellen

Beide Stores verlangen eine öffentlich erreichbare URL. Einfachster Weg: im GitHub-Repository unter Settings → Pages
„Deploy from branch“, Ordner `/docs` wählen. Die Adresse lautet dann `https://<benutzername>.github.io/<repo>/datenschutz.html`.
Vorher in `docs/datenschutz.html` die Kontakt-E-Mail eintragen.

## Store-Texte

**Name:** PrimSieb · **Untertitel (iOS, max. 30 Zeichen):** Primzahl- und KI-Benchmark

**Kurzbeschreibung (Play, max. 80 Zeichen):**
Benchmark mit Primzahlsieb, Schwarzem Loch, KI-Test und Mathe-Labor – offline.

**Beschreibung (DE):**
PrimSieb misst, was in deinem Handy steckt – mit echter Mathematik statt Fantasie-Punkten.

• Geräte-Check: PrimSieb erkennt dein Handy, zeigt sein Innenleben als animierte Röntgenansicht und prüft Bauteil für Bauteil – CPU-Kerne, Grafik, KI-Rechenwerk, Arbeitsspeicher, Speicher, Display und Akku. Das gerade getestete Modul leuchtet auf. Am Ende gibt es Gesamtpunkte und einen Rang von Bronze bis Legende.

• Primzahlen: Das Sieb des Eratosthenes prüft auf allen Prozessorkernen Milliarden Zahlen. Jedes Ergebnis wird mit bekannten Kontrollwerten bestätigt. 1 Punkt = 1 Milliarde geprüfte Zahlen – dieselbe Wertung wie PrimSieb für Windows.
• Singularität: Ein Schwarzes Loch wie in „Interstellar“, berechnet mit echtem Raytracing durch die gekrümmte Raumzeit – mit leuchtender Akkretionsscheibe, Doppler-Effekt, rotierendem Kerr-Loch und Jets. Frei erkunden oder 60-Sekunden-Testflug für die Grafikeinheit.
• KI-Leistung: Matrix-Durchsatz in FP16 und FP32 auf der GPU, Vergleich mit der CPU und neuronale Bildgenerierung.
• Mathe-Labor: π auf bis zu 2 Millionen Stellen, Fibonacci-Zahlen mit Millionen Stellen, Suche nach Fibonacci-Primzahlen, Galaxienkollisionen mit Tausenden Sternen (N-Körper) und die Collatz-Vermutung.
• Neutronenstern: Bandbreite, Latenz und Stabilität des Arbeitsspeichers.
• Zahl prüfen: Ist 2^127 − 1 prim? Miller-Rabin und Lucas-Lehmer für beliebig große Zahlen.

Hell-, Dunkel- und OLED-Design (oder automatisch wie das System), verschiedene Akzentfarben.

Keine Werbung, kein Konto, keine Datensammlung. Alles läuft offline auf deinem Gerät.

**Description (EN):**
PrimSieb measures what your phone can really do – with real mathematics instead of made-up points.

• Device check: PrimSieb recognises your phone, shows its insides as an animated X-ray view and tests it part by part – CPU cores, graphics, AI engine, memory, storage, display and battery. The module under test lights up. You get total points and a rank from Bronze to Legend.

• Primes: the Sieve of Eratosthenes checks billions of numbers on all CPU cores, every result verified against known values. 1 point = 1 billion numbers checked – the same scoring as PrimSieb for Windows.
• Singularity: a black hole like in “Interstellar”, rendered with real ray tracing through curved spacetime – glowing accretion disk, Doppler effect, spinning Kerr hole and jets. Explore freely or run the 60-second GPU flight test.
• AI performance: FP16 and FP32 matrix throughput on the GPU, CPU comparison and neural image generation.
• Math lab: π to 2 million digits, Fibonacci numbers with millions of digits, Fibonacci prime search, galaxy collisions with thousands of stars (n-body) and the Collatz conjecture.
• Neutron star: memory bandwidth, latency and stability.
• Check a number: is 2^127 − 1 prime? Miller-Rabin and Lucas-Lehmer for numbers of any size.

Light, dark and OLED themes (or follow the system), several accent colours.

No ads, no account, no data collection. Everything runs offline on your device.

**Stichwörter (iOS, max. 100 Zeichen):** benchmark,primzahl,schwarzes loch,gpu,cpu,ki,pi,fibonacci,mathe,test,leistung
