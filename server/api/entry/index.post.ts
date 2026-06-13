import {applyMaterialWithdrawal, createEntry, getDb, getKit, type MaterialItem} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const body = await readBody(event)

    const kitId = String(body?.kitId ?? '')
    const occurredAt = body?.occurredAt ? new Date(body.occurredAt) : null
    const injuredPerson = String(body?.injuredPerson ?? '').trim()
    const accidentLocation = String(body?.accidentLocation ?? '').trim()
    const description = String(body?.description ?? '').trim()
    const firstAider = String(body?.firstAider ?? '').trim()
    const materialList = body?.materialList

    if (
        !kitId ||
        !occurredAt ||
        !injuredPerson ||
        !accidentLocation ||
        !description ||
        !firstAider ||
        !Array.isArray(materialList)
    ) {
        throw createError({
            statusCode: 400,
            statusMessage:
                'kitId, occurredAt, injuredPerson, accidentLocation, description, firstAider und materialList sind erforderlich',
        })
    }
    if (isNaN(occurredAt.getTime())) {
        throw createError({statusCode: 400, statusMessage: 'Ungültiges Datum für occurredAt'})
    }

    const db = getDb()
    if (!getKit(db, kitId)) {
        throw createError({statusCode: 404, statusMessage: 'Verbandkasten nicht gefunden'})
    }

    const entry = createEntry(db, {
        kitId,
        createdBy: user.id,
        occurredAt: occurredAt.toISOString(),
        injuredPerson,
        injuredGroup: body?.injuredGroup != null ? String(body.injuredGroup).trim() : null,
        accidentLocation,
        incident: String(body?.incident ?? '').trim(),
        firstAider,
        description,
        measures: body?.measures != null ? String(body.measures).trim() : null,
        materialList: (materialList as MaterialItem[]).map((m) => ({
            type: String(m.type),
            quantity: Number(m.quantity) || 0,
        })),
        message: body?.message != null ? String(body.message).trim() : null,
        witness: body?.witness != null ? String(body.witness).trim() : null,
    })

    // Entnommenes Material automatisch vom Bestand des Kastens abbuchen
    // (nur für Materialien, für die ein Bestand geführt wird).
    applyMaterialWithdrawal(db, kitId, entry.materialList)

    setResponseStatus(event, 201)
    return entry
})
