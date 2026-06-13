<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6">Verbandkästen</h2>
      <v-spacer/>
      <v-btn
          v-if="isAdmin"
          color="primary"
          prepend-icon="mdi-plus"
          @click="openCreateDialog = true"
      >
        Kasten anlegen
      </v-btn>
    </div>

    <v-alert
        v-if="!loading && firstAidKitStore.firstAidKits.length === 0"
        type="info"
        variant="tonal"
    >
      Es sind noch keine Verbandkästen angelegt.
      <template v-if="isAdmin"> Legen Sie über „Kasten anlegen“ den ersten Kasten an.</template>
    </v-alert>

    <v-row>
      <v-col
          v-for="kit in firstAidKitStore.firstAidKits"
          :key="kit.id"
          cols="12" sm="6" md="4"
      >
        <v-card border rounded="lg" class="h-100">
          <v-card-item>
            <v-card-title>{{ kit.location }}</v-card-title>
            <v-card-subtitle>{{ kit.code }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-center">
            <v-img
                v-if="qrCodes[kit.id]"
                :src="qrCodes[kit.id]"
                width="160"
                class="mx-auto"
                alt="QR-Code"
            />
            <div class="text-caption text-medium-emphasis mt-1">
              Scannen führt direkt zum neuen Eintrag
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
                variant="text"
                prepend-icon="mdi-plus-circle"
                :to="`/formular/new?kit=${encodeURIComponent(kit.code)}`"
            >
              Eintrag
            </v-btn>
            <v-spacer/>
            <v-btn
                icon="mdi-printer"
                variant="text"
                size="small"
                title="QR-Code drucken"
                @click="printQr(kit)"
            />
            <v-btn
                v-if="isAdmin"
                icon="mdi-pencil"
                variant="text"
                size="small"
                title="Bearbeiten / Umbenennen"
                @click="openEdit(kit)"
            />
            <v-btn
                v-if="isAdmin"
                icon="mdi-delete"
                variant="text"
                color="error"
                size="small"
                @click="kitToDelete = kit; openDeleteDialog = true"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Anlegen-Dialog -->
    <v-dialog v-model="openCreateDialog" max-width="480">
      <v-card>
        <v-card-title>Verbandkasten anlegen</v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValid" @submit.prevent="createKit">
            <v-text-field
                v-model="newKit.code"
                label="Code (QR) *"
                hint="z.B. KASTEN-001 – steckt im QR-Code"
                persistent-hint
                :rules="[rules.required()]"
            />
            <v-text-field
                v-model="newKit.location"
                label="Standort *"
                hint="z.B. Raum 1.12"
                persistent-hint
                :rules="[rules.required()]"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="openCreateDialog = false">Abbrechen</v-btn>
          <v-btn color="primary" variant="tonal" @click="createKit">Anlegen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bearbeiten-Dialog -->
    <v-dialog v-model="openEditDialog" max-width="480">
      <v-card>
        <v-card-title>Verbandkasten bearbeiten</v-card-title>
        <v-card-text>
          <v-form ref="editFormRef" v-model="editFormValid" @submit.prevent="saveEdit">
            <v-text-field
                v-model="editKit.code"
                label="Code (QR) *"
                hint="z.B. KASTEN-001 – steckt im QR-Code"
                persistent-hint
                :rules="[rules.required()]"
            />
            <v-text-field
                v-model="editKit.location"
                label="Standort *"
                hint="z.B. Raum 1.12"
                persistent-hint
                :rules="[rules.required()]"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="openEditDialog = false">Abbrechen</v-btn>
          <v-btn color="primary" variant="tonal" @click="saveEdit">Speichern</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <app-dialog
        v-model="openDeleteDialog"
        title="Verbandkasten löschen"
        :text="`Kasten „${kitToDelete?.location}“ wirklich löschen?`"
        confirm-text="Löschen"
        @confirm="deleteKit"
    />
  </div>
</template>
<script setup lang="ts">
import QRCode from 'qrcode'
import {useRules} from 'vuetify/labs/rules'
import type {FirstAidKit} from '#shared/schemas/first-aid-kit.schema'
import AppDialog from '~/components/app-dialog.vue'

definePageMeta({middleware: ['authenticated']})

const firstAidKitStore = useFirstAidKitStore()
const {user} = useUserSession()
const rules = useRules()

const isAdmin = computed(() => user.value?.role === 'ADMIN')
const loading = ref(true)
const qrCodes = reactive<Record<string, string>>({})

const openCreateDialog = ref(false)
const openEditDialog = ref(false)
const openDeleteDialog = ref(false)
const formRef = ref<any>(null)
const formValid = ref(false)
const editFormRef = ref<any>(null)
const editFormValid = ref(false)
const newKit = reactive({code: '', location: ''})
const editKit = reactive({id: '', code: '', location: ''})
const kitToDelete = ref<FirstAidKit | null>(null)

async function renderQrCodes() {
  const origin = window.location.origin
  for (const kit of firstAidKitStore.firstAidKits) {
    const target = `${origin}/formular/new?kit=${encodeURIComponent(kit.code)}`
    qrCodes[kit.id] = await QRCode.toDataURL(target, {width: 320, margin: 1})
  }
}

onMounted(async () => {
  loading.value = true
  await firstAidKitStore.getAllFirstAidKits()
  await renderQrCodes()
  loading.value = false
})

async function createKit() {
  const ok = await formRef.value?.validate?.()
  if (!ok?.valid) return
  await firstAidKitStore.createFirstAidKit(newKit.code.trim(), newKit.location.trim())
  openCreateDialog.value = false
  newKit.code = ''
  newKit.location = ''
  await renderQrCodes()
}

function openEdit(kit: FirstAidKit) {
  editKit.id = kit.id
  editKit.code = kit.code
  editKit.location = kit.location
  openEditDialog.value = true
}

async function saveEdit() {
  const ok = await editFormRef.value?.validate?.()
  if (!ok?.valid) return
  await firstAidKitStore.updateFirstAidKit(editKit.id, editKit.code.trim(), editKit.location.trim())
  openEditDialog.value = false
  // QR-Codes neu rendern, da sich der Code (QR-Inhalt) geändert haben kann
  await renderQrCodes()
}

async function deleteKit() {
  if (!kitToDelete.value) return
  await firstAidKitStore.deleteFirstAidKit(kitToDelete.value.id)
  kitToDelete.value = null
}

function printQr(kit: FirstAidKit) {
  const img = qrCodes[kit.id]
  if (!img) return
  const w = window.open('', '_blank', 'width=400,height=500')
  if (!w) return
  w.document.write(`
    <html lang="de"><head><title>${kit.code}</title></head>
    <body style="text-align:center;font-family:sans-serif;padding:24px">
      <h2>${kit.location}</h2>
      <p>${kit.code}</p>
      <img src="${img}" style="width:280px"/>
      <p style="font-size:12px;color:#666">Verbandsbuch BBZ – Scannen zum Eintragen</p>
    </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}
</script>
