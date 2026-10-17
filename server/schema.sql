-- PrimSieb weltweite Bestenliste (Cloudflare D1)
-- Gespeichert werden nur anonyme Benchmark-Ergebnisse: Gerätemodell, Chip, Test, Punkte, Version, Datum.
-- Die Installations-ID kommt nur als SHA-256-Hash an (für die Upload-Begrenzung) und wird nie herausgegeben.

CREATE TABLE IF NOT EXISTS results (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind      TEXT    NOT NULL,          -- device | prime | bh | ai
  model     TEXT    NOT NULL,          -- z. B. "Samsung Galaxy S20 FE"
  soc       TEXT    NOT NULL,          -- z. B. "Snapdragon 865"
  platform  TEXT    NOT NULL,          -- android | ios
  score     REAL    NOT NULL,
  version   TEXT    NOT NULL,
  install   TEXT    NOT NULL,          -- SHA-256 der Installations-ID
  created   INTEGER NOT NULL           -- Unix-Zeit (s)
);

CREATE INDEX IF NOT EXISTS idx_results_kind_model ON results(kind, model);
CREATE INDEX IF NOT EXISTS idx_results_install    ON results(install, created);
