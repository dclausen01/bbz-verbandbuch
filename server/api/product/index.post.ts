import {createProduct, getDb} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const body = await readBody(event)
    const type = String(body?.type ?? '').trim()
    if (!type) throw createError({statusCode: 400, statusMessage: 'type ist erforderlich'})

    try {
        const product = createProduct(getDb(), type)
        setResponseStatus(event, 201)
        return product
    } catch (e) {
        throw createError({statusCode: 409, statusMessage: 'Dieses Material existiert bereits'})
    }
})
