import type {H3Event} from 'h3'
import type {Role} from './db'

/**
 * Im Session-Cookie gespeicherte Identität. Die Rolle stammt aus der lokalen
 * Datenbank, nicht aus dem AD (siehe server/api/login.post.ts).
 */
export interface SessionUser {
    id: number
    loginSub: string
    name: string
    role: Role
}

/** Erzwingt eine gültige Session und liefert den angemeldeten Nutzer. */
export async function requireAuth(event: H3Event): Promise<SessionUser> {
    const {user} = await requireUserSession(event)
    return user as SessionUser
}

/** Wie requireAuth, verlangt zusätzlich die ADMIN-Rolle. */
export async function requireAdmin(event: H3Event): Promise<SessionUser> {
    const user = await requireAuth(event)
    if (user.role !== 'ADMIN') {
        throw createError({statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion'})
    }
    return user
}
