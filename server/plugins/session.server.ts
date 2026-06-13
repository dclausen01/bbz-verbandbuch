/**
 * Platz für serverseitige Session-Hooks von nuxt-auth-utils (z. B. um die
 * Session bei jedem Abruf mit frischen Daten anzureichern). Aktuell genügt die
 * im Cookie gespeicherte Identität – daher ein No-op.
 */
export default defineNitroPlugin(() => {
    sessionHooks.hook('fetch', async (_session, _event) => {
        // Bei Bedarf hier Session-Daten erneuern.
    })
})
