import {getDb, maybePurgeExpiredEntries} from '../utils/db'

/**
 * Prüft bei Zugriffen (gedrosselt auf max. 1×/12 h), ob Einträge die
 * Aufbewahrungsfrist überschritten haben, und löscht sie ggf. So bleibt die
 * Speicherbegrenzung (DSGVO) auch ohne separaten Cron-Job gewahrt.
 */
export default defineEventHandler(() => {
    const years = Number(useRuntimeConfig().retentionYears) || 5
    maybePurgeExpiredEntries(getDb(), years)
})
