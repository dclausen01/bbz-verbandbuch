import {createUser, findUserByLoginSub, getDb, type Role} from '../../utils/db'
import {requireAdmin} from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const body = await readBody(event)
    const loginSub = String(body?.loginSub ?? '').trim()
    const role: Role = body?.role === 'ADMIN' ? 'ADMIN' : 'REPORTER'
    const name = String(body?.name ?? '').trim()

    if (!loginSub) {
        throw createError({statusCode: 400, statusMessage: 'Login-Kennung (loginSub) ist erforderlich'})
    }

    const db = getDb()
    if (findUserByLoginSub(db, loginSub)) {
        throw createError({statusCode: 409, statusMessage: 'Diese Login-Kennung ist bereits angelegt'})
    }

    const user = createUser(db, loginSub, role, name)
    setResponseStatus(event, 201)
    return user
})
