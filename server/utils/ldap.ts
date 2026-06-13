import {readFileSync} from 'node:fs'
import type {ConnectionOptions} from 'node:tls'
import {Client, InvalidCredentialsError} from 'ldapts'

/**
 * LDAP-Authentifizierung gegen ein Active Directory.
 *
 * Übernommen aus dem Notentabellen-Projekt (dclausen01/notentabellen-spa) und
 * für den Nitro-Server angepasst. Zwei Betriebsarten:
 *  - Service-Modus: mit Service-Account binden, Nutzer per Filter suchen, dann
 *    mit gefundener DN + eingegebenem Passwort erneut binden.
 *  - Direkt-Modus (LDAP_BIND_USER_TEMPLATE gesetzt): Nutzer bindet sofort mit
 *    eigener Kennung – kein Service-Account nötig.
 *
 * Rollen kommen NICHT aus dem AD, sondern aus der lokalen Datenbank (Tabelle
 * `users`).
 */

export interface AuthErgebnis {
    /** Stabile, eindeutige Kennung aus dem Verzeichnis (z. B. sAMAccountName). */
    loginSub: string
    /** Anzeigename, falls vom Verzeichnis geliefert. */
    name?: string
}

export interface LdapConfig {
    url: string
    bindDn: string
    bindPasswort: string
    baseDn: string
    userFilter: string
    loginAttr: string
    nameAttr: string
    tlsOptions?: ConnectionOptions
    userBindTemplate?: string
}

/** Liest die LDAP-Konfiguration aus Umgebungsvariablen (niemals aus dem Repo!). */
export function ldapConfigAusEnv(env: NodeJS.ProcessEnv = process.env): LdapConfig {
    const pflicht = (k: string): string => {
        const v = env[k]
        if (!v) throw new Error(`Umgebungsvariable ${k} fehlt (LDAP-Konfiguration)`)
        return v
    }

    const tlsOptions: ConnectionOptions = {}
    const caPfad = env['LDAP_TLS_CA_PFAD']
    if (caPfad) tlsOptions.ca = readFileSync(caPfad)
    if (env['LDAP_TLS_REJECT_UNAUTHORIZED'] === 'false') tlsOptions.rejectUnauthorized = false

    const userBindTemplate = env['LDAP_BIND_USER_TEMPLATE']
    const direkt = Boolean(userBindTemplate)

    return {
        url: pflicht('LDAP_URL'),
        bindDn: direkt ? (env['LDAP_BIND_DN'] ?? '') : pflicht('LDAP_BIND_DN'),
        bindPasswort: direkt ? (env['LDAP_BIND_PW'] ?? '') : pflicht('LDAP_BIND_PW'),
        baseDn: pflicht('LDAP_BASE_DN'),
        userFilter: env['LDAP_USER_FILTER'] ?? '(sAMAccountName={{username}})',
        loginAttr: env['LDAP_LOGIN_ATTR'] ?? 'sAMAccountName',
        nameAttr: env['LDAP_NAME_ATTR'] ?? 'displayName',
        ...(Object.keys(tlsOptions).length ? {tlsOptions} : {}),
        ...(userBindTemplate ? {userBindTemplate} : {}),
    }
}

function escapeFilter(wert: string): string {
    return wert.replace(/[\\*() ]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'))
}

function alsString(v: unknown): string | undefined {
    if (Array.isArray(v)) return v.length ? String(v[0]) : undefined
    if (Buffer.isBuffer(v)) return v.toString('utf8')
    return v === undefined ? undefined : String(v)
}

export class LdapAuthenticator {
    constructor(private readonly cfg: LdapConfig) {}

    private clientOptions() {
        return {
            url: this.cfg.url,
            ...(this.cfg.tlsOptions ? {tlsOptions: this.cfg.tlsOptions} : {}),
        }
    }

    async authenticate(benutzername: string, passwort: string): Promise<AuthErgebnis | null> {
        if (!benutzername || !passwort) return null
        if (this.cfg.userBindTemplate) {
            return this.authenticateDirekt(benutzername, passwort)
        }

        const clientOpts = this.clientOptions()
        const suchClient = new Client(clientOpts)
        let benutzerDn: string
        let loginSub: string | undefined
        let name: string | undefined
        try {
            try {
                await suchClient.bind(this.cfg.bindDn, this.cfg.bindPasswort)
            } catch (e) {
                throw new Error(
                    `Service-Account-Bind fehlgeschlagen — bitte LDAP_BIND_DN und LDAP_BIND_PW prüfen (Lese-Nutzer): ${(e as Error).message}`,
                    {cause: e},
                )
            }
            const filter = this.cfg.userFilter.replace('{{username}}', escapeFilter(benutzername))
            const {searchEntries} = await suchClient.search(this.cfg.baseDn, {
                scope: 'sub',
                filter,
                attributes: ['dn', this.cfg.loginAttr, this.cfg.nameAttr],
            })
            if (searchEntries.length !== 1) return null
            const eintrag = searchEntries[0]!
            benutzerDn = String(eintrag.dn)
            loginSub = alsString(eintrag[this.cfg.loginAttr]) ?? benutzername
            name = alsString(eintrag[this.cfg.nameAttr])
        } finally {
            await suchClient.unbind().catch(() => undefined)
        }

        const verifyClient = new Client(clientOpts)
        try {
            await verifyClient.bind(benutzerDn, passwort)
        } catch (e) {
            if (e instanceof InvalidCredentialsError) return null
            throw e
        } finally {
            await verifyClient.unbind().catch(() => undefined)
        }

        return name !== undefined ? {loginSub, name} : {loginSub}
    }

    private async authenticateDirekt(
        benutzername: string,
        passwort: string,
    ): Promise<AuthErgebnis | null> {
        const bindName = this.cfg.userBindTemplate!.replace('{{username}}', benutzername)
        const client = new Client(this.clientOptions())
        try {
            try {
                await client.bind(bindName, passwort)
            } catch (e) {
                if (e instanceof InvalidCredentialsError) return null
                throw e
            }

            let loginSub = benutzername
            let name: string | undefined
            try {
                const filter = this.cfg.userFilter.replace('{{username}}', escapeFilter(benutzername))
                const {searchEntries} = await client.search(this.cfg.baseDn, {
                    scope: 'sub',
                    filter,
                    attributes: ['dn', this.cfg.loginAttr, this.cfg.nameAttr],
                })
                if (searchEntries.length === 1) {
                    const eintrag = searchEntries[0]!
                    loginSub = alsString(eintrag[this.cfg.loginAttr]) ?? benutzername
                    name = alsString(eintrag[this.cfg.nameAttr])
                }
            } catch {
                /* Attributsuche optional — Anmeldung gilt bereits als erfolgreich */
            }
            return name !== undefined ? {loginSub, name} : {loginSub}
        } finally {
            await client.unbind().catch(() => undefined)
        }
    }
}
