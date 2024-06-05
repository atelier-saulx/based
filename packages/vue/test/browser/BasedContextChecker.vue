<script lang="ts" setup>
import { inject } from 'vue'
import { useBasedStatus, BasedContext } from '../../src'
import type { BasedClient } from '@based/client'

const { status, connected } = useBasedStatus()

const context: BasedClient = inject(BasedContext.CLIENT)
</script>

<template>
  <div :style="{ marginTop: '10px' }">
    <p>URL: {{ context.opts.url.toString() }}</p>
    <p>CONNECTED: {{ connected }}</p>
    <p>STATUS: {{ status }}</p>
  </div>
</template>
