<template>
  <v-layout>
    <v-navigation-drawer
        v-model="isDrawerOpen"
        :permanent="mdAndUp"
        :temporary="!mdAndUp"
    >
      <!-- Kopf: Logo + Titel -->
      <v-list-item class="py-3" to="/">
        <template #prepend>
          <v-avatar rounded="0" size="36">
            <v-img src="/bbz-logo.png" alt="BBZ"/>
          </v-avatar>
        </template>
        <v-list-item-title class="text-subtitle-1 font-weight-bold">Verbandsbuch</v-list-item-title>
        <v-list-item-subtitle>BBZ</v-list-item-subtitle>
      </v-list-item>

      <div class="px-3 py-2">
        <v-btn
            to="/formular/new"
            color="primary"
            block
            prepend-icon="mdi-plus-circle"
        >
          Neuer Eintrag
        </v-btn>
      </div>

      <v-divider/>

      <!-- Navigation -->
      <v-list nav density="comfortable">
        <v-list-item
            v-for="item in visibleNavItems"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            exact
        />
      </v-list>

      <!-- Nutzerbereich am unteren Rand -->
      <template #append>
        <v-divider/>
        <v-list density="comfortable">
          <v-list-item :prepend-icon="user?.role === 'ADMIN' ? 'mdi-shield-account' : 'mdi-account'">
            <v-list-item-title class="text-truncate">{{ user?.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ roleLabel }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
              prepend-icon="mdi-logout"
              title="Abmelden"
              @click="logout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <template #prepend>
        <v-app-bar-nav-icon v-if="!mdAndUp" @click.stop="isDrawerOpen = !isDrawerOpen"/>
      </template>
      <v-app-bar-title>{{ currentTitle }}</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container class="px-2 px-sm-4">
        <v-sheet rounded="lg" elevation="4" class="pa-3 pa-sm-4">
          <slot/>
        </v-sheet>
      </v-container>
    </v-main>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-layout>
</template>
<script setup lang="ts">
import {useSnackBar, useUserSession} from "#imports";
import {useDisplay} from "vuetify";

interface NavItem {
  title: string
  to: string
  icon: string
  adminOnly?: boolean
}

const {user, clear} = useUserSession();
const {snackbar} = useSnackBar()
const {mdAndUp} = useDisplay()
const route = useRoute()

// Auf großen Screens ist die Sidebar dauerhaft sichtbar (permanent), auf
// kleinen ein Overlay, das geschlossen startet und nach Navigation zugeht.
const isDrawerOpen = ref<boolean>(false);
watch(() => route.path, () => {
  if (!mdAndUp.value) isDrawerOpen.value = false
})

const navItems: NavItem[] = [
  {title: 'Verbandbuch', to: '/', icon: 'mdi-book-open-variant'},
  {title: 'Verbandkästen', to: '/kaesten', icon: 'mdi-medical-bag'},
  {title: 'QR-Code scannen', to: '/scan', icon: 'mdi-qrcode-scan'},
  {title: 'Bestände', to: '/bestand', icon: 'mdi-package-variant-closed', adminOnly: true},
  {title: 'Benutzer', to: '/admin/benutzer', icon: 'mdi-account-group', adminOnly: true},
  {title: 'Info', to: '/info', icon: 'mdi-information-outline'},
]

const isAdmin = computed(() => user.value?.role === 'ADMIN')
const visibleNavItems = computed(() => navItems.filter((i) => !i.adminOnly || isAdmin.value))
const roleLabel = computed(() => (isAdmin.value ? 'Administrator:in' : 'Berichterstatter:in'))

const currentTitle = computed(() => {
  const match = [...navItems].sort((a, b) => b.to.length - a.to.length)
      .find((i) => i.to === '/' ? route.path === '/' : route.path.startsWith(i.to))
  return match?.title ?? 'Verbandsbuch'
})

async function logout() {
  await $fetch('/api/logout', {method: 'POST'}).catch(() => undefined)
  await clear();
  navigateTo('/login');
}
</script>
<style>
.v-application__wrap {
  min-height: unset !important;
}
</style>
