import {deleteEntry, getDb, getEntry, recordEntryRevision} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const id = getRouterParam(event, 'id') ?? ''
    const db = getDb()

    const entry = getEntry(db, id)
    if (!entry) throw createError({statusCode: 404, statusMessage: 'Eintrag nicht gefunden'})

    const istBerechtigt = user.role === 'ADMIN' || entry.createdBy.id === user.id
    if (!istBerechtigt) throw createError({statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion'})

    // Löschung revisionssicher protokollieren (Datenstand bleibt im Audit-Log).
    recordEntryRevision(db, 'DELETE', entry, {id: user.id, name: user.name})
    deleteEntry(db, id)
    return {ok: true}
})
