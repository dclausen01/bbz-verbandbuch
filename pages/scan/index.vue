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
            <div v-if="!secureContext">
              <v-alert type="warning" variant="tonal">
                Kamera-Zugriff ist nur über eine sichere Verbindung (HTTPS) möglich.
                Bitte die Seite über <code>https://</code> öffnen oder unten den Kasten manuell auswählen.
              </v-alert>
            </div>

            <div v-else>
              <video
                  ref="videoEl"
                  class="scan-video"
                  :class="{ 'd-none': !scanning }"
                  autoplay
                  muted
                  playsinline
              />

              <div v-if="scanning" class="text-caption text-medium-emphasis mt-2">
                Kamera aktiv – QR-Code in den Rahmen halten.
              </div>

              <div v-else class="text-center py-6">
                <v-icon size="48" class="mb-2">mdi-camera</v-icon>
                <v-alert
                    v-if="errorMessage"
                    type="warning"
                    variant="tonal"
                    class="mb-4 text-left"
                >
                  {{ errorMessage }}
                </v-alert>
                <div class="mb-4 text-body-2">
                  Für das Scannen wird der Zugriff auf die Kamera benötigt.
                </div>
                <v-btn color="primary" prepend-icon="mdi-camera" :loading="starting" @click="startCamera">
                  Kamera starten
                </v-btn>
              </div>
            </div>
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
import jsQR from 'jsqr'

definePageMeta({middleware: ['authenticated']})

const firstAidKitStore = useFirstAidKitStore()
const videoEl = ref<HTMLVideoElement | null>(null)
const secureContext = ref(true)
const scanning = ref(false)
const starting = ref(false)
const errorMessage = ref('')
const selectedKitId = ref<string | null>(null)

let stream: MediaStream | null = null
let detector: any = null
let canvas: HTMLCanvasElement | null = null
let rafId: number | null = null
let lastDecode = 0

onMounted(async () => {
  await firstAidKitStore.getAllFirstAidKits()
  // getUserMedia ist nur in sicheren Kontexten (HTTPS oder localhost) verfügbar.
  secureContext.value = !!navigator.mediaDevices?.getUserMedia
})

onBeforeUnmount(stopCamera)

async function startCamera() {
  errorMessage.value = ''
  starting.value = true
  try {
    // Schnelle native Erkennung nutzen, falls vorhanden (Android/Chrome) …
    if ('BarcodeDetector' in window) {
      try {
        // @ts-expect-error – BarcodeDetector ist (noch) nicht in den TS-DOM-Typen.
        detector = new window.BarcodeDetector({formats: ['qr_code']})
      } catch {
        detector = null
      }
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {facingMode: {ideal: 'environment'}},
    })
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      await videoEl.value.play().catch(() => undefined)
      scanning.value = true
      lastDecode = 0
      rafId = requestAnimationFrame(scanLoop)
    }
  } catch (e: any) {
    // Häufigster Fall: Nutzer hat die Berechtigung verweigert.
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      errorMessage.value =
          'Kein Kamerazugriff. Bitte die Kamera-Berechtigung für diese Seite erlauben und erneut versuchen.'
    } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
      errorMessage.value = 'Es wurde keine geeignete Kamera gefunden.'
    } else {
      errorMessage.value = 'Die Kamera konnte nicht gestartet werden. Bitte den Kasten unten manuell wählen.'
    }
    scanning.value = false
  } finally {
    starting.value = false
  }
}

function stopCamera() {
  scanning.value = false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function scanLoop(ts: number) {
  if (!scanning.value || !videoEl.value) return
  const video = videoEl.value

  // Nur ein paar Mal pro Sekunde dekodieren – schont schwächere Geräte.
  if (video.readyState >= 2 && ts - lastDecode > 200) {
    lastDecode = ts
    try {
      let value: string | null = null
      if (detector) {
        const codes = await detector.detect(video)
        if (codes?.length) value = codes[0].rawValue as string
      } else {
        value = decodeWithJsQr(video)
      }
      if (value) {
        handleResult(value)
        return
      }
    } catch {
      /* einzelne Frames können fehlschlagen – weiter versuchen */
    }
  }
  rafId = requestAnimationFrame(scanLoop)
}

function decodeWithJsQr(video: HTMLVideoElement): string | null {
  // Auf max. 640px Breite herunterskalieren – schneller als volle Auflösung.
  const maxW = 640
  const scale = Math.min(1, maxW / (video.videoWidth || maxW))
  const w = Math.round((video.videoWidth || maxW) * scale)
  const h = Math.round((video.videoHeight || maxW) * scale)
  if (!w || !h) return null

  if (!canvas) canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', {willReadFrequently: true})
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const result = jsQR(image.data, w, h, {inversionAttempts: 'dontInvert'})
  return result?.data ?? null
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
