import {deleteUser, getDb} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const admin = await requireAdmin(event)
    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id)) throw createError({statusCode: 400, statusMessage: 'Ungültige ID'})
    if (id === admin.id) {
        throw createError({statusCode: 400, statusMessage: 'Das eigene Konto kann nicht gelöscht werden'})
    }

    try {
        if (!deleteUser(getDb(), id)) {
            throw createError({statusCode: 404, statusMessage: 'Benutzer nicht gefunden'})
        }
    } catch (e: any) {
        if (e?.statusCode) throw e
        throw createError({
            statusCode: 409,
            statusMessage: 'Benutzer kann nicht gelöscht werden, solange Einträge zugeordnet sind',
        })
    }
    return {ok: true}
})
