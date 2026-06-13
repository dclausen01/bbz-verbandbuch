import {getDb, updateKit} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    const body = await readBody(event)

    const patch: {code?: string; location?: string} = {}
    if (body?.code !== undefined) patch.code = String(body.code).trim()
    if (body?.location !== undefined) patch.location = String(body.location).trim()

    const kit = updateKit(getDb(), id, patch)
    if (!kit) throw createError({statusCode: 404, statusMessage: 'Verbandkasten nicht gefunden'})
    return kit
})
