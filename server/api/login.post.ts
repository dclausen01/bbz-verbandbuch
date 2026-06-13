import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {LdapAuthenticator, ldapConfigAusEnv, type AuthErgebnis} from '../utils/ldap'
import {
    createUser,
    findUserByLoginSub,
    getDb,
    updateUserName,
    updateUserRole,
    type Role,
} from '../utils/db'

interface DevUser {
    loginSub: string
    name: string
    role?: Role
}

function ladeDevUsers(): DevUser[] {
    try {
        const pfad = resolve(process.cwd(), 'devUser.json')
        const parsed = JSON.parse(readFileSync(pfad, 'utf-8'))
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function alsListe(wert: string | undefined): string[] {
    return (wert ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')

    if (!username || !password) {
        throw createError({statusCode: 400, statusMessage: 'Benutzername und Passwort sind erforderlich'})
    }

    const config = useRuntimeConfig()
    let auth: AuthErgebnis | null
    let devRole: Role | undefined

    if (config.public.isDev) {
        // Entwicklungsmodus: kein LDAP, Identität aus devUser.json (Passwort wird ignoriert).
        const devUsers = ladeDevUsers()
        const dev = devUsers[config.public.devUserIndex] ?? devUsers[0]
        auth = dev ? {loginSub: dev.loginSub, name: dev.name} : null
        devRole = dev?.role
    } else {
        try {
            const authenticator = new LdapAuthenticator(ldapConfigAusEnv())
            auth = await authenticator.authenticate(username, password)
        } catch (e) {
            console.error('[LDAP] Authentifizierung fehlgeschlagen:', e)
            throw createError({statusCode: 500, statusMessage: 'Authentifizierung derzeit nicht möglich'})
        }
    }

    if (!auth) {
        throw createError({statusCode: 401, statusMessage: 'Ungültiger Benutzername oder Passwort'})
    }

    const db = getDb()
    const initialAdmins = alsListe(config.initialAdmins)
    // Im Dev-Modus bestimmt die Rolle aus devUser.json den Admin-Status.
    const istInitialAdmin = initialAdmins.includes(auth.loginSub.toLowerCase()) || devRole === 'ADMIN'

    let user = findUserByLoginSub(db, auth.loginSub)

    if (!user) {
        const autoProvision = config.autoProvision !== 'false'
        if (!autoProvision && !istInitialAdmin) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Konto noch nicht freigeschaltet. Bitte an die Administration wenden.',
            })
        }
        user = createUser(db, auth.loginSub, istInitialAdmin ? 'ADMIN' : 'REPORTER', auth.name ?? '')
    } else {
        if (auth.name && auth.name !== user.name) {
            updateUserName(db, user.id, auth.name)
            user.name = auth.name
        }
        if (istInitialAdmin && user.role !== 'ADMIN') {
            updateUserRole(db, user.id, 'ADMIN')
            user.role = 'ADMIN'
        }
    }

    await setUserSession(
        event,
        {
            user: {
                id: user.id,
                loginSub: user.loginSub,
                name: user.name || auth.name || user.loginSub,
                role: user.role,
            },
        },
        {maxAge: 60 * 60 * 8},
    )

    console.info(`[INFO] /api/login – Nutzer ${user.loginSub} (Rolle ${user.role}) angemeldet`)
    return {ok: true}
})
