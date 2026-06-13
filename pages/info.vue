<template>
  <v-container style="max-width: 900px;">
    <h2 class="text-h6 mb-4">Info &amp; Hilfe</h2>

    <v-card border rounded="lg" class="mb-4">
      <v-card-title class="text-subtitle-1">Was ist das Verbandsbuch?</v-card-title>
      <v-card-text>
        Im Verbandsbuch werden alle Erste-Hilfe-Leistungen an der Schule dokumentiert –
        gesetzlich vorgeschrieben (DGUV). Jeder Vorfall wird mit Datum, Hergang, Verletzung,
        Maßnahme, Ersthelfer:in und entnommenem Material festgehalten.
      </v-card-text>
    </v-card>

    <v-card border rounded="lg" class="mb-4">
      <v-card-title class="text-subtitle-1">So legen Sie einen Eintrag an</v-card-title>
      <v-card-text>
        <v-list density="compact">
          <v-list-item prepend-icon="mdi-numeric-1-circle">
            Über <strong>„Neuer Eintrag“</strong> (Seitenleiste) oder den QR-Code am Verbandkasten.
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-2-circle">
            Pflichtfelder (mit *) ausfüllen und entnommenes Material auswählen.
          </v-list-item>
          <v-list-item prepend-icon="mdi-numeric-3-circle">
            Speichern – der Eintrag erscheint im <strong>Verbandbuch</strong>.
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <v-card border rounded="lg" class="mb-4">
      <v-card-title class="text-subtitle-1">Rollen</v-card-title>
      <v-card-text>
        <p class="mb-2"><strong>Berichterstatter:in:</strong> legt Einträge an und sieht die eigenen Einträge.</p>
        <p><strong>Administrator:in:</strong> sieht alle Einträge und verwaltet Verbandkästen,
          Bestände und Benutzer.</p>
      </v-card-text>
    </v-card>

    <v-card border rounded="lg">
      <v-card-title class="text-subtitle-1">Anmeldung</v-card-title>
      <v-card-text>
        Die Anmeldung erfolgt mit dem gewohnten Schul-Benutzerkonto (LDAP / Active Directory).
        Bei Problemen mit dem Zugang wenden Sie sich bitte an die Administration.
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script setup lang="ts">
definePageMeta({middleware: ['authenticated']})
</script>
