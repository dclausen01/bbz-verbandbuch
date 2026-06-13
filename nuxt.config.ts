import vuetify, {transformAssetUrls} from 'vite-plugin-vuetify'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    runtimeConfig: {
        // Pfad zur SQLite-Datei (server-only). Default: ./data/verbandbuch.db
        dbPath: '',
        // Aufbewahrungsfrist der Einträge in Jahren (DGUV: mind. 5).
        retentionYears: '5',
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
            // E-Mail der/des BGM-Beauftragten für die "Meldung vorbereiten"-Funktion
            // (mailto-Link, funktioniert ohne Server-Mailversand).
            bgmEmail: '',
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
        // Native bzw. dynamisch ladende Module nicht ins Bundle inlinen –
        // Nitro kopiert sie als externe Abhängigkeiten mit.
        externals: {
            external: ['better-sqlite3-multiple-ciphers', 'nodemailer'],
        },
    },

    modules: ['nuxt-auth-utils', '@pinia/nuxt'],
})
