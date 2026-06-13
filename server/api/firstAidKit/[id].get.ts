import {getDb, getKit} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAuth(event)
    const id = getRouterParam(event, 'id') ?? ''
    const kit = getKit(getDb(), id)
    if (!kit) throw createError({statusCode: 404, statusMessage: 'Verbandkasten nicht gefunden'})
    return kit
})
