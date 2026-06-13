<template>
  <v-dialog v-model="isDialogOpen">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>{{ text }}</v-card-text>
      <v-card-actions>
        <v-btn :color="cancelColor" @click="cancel">
          {{ cancelText }}
        </v-btn>
        <v-btn :color="confirmColor" variant="tonal" @click="confirm">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup>
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])
const isDialogOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
const props = defineProps({
  title: {
    required: true,
    type: String
  },
  text: {
    required: true,
    type: String
  },
  cancelText: {
    required: false,
    type: String,
    default: 'Abbrechen'
  },
  confirmText: {
    required: false,
    type: String,
    default: 'Speichern'
  },
  modelValue: {
    required: true,
    type: Boolean
  },
  cancelColor: {
    required: false,
    type: String,
    default: "error"
  },
  confirmColor: {
    required: false,
    type: String,
    default: "primary"
  }
})

function cancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>