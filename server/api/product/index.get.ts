import {getDb, listProducts} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAuth(event)
    return listProducts(getDb())
})
