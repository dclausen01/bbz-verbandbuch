<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h2 class="text-h6">Bestände &amp; Nachfüllbedarf</h2>
      <v-spacer/>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openEdit()">Bestand erfassen</v-btn>
    </div>

    <v-alert
        v-if="lowStock.length"
        type="warning"
        variant="tonal"
        class="mb-4"
        :title="`${lowStock.length} Position(en) unter Sollbestand`"
        text="Bitte die markierten Materialien nachfüllen."
    />

    <v-data-table
        :headers="headers"
        :items="rows"
        :loading="loading"
        :group-by="[{key: 'kit.location'}]"
    >
      <template #item.status="{item}">
        <v-chip
            :color="item.currentQty < item.targetQty ? 'warning' : 'success'"
            size="small"
            variant="tonal"
        >
          {{ item.currentQty < item.targetQty ? 'Nachfüllen' : 'OK' }}
        </v-chip>
      </template>
      <template #item.actions="{item}">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)"/>
      </template>
      <template #no-data>
        Noch keine Bestände erfasst.
      </template>
    </v-data-table>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ editing ? 'Bestand bearbeiten' : 'Bestand erfassen' }}</v-card-title>
        <v-card-text>
          <v-autocomplete
              v-if="!editing"
              v-model="form.kitId"
              :items="firstAidKitStore.firstAidKits"
              item-title="location"
              item-value="id"
              label="Verbandkasten"
          />
          <v-autocomplete
              v-if="!editing"
              v-model="form.productId"
              :items="firstAidKitStore.products"
              item-title="type"
              item-value="id"
              label="Material"
          />
          <div v-else class="mb-2">
            <div class="text-subtitle-2">{{ current?.kit.location }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ current?.product.type }}</div>
          </div>
          <v-row>
            <v-col cols="6">
              <v-text-field v-model.number="form.targetQty" type="number" min="0" label="Soll-Bestand"/>
            </v-col>
            <v-col cols="6">
              <v-text-field v-model.number="form.currentQty" type="number" min="0" label="Ist-Bestand"/>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="dialog = false">Abbrechen</v-btn>
          <v-btn color="primary" variant="tonal" @click="save">Speichern</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import {useSnackBar} from '#imports'

definePageMeta({middleware: ['authenticated']})

interface KitProductRow {
  id: string
  kit: {id: string; location: string; code: string}
  product: {id: string; type: string}
  targetQty: number
  currentQty: number
}

const {$msFetch} = useNuxtApp()
const {user} = useUserSession()
const {showSnackbarError} = useSnackBar()
const firstAidKitStore = useFirstAidKitStore()

const rows = ref<KitProductRow[]>([])
const loading = ref(true)
const dialog = ref(false)
const editing = ref(false)
const current = ref<KitProductRow | null>(null)
const form = reactive({kitId: '', productId: '', targetQty: 0, currentQty: 0})

const headers = [
  {key: 'kit.location', title: 'Kasten'},
  {key: 'product.type', title: 'Material'},
  {key: 'targetQty', title: 'Soll'},
  {key: 'currentQty', title: 'Ist'},
  {key: 'status', title: 'Status', sortable: false},
  {key: 'actions', title: '', sortable: false},
]

const lowStock = computed(() => rows.value.filter((r) => r.currentQty < r.targetQty))

async function load() {
  loading.value = true
  rows.value = await $msFetch<KitProductRow[]>('/bestand')
  loading.value = false
}

onMounted(async () => {
  if (user.value?.role !== 'ADMIN') {
    await navigateTo('/')
    return
  }
  await Promise.all([firstAidKitStore.getAllFirstAidKits(), firstAidKitStore.getAllProducts(), load()])
})

function openEdit(item?: KitProductRow) {
  editing.value = !!item
  current.value = item ?? null
  form.kitId = item?.kit.id ?? ''
  form.productId = item?.product.id ?? ''
  form.targetQty = item?.targetQty ?? 0
  form.currentQty = item?.currentQty ?? 0
  dialog.value = true
}

async function save() {
  try {
    if (editing.value && current.value) {
      await $msFetch(`/bestand/${current.value.id}`, {
        method: 'PUT',
        body: {targetQty: form.targetQty, currentQty: form.currentQty},
      })
    } else {
      if (!form.kitId || !form.productId) {
        showSnackbarError('Bitte Kasten und Material wählen.')
        return
      }
      await $msFetch('/bestand', {method: 'POST', body: {...form}})
    }
    dialog.value = false
    await load()
  } catch (e) {
    showSnackbarError('Speichern fehlgeschlagen.')
  }
}
</script>
