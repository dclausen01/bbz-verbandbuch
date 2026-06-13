import {mkdirSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import Database from 'better-sqlite3'

/**
 * Zentrale SQLite-Anbindung (better-sqlite3) für den Monolithen.
 *
 * Bewusst ohne ORM: Das Datenmodell ist klein, und better-sqlite3 lässt sich
 * problemlos in das Nitro-Bundle einbinden (kein Decorator-/reflect-metadata-
 * Risiko wie bei TypeORM). Eine einzige Datei genügt für den Plesk-Betrieb –
 * kein separater Datenbank-Dienst nötig.
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
    mkdirSync(dirname(file), {recursive: true})

    db = new Database(file)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
    return db
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
            witness           TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_entries_kit ON entries(kit_id);
        CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(created_by);
    `)

    // Migrationen für bereits bestehende Datenbanken (Spalten ergänzen).
    ensureColumn(d, 'entries', 'created_at', "created_at TEXT NOT NULL DEFAULT ''")
    ensureColumn(d, 'entries', 'injured_person', "injured_person TEXT NOT NULL DEFAULT ''")
    ensureColumn(d, 'entries', 'injured_group', 'injured_group TEXT')
    ensureColumn(d, 'entries', 'accident_location', "accident_location TEXT NOT NULL DEFAULT ''")
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
           e.description, e.measures, e.material_list AS materialList, e.message, e.witness,
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
}

export function createEntry(d: Database.Database, input: EntryInput): EntryDTO {
    const id = randomUUID()
    d.prepare(
        `INSERT INTO entries (id, kit_id, created_by, occurred_at, created_at, injured_person, injured_group, accident_location, incident, first_aider, description, measures, material_list, message, witness)
         VALUES (@id, @kitId, @createdBy, @occurredAt, @createdAt, @injuredPerson, @injuredGroup, @accidentLocation, @incident, @firstAider, @description, @measures, @materialList, @message, @witness)`,
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
    }
    d.prepare(
        `UPDATE entries SET kit_id = @kitId, occurred_at = @occurredAt,
                injured_person = @injuredPerson, injured_group = @injuredGroup,
                accident_location = @accidentLocation, incident = @incident,
                first_aider = @firstAider, description = @description, measures = @measures,
                material_list = @materialList, message = @message, witness = @witness
          WHERE id = @id`,
    ).run({
        id,
        ...next,
        materialList: JSON.stringify(next.materialList ?? []),
    })
    return getEntry(d, id)
}

export function deleteEntry(d: Database.Database, id: string): boolean {
    return d.prepare('DELETE FROM entries WHERE id = ?').run(id).changes > 0
}
