import {getDb, listEntries} from '../../utils/db'
import {requireAuth} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    const user = await requireAuth(event)
    const db = getDb()
    // Admins sehen alle Einträge, Reporter nur ihre eigenen.
    return user.role === 'ADMIN' ? listEntries(db) : listEntries(db, {userId: user.id})
})
