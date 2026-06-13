import {getDb, setKitProductQty} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    const body = await readBody(event)

    const patch: {targetQty?: number; currentQty?: number} = {}
    if (body?.targetQty !== undefined) patch.targetQty = Number(body.targetQty) || 0
    if (body?.currentQty !== undefined) patch.currentQty = Number(body.currentQty) || 0

    if (!setKitProductQty(getDb(), id, patch)) {
        throw createError({statusCode: 404, statusMessage: 'Bestandseintrag nicht gefunden'})
    }
    return {ok: true}
})
