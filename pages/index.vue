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
        <div class="d-flex pa-2">
          <v-btn
              icon="mdi-pencil"
              size="small"
              @click="updateAccidentReport(item)"
          />
          <v-btn
              v-if="user?.role === UserRoleEnum.ADMIN"
              icon="mdi-delete"
              color="error"
              class="ml-2"
              size="small"
              @click="openConfirmDialog = true; accidentReportToDelete = item"
          />
        </div>
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
                <p><strong>Datum und Uhrzeit:</strong> {{ formatDatetimeGerman(item.occurredAt.toISOString()) }}</p>
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
      text="Sind Sie sicher, dass Sie den Verbandsbucheintrag löschen wollen?"
      confirm-text="Löschen"
      @confirm="deleteAccidentReport"
      @cancel="accidentReportToDelete = null"
  />
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
    key: "incident",
    title: "Unfallart"
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