import {getDb, getEntry} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const id = getRouterParam(event, 'id') ?? ''
    const entry = getEntry(getDb(), id)

    if (!entry) throw createError({statusCode: 404, statusMessage: 'Eintrag nicht gefunden'})

    const istBerechtigt = user.role === 'ADMIN' || entry.createdBy.id === user.id
    if (!istBerechtigt) throw createError({statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion'})

    return entry
})
