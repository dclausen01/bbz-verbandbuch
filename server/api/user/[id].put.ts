import {getDb, updateUserRole, type Role} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const admin = await requireAdmin(event)
    const id = Number(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const role: Role = body?.role === 'ADMIN' ? 'ADMIN' : 'REPORTER'

    if (!Number.isInteger(id)) throw createError({statusCode: 400, statusMessage: 'Ungültige ID'})
    // Sich selbst nicht herabstufen – verhindert versehentliche Aussperrung.
    if (id === admin.id && role !== 'ADMIN') {
        throw createError({statusCode: 400, statusMessage: 'Die eigene Admin-Rolle kann nicht entzogen werden'})
    }

    updateUserRole(getDb(), id, role)
    return {ok: true}
})
