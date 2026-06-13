<template>
  <div class="d-flex justify-center align-center" style="height: 100vh;">
    <v-card
        :width="$vuetify.display.mdAndDown ? '80%' : '50%'"
        :height="$vuetify.display.mdAndDown ? '85%' : '75%'"
        elevation="2" class="pa-6">
      <v-card-title class="text-h6 text-md-h4 text-lg-h2">Verbandsbuch</v-card-title>
      <v-col class="d-flex flex-column align-center">
        <v-img src="/bbz-logo.png" width="50%"/>
        <v-divider class="border-opacity-25 mt-6 mb-6" width="90%"/>
        <div v-if="error.statusCode == 404"
             class="text-body-1 text-lg-body-2 text-center">
          <h2 class="mb-2"
              style="font-weight: bold;">
            Seite nicht gefunden
          </h2>
          <div class="mb-4">
            Die angeforderte Seite existiert nicht oder wurde verschoben.<br>
            Bitte überprüfe die Adresse oder kehre zur Startseite zurück.
          </div>
        </div>
        <div v-else class="text-body-1 text-lg-body-2 text-center">
          <h2
              class="mb-2"
              style="font-weight: bold;">
            Ein unerwarteter Fehler ist aufgetreten
          </h2>
          <div class="mb-4">
            Entschuldigung, etwas ist schiefgelaufen.<br>
            Bitte versuche es später erneut oder kontaktiere den Support, falls das Problem weiterhin besteht.
          </div>
        </div>
        <v-btn to="/">Zurück zur Startseite</v-btn>
      </v-col>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type {NuxtError} from '#app'

const props = defineProps<{ error: NuxtError }>()
</script>

