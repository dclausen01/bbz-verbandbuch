// Zentraler $fetch-Wrapper für die interne API (Nitro-Server, gleiche Origin).
// Authentifizierung läuft über das Session-Cookie von nuxt-auth-utils – beim
// Server-Side-Rendering muss das eingehende Cookie an die /api-Aufrufe
// weitergereicht werden, im Browser geschieht das automatisch.
export default defineNuxtPlugin(() => {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

    const msFetch = $fetch.create({
        baseURL: '/api',
        headers,
        onResponseError({request, response}) {
            console.error(`[ERROR] API ${request} – Status ${response.status}`)
        },
    })

    return {
        provide: {
            msFetch,
        },
    }
})
