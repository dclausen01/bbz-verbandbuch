# Deployment auf Plesk (Git-Pull + automatischer Build)

Diese Anleitung passt zum Dialog **„Repository erstellen“** in Plesk und richtet
die App so ein, dass bei jedem Push ins Repository automatisch gebaut und neu
gestartet wird.

## 1. Git-Repository in Plesk anlegen

Im Dialog „Repository erstellen“:

- **Code-Speicherort:** Remote-Repository
- **Repository-URL:** `https://github.com/dclausen01/bbz-verbandbuch.git`
- **Benutzername/Passwort:** nur falls das Repo privat ist (GitHub-Token als Passwort)
- **Bereitstellungsmodus:** Automatisch
- **Serverpfad:** z. B. `/bbz-verbandbuch.bbz-rd-eck.com`
- **Zusätzliche Bereitstellungsaktionen aktivieren:** ✔

> Wenn der Standard-Branch nicht `main` ist, in den Repository-Einstellungen den
> gewünschten Branch auswählen, sobald das Repo angelegt ist.

### Bereitstellungsaktionen (in das Textfeld einfügen)

> **Wichtig:** Ohne die folgende PATH-Zeile nutzt Plesk das uralte System-Node
> (v12) – dann scheitert der Build mit `SyntaxError: Unexpected token '='`.
> Es wird **mindestens Node 20.19** benötigt.

```bash
# Höchste installierte Plesk-Node-Version automatisch wählen und in den PATH legen
export PATH="$(ls -d /opt/plesk/node/*/bin 2>/dev/null | sort -V | tail -1):$PATH"

# Zur Kontrolle ins Deploy-Log schreiben (muss >= v20.19 sein!)
node -v && npm -v

# Abhängigkeiten inkl. Dev-Tools (für den Build) installieren
npm ci --include=dev

# Nuxt + Nitro-Server bauen -> .output/
npm run build

# Passenger-App neu starten
mkdir -p tmp && touch tmp/restart.txt
```

> Die erste Zeile sucht den neuesten Ordner unter `/opt/plesk/node/*` (z. B.
> `/opt/plesk/node/20/bin`). Falls die Auto-Erkennung nicht greift, den Pfad fest
> eintragen, z. B. `export PATH=/opt/plesk/node/20/bin:$PATH`. Die installierten
> Versionen zeigt `ls /opt/plesk/node/`.
> `npm ci` lädt für `better-sqlite3` ein passendes Prebuilt – kein Compiler nötig.

> **Node-Version:** Die App ist auf **Nuxt 4.3** festgelegt und läuft damit auf
> **Node 20.19+ und Node 22/24**. (Node 21 wird von den Build-Tools nicht
> unterstützt – nicht verwenden.) In der Plesk-Node.js-Oberfläche dieselbe
> Version (≥ 20) auswählen, mit der gebaut wird.

## 2. Node.js-Anwendung einrichten

Unter **Websites & Domains → <Domain> → Node.js**:

| Einstellung                    | Wert                                                    |
|--------------------------------|---------------------------------------------------------|
| Node.js-Version                | 20 oder 22 (LTS)                                         |
| Anwendungsmodus                | production                                              |
| Anwendungsstammverzeichnis     | der Serverpfad aus Schritt 1                            |
| **Anwendungs-Startdatei**      | `.output/server/index.mjs`                             |
| Dokumentenstamm                | Anwendungsstamm (Passenger leitet alle Requests an Node) |

Nach dem ersten Build **„Anwendung neu starten“** klicken.

### Benutzerdefinierte Umgebungsvariablen

In der Node.js-Oberfläche unter „Benutzerdefinierte Umgebungsvariablen“ setzen:

| Variable                | Beispiel / Hinweis                                          |
|-------------------------|------------------------------------------------------------|
| `NUXT_SESSION_PASSWORD` | zufälliger String, **≥ 32 Zeichen**                        |
| `DB_PATH`               | `/var/www/vhosts/bbz-rd-eck.com/verbandbuch-data/verbandbuch.db` |
| `NUXT_AUTO_PROVISION`   | `true` (oder `false`, wenn nur freigeschaltete Konten dürfen) |
| `LDAP_URL`              | `ldaps://dc01.schule.local:636`                            |
| `LDAP_BASE_DN`          | `OU=Lehrkraefte,DC=schule,DC=local`                        |
| `LDAP_BIND_DN`          | Service-Account-DN (Service-Modus)                         |
| `LDAP_BIND_PW`          | Service-Account-Passwort                                   |
| `NUXT_INITIAL_ADMINS`   | optional – Default ist bereits `ClauD`                     |

> **Direkt-Bind ohne Service-Account:** Statt `LDAP_BIND_DN`/`LDAP_BIND_PW` die
> Variable `LDAP_BIND_USER_TEMPLATE` setzen, z. B. `SCHULE\{{username}}` oder
> `{{username}}@schule.local`. Weitere Optionen siehe `.env.example`.

## 3. Wichtig: Datenbank persistent halten

`DB_PATH` muss **außerhalb** des Deploy-Verzeichnisses liegen (siehe Beispiel
oben), damit ein Git-Pull/Redeploy die SQLite-Datei nicht überschreibt oder
entfernt. Das Verzeichnis einmalig anlegen und Schreibrechte für den
Anwendungsbenutzer sicherstellen:

```bash
mkdir -p /var/www/vhosts/bbz-rd-eck.com/verbandbuch-data
```

## 4. Erster Admin-Zugang

Es gibt zunächst **keinen** vorab angelegten Benutzer – Konten entstehen beim
ersten erfolgreichen LDAP-Login. Die in `NUXT_INITIAL_ADMINS` gelisteten
Kennungen (Default: **`ClauD`**) werden beim ersten Login automatisch als
**Administrator** angelegt. Danach kann `ClauD` weitere Admins über
**Benutzer → Rolle** vergeben.
```
