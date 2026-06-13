<template>
  <v-container
      :width="$vuetify.display.mdAndDown ? '80%' : '50%'"
      class="d-flex align-center flex-column pa-6"
  >
    <v-img src="/bbz-logo.png" width="50%"/>
    <p class="text-lg-h3 text-md-h4 text-h5 pt-6 pb-2 text-center">Willkommen auf dem Verbandsbuch des BBZ</p>
    <div class="pb-3">
      <p v-if="!errorMessage" class="text-body-1 text-center">
        Bitte melden Sie sich mit Ihrem Schul-Benutzerkonto an, um fortzufahren.<br>
      </p>
      <v-alert v-else class="mt-5" color="error" variant="flat">
        {{ errorMessage }}
      </v-alert>
    </div>
    <v-form
        v-model="form"
        @submit.prevent="login"
        style="width: 100%"
    >
      <v-col>
        <v-row>
          <v-text-field
              v-model="credentials.username"
              label="Benutzername"
              :rules="[rules.required()]"
              autocomplete="username"
          ></v-text-field>
        </v-row>
        <v-row>
          <v-text-field
              v-model="credentials.password"
              label="Passwort"
              :rules="[rules.required()]"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              autocomplete="current-password"
          ></v-text-field>
        </v-row>
        <v-row>
          <v-btn type="Submit" class="ml-auto" :loading="loading">Anmelden</v-btn>
        </v-row>
      </v-col>
    </v-form>
  </v-container>
</template>
<script setup lang="ts">
import {useRules} from 'vuetify/labs/rules'
import {FetchError} from "ofetch";

definePageMeta({
  layout: false,
})

const {fetch: refreshSession} = useUserSession()
const form = ref(false)
const showPassword = ref<boolean>(false);
const loading = ref<boolean>(false);
const rules = useRules()
const errorMessage = ref<string>('')
const credentials = reactive({
  username: '',
  password: '',
})

async function login() {
  if (!form.value) return
  errorMessage.value = ''
  loading.value = true
  try {
    await $fetch('/api/login', {
      method: 'POST',
      body: credentials,
    })

    await refreshSession()
    await navigateTo('/')
  } catch (error) {
    if (error instanceof FetchError) {
      if (error.status === 401) {
        errorMessage.value = 'Ungültiger Benutzername oder Passwort'
        return
      }
      if (error.status === 403) {
        errorMessage.value = error.data?.message || 'Konto noch nicht freigeschaltet.'
        return
      }
      errorMessage.value = 'Anmeldung derzeit nicht möglich. Bitte später erneut versuchen.'
      return
    }

    if (error instanceof Error) {
      throw createError(error)
    }

    console.error("[ERROR] /api/login ", error);
  } finally {
    loading.value = false
  }
}
</script>
