<template>
  <div class="druck">
    <div class="no-print actions">
      <v-btn size="small" variant="text" to="/">Zurück</v-btn>
      <div class="d-flex ga-2">
        <v-btn
            v-if="report?.reportable && bgmEmail"
            size="small"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-email-alert"
            :href="mailtoLink"
        >
          Meldung an BGM
        </v-btn>
        <v-btn size="small" color="primary" prepend-icon="mdi-printer" @click="print">Drucken / als PDF speichern</v-btn>
      </div>
    </div>

    <div v-if="report" class="sheet">
      <header class="head">
        <img src="/bbz-logo.png" alt="BBZ" class="logo"/>
        <div>
          <h1>Verbandbuch – Eintrag</h1>
          <div class="muted">Dokumentation einer Erste-Hilfe-Leistung (DGUV Vorschrift 1 § 24)</div>
        </div>
      </header>

      <div v-if="report.reportable" class="badge">Meldepflichtiger Unfall – Unfallanzeige prüfen</div>

      <table class="kv">
        <tbody>
          <tr><th>Verletzte Person</th><td>{{ report.injuredPerson }}<span v-if="report.injuredGroup"> ({{ report.injuredGroup }})</span></td></tr>
          <tr><th>Datum / Uhrzeit des Unfalls</th><td>{{ fmt(report.occurredAt) }}</td></tr>
          <tr><th>Ort des Unfalls</th><td>{{ report.accidentLocation }}</td></tr>
          <tr><th>Hergang</th><td>{{ report.description }}</td></tr>
          <tr><th>Art und Umfang der Verletzung</th><td>{{ report.incident }}</td></tr>
          <tr><th>Erste-Hilfe-Maßnahme</th><td>{{ report.measures || '—' }}</td></tr>
          <tr><th>Ersthelfer:in</th><td>{{ report.firstAider }}</td></tr>
          <tr><th>Zeug:innen</th><td>{{ report.witness || '—' }}</td></tr>
          <tr><th>Entnommenes Material</th><td>
            <span v-if="!report.materialList.length">—</span>
            <span v-else>{{ report.materialList.map(m => `${m.type}: ${m.quantity}`).join(', ') }}</span>
          </td></tr>
          <tr><th>Verbandkasten</th><td>{{ report.kit.location }} ({{ report.kit.code }})</td></tr>
          <tr><th>Eingetragen</th><td>{{ report.createdAt ? fmt(report.createdAt) : '—' }} von {{ report.createdBy?.name }}</td></tr>
        </tbody>
      </table>

      <footer class="foot">
        <div>Verbandsbuch BBZ – vertraulich (enthält Gesundheitsdaten, Art. 9 DSGVO)</div>
        <div>Eintrag-ID: {{ report.id }}</div>
      </footer>
    </div>

    <div v-else class="no-print pa-4">Eintrag wird geladen …</div>
  </div>
</template>
<script setup lang="ts">
import {formatDatetimeGerman} from '#shared/utils/toGermanTimeConverter.util'
import type {AccidentReport} from '#shared/schemas/accident-report.schema'

definePageMeta({middleware: ['authenticated'], layout: false})

const route = useRoute()
const accidentReportStore = useAccidentReportStore()
const report = ref<AccidentReport | null>(null)
const bgmEmail = useRuntimeConfig().public.bgmEmail as string

function fmt(d: Date) {
  return formatDatetimeGerman(new Date(d).toISOString())
}

const mailtoLink = computed(() => {
  const r = report.value
  if (!r) return '#'
  const subject = `Meldepflichtiger Unfall – ${r.injuredPerson} (${fmt(r.occurredAt)})`
  const body = [
    'Im Verbandbuch wurde ein meldepflichtiger Unfall erfasst:',
    '',
    `Verletzte Person: ${r.injuredPerson}${r.injuredGroup ? ` (${r.injuredGroup})` : ''}`,
    `Zeitpunkt: ${fmt(r.occurredAt)}`,
    `Ort: ${r.accidentLocation}`,
    `Verletzung: ${r.incident}`,
    `Hergang: ${r.description}`,
    `Erste-Hilfe-Maßnahme: ${r.measures || '—'}`,
    `Ersthelfer:in: ${r.firstAider}`,
    '',
    'Bitte prüfen, ob eine Unfallanzeige an den Unfallversicherungsträger erforderlich ist.',
  ].join('\n')
  return `mailto:${bgmEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

function print() {
  window.print()
}

onMounted(async () => {
  report.value = await accidentReportStore.getAccidentReportById(route.params.id as string)
  // kurz warten, damit Logo/Layout stehen, dann Druckdialog öffnen
  await nextTick()
  setTimeout(() => window.print(), 400)
})
</script>
<style scoped>
.druck {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  color: #111;
  background: #fff;
  font-family: system-ui, sans-serif;
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
.head {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 2px solid #333;
  padding-bottom: 12px;
}
.logo {
  height: 48px;
}
h1 {
  font-size: 20px;
  margin: 0;
}
.muted {
  color: #555;
  font-size: 12px;
}
.badge {
  margin: 12px 0;
  padding: 8px 12px;
  border: 1px solid #b26a00;
  background: #fff3e0;
  color: #8a4b00;
  border-radius: 4px;
  font-weight: 600;
}
.kv {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}
.kv th, .kv td {
  border: 1px solid #ccc;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  font-size: 13px;
}
.kv th {
  width: 38%;
  background: #f5f5f5;
  font-weight: 600;
}
.foot {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  font-size: 11px;
  color: #666;
}
@media print {
  .no-print { display: none !important; }
  .druck { padding: 0; }
}
</style>
