import vuetify, {transformAssetUrls} from 'vite-plugin-vuetify'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    runtimeConfig: {
        // Pfad zur SQLite-Datei (server-only). Default: ./data/verbandbuch.db
        dbPath: '',
        // Login-Kennungen (kommagetrennt), die beim ersten Login automatisch
        // ADMIN-Rechte erhalten – zum Bootstrappen ohne Vor-Provisionierung.
        // Per NUXT_INITIAL_ADMINS überschreibbar.
        initialAdmins: 'ClauD',
        // Dürfen sich unbekannte LDAP-Nutzer automatisch als REPORTER anlegen?
        autoProvision: 'true',
        public: {
            // Entwicklungsmodus: Login ohne LDAP über devUser.json
            isDev: false,
            devUserIndex: 0,
        },
    },

    build: {
        transpile: ['vuetify', '@pinia/nuxt'],
    },

    vite: {
        plugins: [
            vuetify({autoImport: true}),
        ],
        vue: {
            template: {
                transformAssetUrls,
            },
        },
    },

    nitro: {
        // better-sqlite3 ist ein natives Modul und darf nicht in das Bundle
        // inlined werden – Nitro kopiert es als externe Abhängigkeit mit.
        externals: {
            external: ['better-sqlite3'],
        },
    },

    modules: ['nuxt-auth-utils', '@pinia/nuxt'],
})
