<template>
  <div v-if="!loading && accidentReportStore.accidentReports.length === 0" class="d-flex align-center flex-column">
    <p class="text-body-1 text-sm-body-2 text-center pb-2">
      Es wurden bisher keine Verbandsbucheinträge erstellt. Bitte legen Sie einen neuen Eintrag an.
    </p>
    <v-btn to="/formular/new" color="primary">Verbandsbucheintrag erstellen</v-btn>
  </div>
  <div v-else>
    <v-row align="center">
      <v-col cols="12" class="d-flex justify-end">
        <v-btn
            @click="createAccidentReport"
            color="primary"
            class="mb-4"
        >Neuen Eintrag erstellen
        </v-btn>
      </v-col>
      <!--      <v-col cols="12" md="6">-->
      <!--        <v-text-field-->
      <!--            class="flex-1-0"-->
      <!--            label="Suche"-->
      <!--        >-->
      <!--        </v-text-field>-->
      <!--      </v-col>-->
    </v-row>
    <v-divider class="mb-4"/>
    <v-data-table
        :loading="loading"
        :items="accidentReportStore.accidentReports"
        :headers="headers"
        show-expand
    >
      <template v-slot:item.actions="{ item }">
        <div class="d-flex pa-2 ga-1">
          <v-btn
              icon="mdi-pencil"
              size="small"
              variant="text"
              title="Bearbeiten"
              @click="updateAccidentReport(item)"
          />
          <v-btn
              icon="mdi-printer"
              size="small"
              variant="text"
              title="Drucken / PDF"
              :to="`/druck/${item.id}`"
              target="_blank"
          />
          <v-btn
              icon="mdi-history"
              size="small"
              variant="text"
              title="Änderungsverlauf"
              @click="showRevisions(item)"
          />
          <v-btn
              v-if="user?.role === UserRoleEnum.ADMIN"
              icon="mdi-delete"
              color="error"
              variant="text"
              size="small"
              title="Löschen"
              @click="openConfirmDialog = true; accidentReportToDelete = item"
          />
        </div>
      </template>
      <template v-slot:item.injuredPerson="{ item }">
        {{ item.injuredPerson }}
        <v-chip v-if="item.reportable" size="x-small" color="warning" variant="tonal" class="ml-1">
          meldepflichtig
        </v-chip>
      </template>
      <template v-slot:loading>
        <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
      </template>
      <template v-slot:item.occurredAt="{item}">
        {{ formatDatetimeGerman(item.occurredAt.toISOString()) }}
      </template>
      <template v-slot:expanded-row="{columns, item}">
        <tr>
          <td :colspan="columns.length" class="pa-4">
            <v-row dense>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Verletzte Person:</strong> {{ item.injuredPerson }}
                  <span v-if="item.injuredGroup">({{ item.injuredGroup }})</span></p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Datum und Uhrzeit:</strong> {{ formatDatetimeGerman(item.occurredAt.toISOString()) }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Ort des Unfalls:</strong> {{ item.accidentLocation }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Hergang:</strong> {{ item.description }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Art und Umfang der Verletzungen:</strong>
                  {{ item.incident }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Art und Weise der Erste-Hilfe-Maßnahme:</strong> {{ item.measures }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Name des Ersthelfers / Ersthelferin:</strong> {{ item.firstAider }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Zeuge:</strong> {{ item.witness }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Verbandskasten:</strong> {{ item.kit.location }}</p>
              </v-col>
              <v-col cols="12" md="6" lg="4">
                <p><strong>Eingetragen:</strong>
                  {{ item.createdAt ? formatDatetimeGerman(item.createdAt.toISOString()) : '—' }}
                  von {{ item.createdBy?.name }}</p>
              </v-col>
              <v-col cols="12">
                <v-col cols="12" lg="6" v-for="material in item.materialList" :key="material.type">
                  <p><strong>- {{ material.type }}: </strong>Anzahl - {{ material.quantity }}</p>
                </v-col>
              </v-col>
            </v-row>
          </td>
        </tr>
      </template>
    </v-data-table>
  </div>

  <app-dialog
      title="Eintrag löschen"
      v-model="openConfirmDialog"
      text="Sind Sie sicher, dass Sie den Verbandsbucheintrag löschen wollen? Die Löschung wird revisionssicher protokolliert."
      confirm-text="Löschen"
      @confirm="deleteAccidentReport"
      @cancel="accidentReportToDelete = null"
  />

  <v-dialog v-model="openRevisions" max-width="640">
    <v-card>
      <v-card-title class="d-flex align-center">
        Änderungsverlauf
        <v-spacer/>
        <v-chip v-if="revisions.length && revisions.every(r => r.valid)" size="small" color="success" variant="tonal">
          Hash-Kette unverändert
        </v-chip>
        <v-chip v-else-if="revisions.length" size="small" color="error" variant="tonal">
          Manipulation erkannt!
        </v-chip>
      </v-card-title>
      <v-card-text>
        <v-timeline v-if="revisions.length" side="end" density="compact">
          <v-timeline-item
              v-for="r in revisions"
              :key="r.seq"
              :dot-color="r.action === 'DELETE' ? 'error' : r.action === 'CREATE' ? 'success' : 'primary'"
              size="x-small"
          >
            <div class="text-body-2">
              <strong>{{ actionLabel(r.action) }}</strong> – {{ formatDatetimeGerman(new Date(r.changedAt).toISOString()) }}
            </div>
            <div class="text-caption text-medium-emphasis">durch {{ r.changedBy || '—' }}</div>
          </v-timeline-item>
        </v-timeline>
        <div v-else class="text-body-2">Kein Verlauf vorhanden.</div>
      </v-card-text>
      <v-card-actions>
        <v-spacer/>
        <v-btn @click="openRevisions = false">Schließen</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import {useAccidentReportStore} from "~/stores/accident-report.store";
import {useDisplay} from 'vuetify'
import {formatDatetimeGerman} from "#shared/utils/toGermanTimeConverter.util";
import {UserRoleEnum} from "#shared/enums/user-role.enum";
import type {AccidentReport} from "#shared/schemas/accident-report.schema";
import AppDialog from "~/components/app-dialog.vue";

definePageMeta({
  middleware: ['authenticated'],
})
const accidentReportStore = useAccidentReportStore()
const loading = ref<boolean>(true)
const {user} = useUserSession();
const headersSmallScreen = [
  {
    key: "injuredPerson",
    title: "Verletzte Person"
  },
  {
    key: "occurredAt",
    title: "Unfalldatum"
  },
  {
    key: "actions",
    sortable: false
  }
]
const headersLargeScreen = [
  {
    key: "injuredPerson",
    title: "Verletzte Person"
  },
  {
    key: 'createdBy.name',
    title: "Ersteller"
  },
  {
    key: "incident",
    title: "Unfallart"
  },
  {
    key: "occurredAt",
    title: "Unfalldatum"
  },
  {
    key: "kit.location",
    title: "Verbandskasten"
  },
  {
    key: "actions",
    sortable: false
  }
]

const {smAndDown} = useDisplay()
const headers = computed(() => smAndDown.value ? headersSmallScreen : headersLargeScreen)
const openConfirmDialog = ref<boolean>(false);
const accidentReportToDelete = ref<AccidentReport | null>(null)
const openRevisions = ref<boolean>(false)
const revisions = ref<Array<{seq: number; action: string; changedAt: string; changedBy: string; valid: boolean}>>([])

function actionLabel(action: string) {
  return action === 'CREATE' ? 'Angelegt' : action === 'UPDATE' ? 'Geändert' : 'Gelöscht'
}

async function showRevisions(item: AccidentReport) {
  revisions.value = []
  openRevisions.value = true
  revisions.value = await accidentReportStore.getRevisions(item.id)
}

onMounted(async () => {
  loading.value = true
  await accidentReportStore.getAllAccidentReportsForUser()
  loading.value = false
})

function updateAccidentReport(accidentReport: AccidentReport) {
  navigateTo(`/formular/${accidentReport.id}`)
}

async function deleteAccidentReport() {
  await accidentReportStore.deleteAccidentReport(accidentReportToDelete.value!.id)
  await accidentReportStore.getAllAccidentReportsForUser();
}

function createAccidentReport() {
  navigateTo('/formular/new')
}
</script>