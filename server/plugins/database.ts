import {createKit, createProduct, getDb, listKits, listProducts, purgeExpiredEntries} from '../utils/db'

/**
 * Initialisiert die SQLite-Datenbank beim Serverstart (legt das Schema an),
 * löscht abgelaufene Einträge (Aufbewahrungsfrist) und befüllt sie im
 * Entwicklungsmodus mit Beispieldaten.
 */
export default defineNitroPlugin(() => {
    const config = useRuntimeConfig()
    const db = getDb()

    // Aufbewahrungsfrist direkt beim Start prüfen.
    try {
        purgeExpiredEntries(db, Number(config.retentionYears) || 5)
    } catch (e) {
        console.error('[DB] Aufbewahrungs-Löschung beim Start fehlgeschlagen:', e)
    }

    if (!config.public.isDev) return

    if (listKits(db).length === 0) {
        createKit(db, 'KASTEN-001', 'Raum 1.12')
        createKit(db, 'KASTEN-002', 'Werkstatt EG')
        createKit(db, 'KASTEN-003', 'Sporthalle')
    }
    if (listProducts(db).length === 0) {
        for (const type of [
            'Pflasterstrips',
            'Wundpflaster (groß)',
            'Sterile Kompresse',
            'Mullbinde',
            'Elastische Binde',
            'Dreiecktuch',
            'Einmalhandschuhe',
            'Desinfektionstuch',
            'Kühlkompresse',
            'Schere',
        ]) {
            createProduct(db, type)
        }
    }
})
