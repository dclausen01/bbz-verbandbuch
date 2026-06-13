<template>
  <div>
    <h2 class="text-h6 mb-4">QR-Code scannen</h2>

    <v-alert type="info" variant="tonal" class="mb-4">
      Scannen Sie den QR-Code am Verbandkasten, um direkt einen Eintrag für diesen Kasten zu erstellen.
    </v-alert>

    <v-row>
      <v-col cols="12" md="7">
        <v-card border rounded="lg">
          <v-card-text>
            <div v-if="cameraSupported">
              <video ref="videoEl" class="scan-video" autoplay muted playsinline/>
              <div class="text-caption text-medium-emphasis mt-2">
                {{ scanning ? 'Kamera aktiv – QR-Code in den Rahmen halten.' : 'Kamera wird gestartet…' }}
              </div>
            </div>
            <v-alert v-else type="warning" variant="tonal">
              Dieses Gerät/Browser unterstützt das Kamera-Scannen nicht. Bitte den Kasten unten manuell auswählen.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card border rounded="lg">
          <v-card-title class="text-subtitle-1">Manuell auswählen</v-card-title>
          <v-card-text>
            <v-autocomplete
                v-model="selectedKitId"
                :items="firstAidKitStore.firstAidKits"
                item-title="location"
                item-value="id"
                label="Verbandkasten"
                no-data-text="Keine Kästen gefunden"
            />
            <v-btn
                color="primary"
                block
                :disabled="!selectedKitId"
                @click="goToEntry(selectedKitId)"
            >
              Eintrag erstellen
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
<script setup lang="ts">
definePageMeta({middleware: ['authenticated']})

const firstAidKitStore = useFirstAidKitStore()
const videoEl = ref<HTMLVideoElement | null>(null)
const cameraSupported = ref(false)
const scanning = ref(false)
const selectedKitId = ref<string | null>(null)

let stream: MediaStream | null = null
let detector: any = null
let rafId: number | null = null

onMounted(async () => {
  await firstAidKitStore.getAllFirstAidKits()

  // BarcodeDetector ist nativ (Chrome/Edge/Android) – kein zusätzliches Paket nötig.
  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window
  const hasCamera = !!navigator.mediaDevices?.getUserMedia
  cameraSupported.value = hasDetector && hasCamera
  if (cameraSupported.value) await startCamera()
})

onBeforeUnmount(stopCamera)

async function startCamera() {
  try {
    // @ts-expect-error – BarcodeDetector ist (noch) nicht in den TS-DOM-Typen.
    detector = new window.BarcodeDetector({formats: ['qr_code']})
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}})
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      scanning.value = true
      scanLoop()
    }
  } catch (e) {
    cameraSupported.value = false
  }
}

function stopCamera() {
  scanning.value = false
  if (rafId) cancelAnimationFrame(rafId)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function scanLoop() {
  if (!scanning.value || !videoEl.value || !detector) return
  try {
    const codes = await detector.detect(videoEl.value)
    if (codes?.length) {
      handleResult(codes[0].rawValue as string)
      return
    }
  } catch {
    /* einzelne Frames können fehlschlagen – einfach weiter versuchen */
  }
  rafId = requestAnimationFrame(scanLoop)
}

function handleResult(value: string) {
  stopCamera()
  // Der QR-Code enthält i.d.R. eine vollständige URL (…/formular/new?kit=CODE).
  let kit = value
  try {
    const url = new URL(value)
    kit = url.searchParams.get('kit') ?? value
  } catch {
    /* kein URL – Rohwert als Code verwenden */
  }
  goToEntry(kit)
}

function goToEntry(kit: string | null) {
  if (!kit) return
  navigateTo(`/formular/new?kit=${encodeURIComponent(kit)}`)
}
</script>
<style scoped>
.scan-video {
  width: 100%;
  max-height: 360px;
  border-radius: 8px;
  background: #000;
  object-fit: cover;
}
</style>
