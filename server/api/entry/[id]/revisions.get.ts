import {getDb, getEntry, listEntryRevisions} from '../../../utils/db'
import {requireAuth} from '../../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const id = getRouterParam(event, 'id') ?? ''
    const db = getDb()

    // Sichtbar für Admins und für die Person, die den Eintrag angelegt hat.
    const entry = getEntry(db, id)
    const revisions = listEntryRevisions(db, id)
    if (revisions.length === 0 && !entry) {
        throw createError({statusCode: 404, statusMessage: 'Keine Historie gefunden'})
    }

    const creatorId = entry?.createdBy.id ?? revisions[0]?.data.createdBy.id
    if (user.role !== 'ADMIN' && creatorId !== user.id) {
        throw createError({statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion'})
    }

    return revisions
})
