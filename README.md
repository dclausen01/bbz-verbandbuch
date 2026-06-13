# Verbandsbuch BBZ

Digitales Verbandbuch (Erste-Hilfe-Dokumentation, DGUV) für eine berufsbildende
Schule. Frontend, API und LDAP-Anmeldung laufen als **eine** monolithische
Nuxt-Anwendung – ein Prozess, ein Port, eine SQLite-Datei. Ideal für den Betrieb
auf einem Plesk-Server ohne separaten Backend- oder Datenbank-Container.

Diese Codebasis führt die früheren Projekte
[`verbandsbuch-ui`](https://github.com/jerohwer/verbandsbuch-ui) und
[`verband-backend`](https://github.com/lenzer01/verband-backend) zusammen und
übernimmt die LDAP-Authentifizierung aus
[`notentabellen-spa`](https://github.com/dclausen01/notentabellen-spa).

## Architektur

| Schicht          | Technik                                                        |
|------------------|----------------------------------------------------------------|
| Frontend         | Nuxt 4 (Vue 3) + Vuetify, Pinia                                 |
| API              | Nitro-Server der Nuxt-App (`server/api/**`)                     |
| Authentifizierung| LDAP/Active Directory (`ldapts`) + Session-Cookie (`nuxt-auth-utils`) |
| Datenbank        | SQLite (`better-sqlite3`) – eine Datei, kein DB-Dienst          |

Frontend und API teilen sich denselben Server: Im Produktionsbetrieb startet
alles über `node .output/server/index.mjs`. Die frühere Aufteilung in zwei
Docker-Container entfällt.

### Rollen

- **REPORTER** (Berichterstatter:in): legt Einträge an und sieht die eigenen.
- **ADMIN**: sieht alle Einträge und verwaltet Verbandkästen, Bestände und Benutzer.

Die Rolle liegt in der lokalen Datenbank (nicht im AD). Unbekannte LDAP-Nutzer
werden beim ersten Login automatisch als REPORTER angelegt
(`NUXT_AUTO_PROVISION=true`); Kennungen aus `NUXT_INITIAL_ADMINS` werden ADMIN.

## Entwicklung

```bash
npm install
cp .env.example .env        # NUXT_PUBLIC_IS_DEV=true für Login ohne LDAP
npm run dev                 # http://localhost:3000
```

Im Entwicklungsmodus (`NUXT_PUBLIC_IS_DEV=true`) wird kein LDAP benötigt: Der
angemeldete Nutzer stammt aus `devUser.json` (`NUXT_PUBLIC_DEV_USER_INDEX` wählt
den Eintrag, das Passwort wird ignoriert). Beim Start werden ein paar
Beispiel-Verbandkästen und -Materialien angelegt.

## Produktion (Build & Start)

```bash
npm ci
npm run build
node .output/server/index.mjs
```

### Docker

```bash
docker build -t bbz-verbandbuch .
docker run -d -p 3000:3000 \
  -e NUXT_SESSION_PASSWORD="<min. 32 Zeichen>" \
  -e NUXT_INITIAL_ADMINS="admin.kennung" \
  -e LDAP_URL="ldaps://dc01.schule.local:636" \
  -e LDAP_BASE_DN="OU=Lehrkraefte,DC=schule,DC=local" \
  -e LDAP_BIND_DN="CN=Verbandsbuch-Service,OU=Dienste,DC=schule,DC=local" \
  -e LDAP_BIND_PW="<service-pw>" \
  -v verbandbuch_data:/app/data \
  bbz-verbandbuch
```

### Plesk (Node.js-Anwendung)

> Ausführliche Schritt-für-Schritt-Anleitung inkl. automatischem Git-Pull-Build:
> siehe [`PLESK.md`](./PLESK.md).

1. Repository nach Plesk deployen, **Node.js**-Anwendung einrichten.
2. Startdatei: `.output/server/index.mjs` (Application Startup File).
3. Build-Befehl: `npm ci && npm run build`.
4. Umgebungsvariablen gemäß `.env.example` setzen (Session, LDAP, `DB_PATH`).
5. `DB_PATH` auf ein dauerhaftes Verzeichnis legen, das beim Deploy nicht
   überschrieben wird (z. B. `/var/www/vhosts/<domain>/verbandbuch-data/verbandbuch.db`).

## Konfiguration

Alle Variablen sind in [`.env.example`](./.env.example) dokumentiert. Die
wichtigsten:

| Variable                  | Zweck                                                        |
|---------------------------|-------------------------------------------------------------|
| `NUXT_SESSION_PASSWORD`   | Schlüssel (≥ 32 Zeichen) für das Session-Cookie             |
| `DB_PATH`                 | Pfad zur SQLite-Datei                                        |
| `NUXT_INITIAL_ADMINS`     | Kommagetrennte Login-Kennungen mit automatischer ADMIN-Rolle |
| `NUXT_AUTO_PROVISION`     | Unbekannte LDAP-Nutzer automatisch anlegen (`true`/`false`)  |
| `LDAP_URL`, `LDAP_BASE_DN`| LDAP-Server und Such-Basis                                   |
| `LDAP_BIND_DN` / `_PW`    | Service-Account für die Suche (Service-Modus)               |
| `LDAP_BIND_USER_TEMPLATE` | Aktiviert den Direkt-Bind-Modus (kein Service-Account)      |

### LDAP-Modi

- **Service-Modus** (Standard): Mit Service-Account binden, Nutzer per Filter
  suchen, dann mit dessen DN + eingegebenem Passwort erneut binden.
- **Direkt-Modus**: `LDAP_BIND_USER_TEMPLATE` setzen (z. B. `SCHULE\{{username}}`
  oder `{{username}}@schule.local`) – dann ist kein Service-Account nötig.

## API-Überblick (Nitro, alle unter `/api`)

| Methode & Pfad                | Zugriff        | Zweck                          |
|-------------------------------|----------------|--------------------------------|
| `POST /api/login`             | öffentlich     | LDAP-Login → Session           |
| `POST /api/logout`            | angemeldet     | Session beenden                |
| `GET/POST /api/entry`         | angemeldet     | Einträge lesen/anlegen         |
| `GET/PUT/DELETE /api/entry/:id` | Eigentümer/Admin | Eintrag lesen/ändern/löschen |
| `GET /api/firstAidKit`        | angemeldet     | Verbandkästen                  |
| `POST/PUT/DELETE /api/firstAidKit[/:id]` | Admin | Kästen verwalten           |
| `GET /api/product`            | angemeldet     | Materialien                    |
| `POST/DELETE /api/product[/:id]` | Admin       | Materialien verwalten          |
| `GET/POST /api/bestand`, `PUT /api/bestand/:id` | Admin | Bestände/Nachfüllbedarf |
| `GET/POST /api/user`, `PUT/DELETE /api/user/:id` | Admin | Benutzer & Rollen        |
