import {getDb, getEntry, getKit, updateEntry, type EntryInput, type MaterialItem} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const id = getRouterParam(event, 'id') ?? ''
    const db = getDb()

    const entry = getEntry(db, id)
    if (!entry) throw createError({statusCode: 404, statusMessage: 'Eintrag nicht gefunden'})

    const istBerechtigt = user.role === 'ADMIN' || entry.createdBy.id === user.id
    if (!istBerechtigt) throw createError({statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion'})

    const body = await readBody(event)
    const patch: Partial<EntryInput> = {}

    if (body?.kitId !== undefined) {
        if (!getKit(db, String(body.kitId))) {
            throw createError({statusCode: 404, statusMessage: 'Verbandkasten nicht gefunden'})
        }
        patch.kitId = String(body.kitId)
    }
    if (body?.occurredAt !== undefined) {
        const d = new Date(body.occurredAt)
        if (isNaN(d.getTime())) throw createError({statusCode: 400, statusMessage: 'Ungültiges Datum für occurredAt'})
        patch.occurredAt = d.toISOString()
    }
    if (body?.incident !== undefined) patch.incident = String(body.incident).trim()
    if (body?.firstAider !== undefined) patch.firstAider = String(body.firstAider).trim()
    if (body?.description !== undefined) patch.description = String(body.description).trim()
    if (body?.measures !== undefined) patch.measures = body.measures === null ? null : String(body.measures).trim()
    if (body?.message !== undefined) patch.message = body.message === null ? null : String(body.message).trim()
    if (body?.witness !== undefined) patch.witness = body.witness === null ? null : String(body.witness).trim()
    if (body?.materialList !== undefined) {
        if (!Array.isArray(body.materialList)) {
            throw createError({statusCode: 400, statusMessage: 'materialList muss ein Array sein'})
        }
        patch.materialList = (body.materialList as MaterialItem[]).map((m) => ({
            type: String(m.type),
            quantity: Number(m.quantity) || 0,
        }))
    }

    return updateEntry(db, id, patch)
})
