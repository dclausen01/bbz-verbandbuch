import {deleteKit, getDb} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    try {
        if (!deleteKit(getDb(), id)) {
            throw createError({statusCode: 404, statusMessage: 'Verbandkasten nicht gefunden'})
        }
    } catch (e: any) {
        if (e?.statusCode) throw e
        // Fremdschlüssel: am Kasten hängen noch Einträge.
        throw createError({
            statusCode: 409,
            statusMessage: 'Kasten kann nicht gelöscht werden, solange Einträge darauf verweisen',
        })
    }
    return {ok: true}
})
