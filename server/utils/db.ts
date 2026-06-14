import {chmodSync, mkdirSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import Database from 'better-sqlite3-multiple-ciphers'

/**
 * Zentrale SQLite-Anbindung (better-sqlite3-multiple-ciphers) für den Monolithen.
 *
 * Bewusst ohne ORM: Das Datenmodell ist klein, und better-sqlite3 lässt sich
 * problemlos in das Nitro-Bundle einbinden (kein Decorator-/reflect-metadata-
 * Risiko wie bei TypeORM). Eine einzige Datei genügt für den Plesk-Betrieb –
 * kein separater Datenbank-Dienst nötig.
 *
 * Verschlüsselung „at rest": Ist DB_ENCRYPTION_KEY gesetzt, wird die Datei mit
 * SQLCipher verschlüsselt. Eine bereits vorhandene Klartext-Datei wird beim
 * ersten Start transparent verschlüsselt (PRAGMA rekey).
 */

export type Role = 'REPORTER' | 'ADMIN'

export interface UserRow {
    id: number
    loginSub: string
    name: string
    role: Role
}

export interface FirstAidKitDTO {
    id: string
    code: string
    location: string
    createdAt: string
}

export interface ProductDTO {
    id: string
    type: string
}

export interface MaterialItem {
    type: string
    quantity: number
}

export interface EntryDTO {
    id: string
    kit: FirstAidKitDTO
    createdBy: {id: number; name: string; role: Role}
    occurredAt: string
    createdAt: string
    injuredPerson: string
    injuredGroup: string | null
    accidentLocation: string
    incident: string
    firstAider: string
    description: string
    measures: string | null
    materialList: MaterialItem[]
    message: string | null
    witness: string | null
    reportable: boolean
}

export interface KitProductDTO {
    id: string
    kit: FirstAidKitDTO
    product: ProductDTO
    targetQty: number
    currentQty: number
    updatedAt: string
}

let db: Database.Database | null = null

/** Liefert die (lazy initialisierte) Datenbankverbindung als Singleton. */
export function getDb(): Database.Database {
    if (db) return db

    const configured = useRuntimeConfig().dbPath || process.env.DB_PATH
    const file = configured ? resolve(configured) : resolve(process.cwd(), 'data', 'verbandbuch.db')
    mkdirSync(dirname(file), {recursive: true, mode: 0o700})

    db = openDatabase(file, process.env.DB_ENCRYPTION_KEY)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
    hardenFilePermissions(file)
    return db
}

function canRead(d: Database.Database): boolean {
    try {
        d.prepare('SELECT count(*) FROM sqlite_master').get()
        return true
    } catch {
        return false
    }
}

/**
 * Öffnet die Datenbank und wendet – falls DB_ENCRYPTION_KEY gesetzt ist – die
 * Verschlüsselung an. Eine bereits vorhandene Klartext-Datei wird transparent
 * verschlüsselt. Der Schlüssel wird stets ZUERST gesetzt (SQLCipher-Vorgabe);
 * zum Umschlüsseln (rekey) muss WAL vorher beendet werden.
 */
function openDatabase(file: string, key: string | undefined): Database.Database {
    let d = new Database(file)
    if (!key) {
        console.warn(
            '[DB] DB_ENCRYPTION_KEY ist nicht gesetzt – die Datenbank wird UNVERSCHLÜSSELT gespeichert. ' +
                'Für den Produktivbetrieb mit Gesundheitsdaten dringend einen Schlüssel setzen.',
        )
        return d
    }
    const escaped = key.replace(/'/g, "''")

    // 1) Versuch: als verschlüsselte DB mit dem Schlüssel öffnen
    //    (gilt auch für eine neue, leere Datei – sie wird damit verschlüsselt).
    d.pragma(`key='${escaped}'`)
    if (canRead(d)) return d

    // 2) Schlüssel passt nicht → evtl. bestehende KLARTEXT-Datei. Frisch ohne
    //    Schlüssel öffnen und prüfen.
    d.close()
    d = new Database(file)
    if (canRead(d)) {
        // Klartext-DB transparent verschlüsseln. rekey verlangt non-WAL:
        try {
            d.pragma('wal_checkpoint(TRUNCATE)')
        } catch {
            /* evtl. nicht im WAL-Modus – egal */
        }
        d.pragma('journal_mode = DELETE')
        d.pragma(`rekey='${escaped}'`)
        console.info('[DB] Bestehende Klartext-Datenbank wurde verschlüsselt (rekey).')
        return d
    }

    // 3) Weder mit Schlüssel noch als Klartext lesbar → falscher Schlüssel.
    d.close()
    throw new Error(
        'Datenbank konnte nicht entschlüsselt werden – stimmt DB_ENCRYPTION_KEY mit der vorhandenen Datei überein?',
    )
}

/** Beschränkt die Dateirechte der DB (und WAL/SHM) auf den Eigentümer (0600). */
function hardenFilePermissions(file: string): void {
    for (const f of [file, `${file}-wal`, `${file}-shm`]) {
        try {
            chmodSync(f, 0o600)
        } catch {
            /* Datei existiert evtl. noch nicht – ignorieren */
        }
    }
}

function initSchema(d: Database.Database): void {
    d.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            login_sub TEXT NOT NULL UNIQUE,
            name      TEXT NOT NULL DEFAULT '',
            role      TEXT NOT NULL DEFAULT 'REPORTER'
        );

        CREATE TABLE IF NOT EXISTS first_aid_kits (
            id         TEXT PRIMARY KEY,
            code       TEXT NOT NULL UNIQUE,
            location   TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id   TEXT PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS kit_products (
            id          TEXT PRIMARY KEY,
            kit_id      TEXT NOT NULL REFERENCES first_aid_kits(id) ON DELETE CASCADE,
            product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            target_qty  INTEGER NOT NULL DEFAULT 0,
            current_qty INTEGER NOT NULL DEFAULT 0,
            updated_at  TEXT NOT NULL,
            UNIQUE (kit_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS entries (
            id                TEXT PRIMARY KEY,
            kit_id            TEXT NOT NULL REFERENCES first_aid_kits(id) ON DELETE RESTRICT,
            created_by        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            occurred_at       TEXT NOT NULL,
            created_at        TEXT NOT NULL DEFAULT '',
            injured_person    TEXT NOT NULL DEFAULT '',
            injured_group     TEXT,
            accident_location TEXT NOT NULL DEFAULT '',
            incident          TEXT NOT NULL DEFAULT '',
            first_aider       TEXT NOT NULL DEFAULT '',
            description       TEXT NOT NULL DEFAULT '',
            measures          TEXT,
            material_list     TEXT NOT NULL DEFAULT '[]',
            message           TEXT,
            witness           TEXT,
            reportable        INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_entries_kit ON entries(kit_id);
        CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(created_by);

        -- Revisions-/Audit-Protokoll (append-only, mit Hash-Kette zur
        -- Manipulationserkennung). Jede Änderung an einem Eintrag erzeugt hier
        -- eine Zeile mit vollständigem Datenstand.
        CREATE TABLE IF NOT EXISTS entry_revisions (
            seq            INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id       TEXT NOT NULL,
            action         TEXT NOT NULL,
            changed_by_id  INTEGER,
            changed_by     TEXT NOT NULL DEFAULT '',
            changed_at     TEXT NOT NULL,
            data_json      TEXT NOT NULL,
            prev_hash      TEXT NOT NULL DEFAULT '',
            hash           TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_revisions_entry ON entry_revisions(entry_id);
    `)

    // Migrationen für bereits bestehende Datenbanken (Spalten ergänzen).
    ensureColumn(d, 'entries', 'created_at', "created_at TEXT NOT NULL DEFAULT ''")
    ensureColumn(d, 'entries', 'injured_person', "injured_person TEXT NOT NULL DEFAULT ''")
    ensureColumn(d, 'entries', 'injured_group', 'injured_group TEXT')
    ensureColumn(d, 'entries', 'accident_location', "accident_location TEXT NOT NULL DEFAULT ''")
    ensureColumn(d, 'entries', 'reportable', 'reportable INTEGER NOT NULL DEFAULT 0')
}

/** Ergänzt eine Spalte, falls sie noch nicht existiert (einfache Migration). */
function ensureColumn(d: Database.Database, table: string, column: string, ddl: string): void {
    const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{name: string}>
    if (!cols.some((c) => c.name === column)) {
        d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    }
}

/* ----------------------------- Benutzer ------------------------------ */

export function findUserByLoginSub(d: Database.Database, loginSub: string): UserRow | undefined {
    const row = d
        .prepare('SELECT id, login_sub AS loginSub, name, role FROM users WHERE login_sub = ?')
        .get(loginSub) as UserRow | undefined
    return row
}

export function listUsers(d: Database.Database): UserRow[] {
    return d
        .prepare('SELECT id, login_sub AS loginSub, name, role FROM users ORDER BY name, login_sub')
        .all() as UserRow[]
}

export function createUser(d: Database.Database, loginSub: string, role: Role, name = ''): UserRow {
    const info = d
        .prepare('INSERT INTO users (login_sub, name, role) VALUES (?, ?, ?)')
        .run(loginSub, name, role)
    return {id: Number(info.lastInsertRowid), loginSub, name, role}
}

export function updateUserName(d: Database.Database, id: number, name: string): void {
    d.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id)
}

export function updateUserRole(d: Database.Database, id: number, role: Role): void {
    d.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
}

export function deleteUser(d: Database.Database, id: number): boolean {
    return d.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0
}

/* --------------------------- Verbandkästen --------------------------- */

export function listKits(d: Database.Database): FirstAidKitDTO[] {
    return d
        .prepare('SELECT id, code, location, created_at AS createdAt FROM first_aid_kits ORDER BY created_at DESC')
        .all() as FirstAidKitDTO[]
}

export function getKit(d: Database.Database, id: string): FirstAidKitDTO | undefined {
    return d
        .prepare('SELECT id, code, location, created_at AS createdAt FROM first_aid_kits WHERE id = ?')
        .get(id) as FirstAidKitDTO | undefined
}

export function createKit(d: Database.Database, code: string, location: string): FirstAidKitDTO {
    const kit: FirstAidKitDTO = {id: randomUUID(), code, location, createdAt: new Date().toISOString()}
    d.prepare('INSERT INTO first_aid_kits (id, code, location, created_at) VALUES (?, ?, ?, ?)').run(
        kit.id,
        kit.code,
        kit.location,
        kit.createdAt,
    )
    return kit
}

export function updateKit(
    d: Database.Database,
    id: string,
    patch: {code?: string; location?: string},
): FirstAidKitDTO | undefined {
    const existing = getKit(d, id)
    if (!existing) return undefined
    const code = patch.code ?? existing.code
    const location = patch.location ?? existing.location
    d.prepare('UPDATE first_aid_kits SET code = ?, location = ? WHERE id = ?').run(code, location, id)
    return {...existing, code, location}
}

export function deleteKit(d: Database.Database, id: string): boolean {
    return d.prepare('DELETE FROM first_aid_kits WHERE id = ?').run(id).changes > 0
}

/* ------------------------------ Produkte ----------------------------- */

export function listProducts(d: Database.Database): ProductDTO[] {
    return d.prepare('SELECT id, type FROM products ORDER BY type').all() as ProductDTO[]
}

export function createProduct(d: Database.Database, type: string): ProductDTO {
    const product: ProductDTO = {id: randomUUID(), type}
    d.prepare('INSERT INTO products (id, type) VALUES (?, ?)').run(product.id, product.type)
    return product
}

export function deleteProduct(d: Database.Database, id: string): boolean {
    return d.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0
}

/* --------------------------- Bestände (kit_products) --------------------------- */

export function listKitProducts(d: Database.Database): KitProductDTO[] {
    const rows = d
        .prepare(
            `SELECT kp.id, kp.target_qty AS targetQty, kp.current_qty AS currentQty, kp.updated_at AS updatedAt,
                    k.id AS kitId, k.code AS kitCode, k.location AS kitLocation, k.created_at AS kitCreatedAt,
                    p.id AS productId, p.type AS productType
               FROM kit_products kp
               JOIN first_aid_kits k ON k.id = kp.kit_id
               JOIN products p ON p.id = kp.product_id
              ORDER BY k.location, p.type`,
        )
        .all() as Array<Record<string, unknown>>
    return rows.map((r) => ({
        id: String(r.id),
        targetQty: Number(r.targetQty),
        currentQty: Number(r.currentQty),
        updatedAt: String(r.updatedAt),
        kit: {
            id: String(r.kitId),
            code: String(r.kitCode),
            location: String(r.kitLocation),
            createdAt: String(r.kitCreatedAt),
        },
        product: {id: String(r.productId), type: String(r.productType)},
    }))
}

export function upsertKitProduct(
    d: Database.Database,
    kitId: string,
    productId: string,
    targetQty: number,
    currentQty: number,
): void {
    d.prepare(
        `INSERT INTO kit_products (id, kit_id, product_id, target_qty, current_qty, updated_at)
              VALUES (@id, @kitId, @productId, @targetQty, @currentQty, @updatedAt)
         ON CONFLICT (kit_id, product_id)
         DO UPDATE SET target_qty = @targetQty, current_qty = @currentQty, updated_at = @updatedAt`,
    ).run({
        id: randomUUID(),
        kitId,
        productId,
        targetQty,
        currentQty,
        updatedAt: new Date().toISOString(),
    })
}

export function setKitProductQty(
    d: Database.Database,
    id: string,
    patch: {targetQty?: number; currentQty?: number},
): boolean {
    const row = d.prepare('SELECT target_qty AS t, current_qty AS c FROM kit_products WHERE id = ?').get(id) as
        | {t: number; c: number}
        | undefined
    if (!row) return false
    const targetQty = patch.targetQty ?? row.t
    const currentQty = patch.currentQty ?? row.c
    d.prepare('UPDATE kit_products SET target_qty = ?, current_qty = ?, updated_at = ? WHERE id = ?').run(
        targetQty,
        currentQty,
        new Date().toISOString(),
        id,
    )
    return true
}

/* ------------------------------ Einträge ----------------------------- */

interface EntryJoinRow {
    id: string
    occurredAt: string
    createdAt: string
    injuredPerson: string
    injuredGroup: string | null
    accidentLocation: string
    incident: string
    firstAider: string
    description: string
    measures: string | null
    materialList: string
    message: string | null
    witness: string | null
    reportable: number
    kitId: string
    kitCode: string
    kitLocation: string
    kitCreatedAt: string
    userId: number
    userName: string
    userRole: Role
}

const ENTRY_SELECT = `
    SELECT e.id, e.occurred_at AS occurredAt, e.created_at AS createdAt,
           e.injured_person AS injuredPerson, e.injured_group AS injuredGroup,
           e.accident_location AS accidentLocation,
           e.incident, e.first_aider AS firstAider,
           e.description, e.measures, e.material_list AS materialList, e.message, e.witness, e.reportable,
           k.id AS kitId, k.code AS kitCode, k.location AS kitLocation, k.created_at AS kitCreatedAt,
           u.id AS userId, u.name AS userName, u.role AS userRole
      FROM entries e
      JOIN first_aid_kits k ON k.id = e.kit_id
      JOIN users u ON u.id = e.created_by`

function mapEntry(r: EntryJoinRow): EntryDTO {
    let materialList: MaterialItem[] = []
    try {
        const parsed = JSON.parse(r.materialList)
        if (Array.isArray(parsed)) materialList = parsed
    } catch {
        /* defekte JSON-Spalte → leere Liste */
    }
    return {
        id: r.id,
        occurredAt: r.occurredAt,
        // Fallback für vor der Migration angelegte Einträge ohne Eintragungsdatum.
        createdAt: r.createdAt || r.occurredAt,
        injuredPerson: r.injuredPerson ?? '',
        injuredGroup: r.injuredGroup ?? null,
        accidentLocation: r.accidentLocation ?? '',
        incident: r.incident,
        firstAider: r.firstAider,
        description: r.description,
        measures: r.measures,
        materialList,
        message: r.message,
        witness: r.witness,
        reportable: !!r.reportable,
        kit: {id: r.kitId, code: r.kitCode, location: r.kitLocation, createdAt: r.kitCreatedAt},
        createdBy: {id: r.userId, name: r.userName, role: r.userRole},
    }
}

export function listEntries(d: Database.Database, opts: {userId?: number} = {}): EntryDTO[] {
    const where = opts.userId ? ' WHERE e.created_by = ?' : ''
    const stmt = d.prepare(`${ENTRY_SELECT}${where} ORDER BY e.occurred_at DESC`)
    const rows = (opts.userId ? stmt.all(opts.userId) : stmt.all()) as EntryJoinRow[]
    return rows.map(mapEntry)
}

export function getEntry(d: Database.Database, id: string): EntryDTO | undefined {
    const row = d.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).get(id) as EntryJoinRow | undefined
    return row ? mapEntry(row) : undefined
}

export interface EntryInput {
    kitId: string
    createdBy: number
    occurredAt: string
    injuredPerson: string
    injuredGroup: string | null
    accidentLocation: string
    incident: string
    firstAider: string
    description: string
    measures: string | null
    materialList: MaterialItem[]
    message: string | null
    witness: string | null
    reportable: boolean
}

export function createEntry(d: Database.Database, input: EntryInput): EntryDTO {
    const id = randomUUID()
    d.prepare(
        `INSERT INTO entries (id, kit_id, created_by, occurred_at, created_at, injured_person, injured_group, accident_location, incident, first_aider, description, measures, material_list, message, witness, reportable)
         VALUES (@id, @kitId, @createdBy, @occurredAt, @createdAt, @injuredPerson, @injuredGroup, @accidentLocation, @incident, @firstAider, @description, @measures, @materialList, @message, @witness, @reportable)`,
    ).run({
        id,
        kitId: input.kitId,
        createdBy: input.createdBy,
        occurredAt: input.occurredAt,
        createdAt: new Date().toISOString(),
        injuredPerson: input.injuredPerson,
        injuredGroup: input.injuredGroup,
        accidentLocation: input.accidentLocation,
        incident: input.incident,
        firstAider: input.firstAider,
        description: input.description,
        measures: input.measures,
        materialList: JSON.stringify(input.materialList ?? []),
        message: input.message,
        witness: input.witness,
        reportable: input.reportable ? 1 : 0,
    })
    return getEntry(d, id)!
}

/**
 * Bucht entnommenes Material vom Bestand des Kastens ab. Für jede Position wird
 * das Produkt per Typ-Name gesucht und – falls für diesen Kasten ein Bestand
 * (kit_products) geführt wird – der Ist-Bestand um die Menge reduziert (nie
 * unter 0). Materialien ohne geführten Bestand werden übersprungen.
 * Läuft als Transaktion.
 */
export function applyMaterialWithdrawal(
    d: Database.Database,
    kitId: string,
    items: MaterialItem[],
): void {
    const findProduct = d.prepare('SELECT id FROM products WHERE type = ?')
    const findKitProduct = d.prepare(
        'SELECT id, current_qty AS currentQty FROM kit_products WHERE kit_id = ? AND product_id = ?',
    )
    const updateQty = d.prepare('UPDATE kit_products SET current_qty = ?, updated_at = ? WHERE id = ?')

    const tx = d.transaction((list: MaterialItem[]) => {
        for (const item of list) {
            const menge = Number(item.quantity) || 0
            if (menge <= 0) continue
            const product = findProduct.get(item.type) as {id: string} | undefined
            if (!product) continue
            const kp = findKitProduct.get(kitId, product.id) as
                | {id: string; currentQty: number}
                | undefined
            if (!kp) continue
            const next = Math.max(0, kp.currentQty - menge)
            updateQty.run(next, new Date().toISOString(), kp.id)
        }
    })
    tx(items)
}


export function updateEntry(
    d: Database.Database,
    id: string,
    input: Partial<EntryInput>,
): EntryDTO | undefined {
    const existing = getEntry(d, id)
    if (!existing) return undefined
    const next = {
        kitId: input.kitId ?? existing.kit.id,
        occurredAt: input.occurredAt ?? existing.occurredAt,
        injuredPerson: input.injuredPerson ?? existing.injuredPerson,
        injuredGroup: input.injuredGroup !== undefined ? input.injuredGroup : existing.injuredGroup,
        accidentLocation: input.accidentLocation ?? existing.accidentLocation,
        incident: input.incident ?? existing.incident,
        firstAider: input.firstAider ?? existing.firstAider,
        description: input.description ?? existing.description,
        measures: input.measures !== undefined ? input.measures : existing.measures,
        materialList: input.materialList ?? existing.materialList,
        message: input.message !== undefined ? input.message : existing.message,
        witness: input.witness !== undefined ? input.witness : existing.witness,
        reportable: input.reportable !== undefined ? input.reportable : existing.reportable,
    }
    d.prepare(
        `UPDATE entries SET kit_id = @kitId, occurred_at = @occurredAt,
                injured_person = @injuredPerson, injured_group = @injuredGroup,
                accident_location = @accidentLocation, incident = @incident,
                first_aider = @firstAider, description = @description, measures = @measures,
                material_list = @materialList, message = @message, witness = @witness,
                reportable = @reportable
          WHERE id = @id`,
    ).run({
        id,
        ...next,
        materialList: JSON.stringify(next.materialList ?? []),
        reportable: next.reportable ? 1 : 0,
    })
    return getEntry(d, id)
}

export function deleteEntry(d: Database.Database, id: string): boolean {
    return d.prepare('DELETE FROM entries WHERE id = ?').run(id).changes > 0
}

/* --------------------- Revisionssicherheit / Paper Trail --------------------- */

export type RevisionAction = 'CREATE' | 'UPDATE' | 'DELETE'

export interface RevisionActor {
    id: number
    name: string
}

export interface RevisionDTO {
    seq: number
    entryId: string
    action: RevisionAction
    changedById: number | null
    changedBy: string
    changedAt: string
    data: EntryDTO
    prevHash: string
    hash: string
    /** Ergebnis der Hash-Ketten-Prüfung (true = unverändert). */
    valid: boolean
}

/**
 * Schreibt eine Revision in das append-only Audit-Protokoll. Über eine
 * SHA-256-Hash-Kette (jeder Eintrag bindet den Hash des vorherigen ein) lassen
 * sich nachträgliche Manipulationen am Protokoll erkennen.
 */
export function recordEntryRevision(
    d: Database.Database,
    action: RevisionAction,
    entry: EntryDTO,
    actor: RevisionActor,
): void {
    const changedAt = new Date().toISOString()
    const dataJson = JSON.stringify(entry)
    const prev = d.prepare('SELECT hash FROM entry_revisions ORDER BY seq DESC LIMIT 1').get() as
        | {hash: string}
        | undefined
    const prevHash = prev?.hash ?? ''
    const hash = createHash('sha256')
        .update(prevHash + entry.id + action + changedAt + String(actor.id) + dataJson)
        .digest('hex')
    d.prepare(
        `INSERT INTO entry_revisions (entry_id, action, changed_by_id, changed_by, changed_at, data_json, prev_hash, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(entry.id, action, actor.id, actor.name, changedAt, dataJson, prevHash, hash)
}

/** Liefert die Revisionen eines Eintrags (älteste zuerst) inkl. Ketten-Prüfung. */
export function listEntryRevisions(d: Database.Database, entryId: string): RevisionDTO[] {
    const rows = d
        .prepare('SELECT * FROM entry_revisions WHERE entry_id = ? ORDER BY seq ASC')
        .all(entryId) as Array<Record<string, any>>
    return rows.map((r) => {
        const recomputed = createHash('sha256')
            .update(r.prev_hash + r.entry_id + r.action + r.changed_at + String(r.changed_by_id) + r.data_json)
            .digest('hex')
        return {
            seq: r.seq,
            entryId: r.entry_id,
            action: r.action,
            changedById: r.changed_by_id,
            changedBy: r.changed_by,
            changedAt: r.changed_at,
            data: JSON.parse(r.data_json),
            prevHash: r.prev_hash,
            hash: r.hash,
            valid: recomputed === r.hash,
        }
    })
}

/* ------------------------ Aufbewahrung / Löschung ------------------------ */

/**
 * Löscht Einträge, deren Unfalldatum älter als die Aufbewahrungsfrist ist
 * (DSGVO-Speicherbegrenzung; DGUV-Mindestfrist 5 Jahre). Gelöschte Einträge
 * werden zuvor im Revisionsprotokoll vermerkt. Gibt die Anzahl zurück.
 */
export function purgeExpiredEntries(d: Database.Database, retentionYears: number): number {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - retentionYears)
    const cutoffIso = cutoff.toISOString()

    const expired = d
        .prepare('SELECT id FROM entries WHERE occurred_at < ?')
        .all(cutoffIso) as Array<{id: string}>
    if (expired.length === 0) return 0

    const system: RevisionActor = {id: 0, name: 'System (Aufbewahrungsfrist)'}
    const tx = d.transaction((ids: Array<{id: string}>) => {
        for (const {id} of ids) {
            const entry = getEntry(d, id)
            if (entry) recordEntryRevision(d, 'DELETE', entry, system)
            d.prepare('DELETE FROM entries WHERE id = ?').run(id)
        }
    })
    tx(expired)
    console.info(`[DB] Aufbewahrung: ${expired.length} abgelaufene Eintrag/Einträge gelöscht (älter als ${cutoffIso}).`)
    return expired.length
}

let lastPurge = 0
/**
 * Stößt die Löschung abgelaufener Einträge an – höchstens einmal alle 12 Stunden,
 * damit das bei jedem Request aufgerufen werden kann, ohne zu bremsen.
 */
export function maybePurgeExpiredEntries(d: Database.Database, retentionYears: number): void {
    const now = Date.now()
    if (now - lastPurge < 12 * 60 * 60 * 1000) return
    lastPurge = now
    try {
        purgeExpiredEntries(d, retentionYears)
    } catch (e) {
        console.error('[DB] Aufbewahrungs-Löschung fehlgeschlagen:', e)
    }
}
