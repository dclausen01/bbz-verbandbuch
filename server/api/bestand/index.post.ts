import {getDb, upsertKitProduct} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const body = await readBody(event)
    const kitId = String(body?.kitId ?? '')
    const productId = String(body?.productId ?? '')
    const targetQty = Number(body?.targetQty) || 0
    const currentQty = Number(body?.currentQty) || 0

    if (!kitId || !productId) {
        throw createError({statusCode: 400, statusMessage: 'kitId und productId sind erforderlich'})
    }

    upsertKitProduct(getDb(), kitId, productId, targetQty, currentQty)
    setResponseStatus(event, 201)
    return {ok: true}
})
