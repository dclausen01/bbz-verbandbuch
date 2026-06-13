import {createKit, getDb} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const body = await readBody(event)
    const code = String(body?.code ?? '').trim()
    const location = String(body?.location ?? '').trim()

    if (!code || !location) {
        throw createError({statusCode: 400, statusMessage: 'code und location sind erforderlich'})
    }

    try {
        const kit = createKit(getDb(), code, location)
        setResponseStatus(event, 201)
        return kit
    } catch (e) {
        throw createError({statusCode: 409, statusMessage: 'Ein Kasten mit diesem Code existiert bereits'})
    }
})
