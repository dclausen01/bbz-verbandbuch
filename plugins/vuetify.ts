// import this after install `@mdi/font` package
import '@mdi/font/css/materialdesignicons.css'

import 'vuetify/styles'
import {createVuetify} from 'vuetify'
import {aliases, mdi} from 'vuetify/iconsets/mdi'
import {createRulesPlugin} from 'vuetify/labs/rules'
import {PasswordSchema} from "#shared/schemas/password.schema";

export default defineNuxtPlugin((app) => {
    const vuetify = createVuetify({
        icons: {
            defaultSet: 'mdi',
            aliases,
            sets: {
                mdi,
            },
        },
        ssr: true
    })

    app.vueApp.use(createRulesPlugin({
        aliases: {
            required: (err = 'Dieses Feld ist erforderlich') => v => !!v || err,
            email: (err = 'Bitte geben Sie eine valide E-Mail an.') => v => new RegExp('^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$').test(v) || err,
            password: (err?: string) => {
                return (value: any): string | boolean => {
                    const result = PasswordSchema.safeParse(value)
                    if (result.success) return true;
                    return result.error.issues[0]!.message
                }
            },
        }
    }, vuetify.locale))

    app.vueApp.use(vuetify)
})
