import {createKit, createProduct, getDb, listKits, listProducts} from '../utils/db'

/**
 * Initialisiert die SQLite-Datenbank beim Serverstart (legt das Schema an) und
 * befüllt sie im Entwicklungsmodus mit ein paar Beispieldaten, damit die
 * Oberfläche sofort etwas anzeigen kann.
 */
export default defineNitroPlugin(() => {
    const db = getDb()

    if (!useRuntimeConfig().public.isDev) return

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
