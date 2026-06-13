import {deleteProduct, getDb} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    if (!deleteProduct(getDb(), id)) {
        throw createError({statusCode: 404, statusMessage: 'Material nicht gefunden'})
    }
    return {ok: true}
})
