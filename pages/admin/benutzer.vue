<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6">Benutzerverwaltung</h2>
      <v-spacer/>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate = true">Benutzer freischalten</v-btn>
    </div>

    <v-alert type="info" variant="tonal" class="mb-4">
      Kollegen melden sich mit ihrem Schul-Konto (LDAP) an. Die <strong>Rolle</strong> wird hier vergeben –
      Administrator:innen verwalten Kästen, Bestände und Benutzer.
    </v-alert>

    <v-data-table :headers="headers" :items="users" :loading="loading">
      <template #item.role="{item}">
        <v-select
            :model-value="item.role"
            :items="roleOptions"
            density="compact"
            variant="plain"
            hide-details
            :disabled="item.id === user?.id"
            style="max-width: 220px"
            @update:model-value="(r) => changeRole(item, r)"
        />
      </template>
      <template #item.actions="{item}">
        <v-btn
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            :disabled="item.id === user?.id"
            @click="userToDelete = item; openDelete = true"
        />
      </template>
      <template #no-data>Noch keine Benutzer vorhanden.</template>
    </v-data-table>

    <v-dialog v-model="openCreate" max-width="480">
      <v-card>
        <v-card-title>Benutzer freischalten</v-card-title>
        <v-card-text>
          <v-text-field
              v-model="form.loginSub"
              label="Login-Kennung (z.B. sAMAccountName) *"
              hint="Genau wie beim AD-Login, z.B. m.mustermann"
              persistent-hint
          />
          <v-text-field v-model="form.name" label="Name (optional)"/>
          <v-select v-model="form.role" :items="roleOptions" label="Rolle"/>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn @click="openCreate = false">Abbrechen</v-btn>
          <v-btn color="primary" variant="tonal" @click="createUser">Anlegen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <app-dialog
        v-model="openDelete"
        title="Benutzer löschen"
        :text="`Benutzer „${userToDelete?.name || userToDelete?.loginSub}“ wirklich löschen?`"
        confirm-text="Löschen"
        @confirm="deleteUser"
    />
  </div>
</template>
<script setup lang="ts">
import {useSnackBar} from '#imports'
import AppDialog from '~/components/app-dialog.vue'

definePageMeta({middleware: ['authenticated']})

interface UserRow {
  id: number
  loginSub: string
  name: string
  role: 'ADMIN' | 'REPORTER'
}

const {$msFetch} = useNuxtApp()
const {user} = useUserSession()
const {showSnackbarSuccess, showSnackbarError} = useSnackBar()

const users = ref<UserRow[]>([])
const loading = ref(true)
const openCreate = ref(false)
const openDelete = ref(false)
const userToDelete = ref<UserRow | null>(null)
const form = reactive({loginSub: '', name: '', role: 'REPORTER' as UserRow['role']})

const roleOptions = [
  {title: 'Administrator:in', value: 'ADMIN'},
  {title: 'Berichterstatter:in', value: 'REPORTER'},
]
const headers = [
  {key: 'name', title: 'Name'},
  {key: 'loginSub', title: 'Login-Kennung'},
  {key: 'role', title: 'Rolle'},
  {key: 'actions', title: '', sortable: false},
]

async function load() {
  loading.value = true
  users.value = await $msFetch<UserRow[]>('/user')
  loading.value = false
}

onMounted(async () => {
  if (user.value?.role !== 'ADMIN') {
    await navigateTo('/')
    return
  }
  await load()
})

async function createUser() {
  if (!form.loginSub.trim()) {
    showSnackbarError('Bitte eine Login-Kennung angeben.')
    return
  }
  try {
    await $msFetch('/user', {method: 'POST', body: {...form, loginSub: form.loginSub.trim()}})
    showSnackbarSuccess('Benutzer wurde freigeschaltet.')
    openCreate.value = false
    form.loginSub = ''
    form.name = ''
    form.role = 'REPORTER'
    await load()
  } catch (e: any) {
    showSnackbarError(e?.data?.message || 'Anlegen fehlgeschlagen.')
  }
}

async function changeRole(target: UserRow, role: UserRow['role']) {
  try {
    await $msFetch(`/user/${target.id}`, {method: 'PUT', body: {role}})
    showSnackbarSuccess('Rolle aktualisiert.')
    await load()
  } catch (e: any) {
    showSnackbarError(e?.data?.message || 'Änderung fehlgeschlagen.')
    await load()
  }
}

async function deleteUser() {
  if (!userToDelete.value) return
  try {
    await $msFetch(`/user/${userToDelete.value.id}`, {method: 'DELETE'})
    showSnackbarSuccess('Benutzer gelöscht.')
    userToDelete.value = null
    await load()
  } catch (e: any) {
    showSnackbarError(e?.data?.message || 'Löschen fehlgeschlagen.')
  }
}
</script>
