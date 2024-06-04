<script lang="ts" setup>
import { inject } from 'vue'
import { useBasedStatus } from '../../src'

const { status, connected } = useBasedStatus()

const context = inject('client')
</script>

<template>
  <div :style="{ marginTop: '10px' }">
    <p>URL: {{ context.opts.url.toString() }}</p>
    <p>CONNECTED: {{ connected }}</p>
    <p>STATUS: {{ status }}</p>
  </div>
</template>
