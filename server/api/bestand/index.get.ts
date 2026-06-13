import {getDb, listKitProducts} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    return listKitProducts(getDb())
})
