<script lang="ts" setup>
import { provide } from 'vue'
import { BasedClient } from '@based/client'
import { BasedContext } from './index'

/**
 * The props from the `BasedProvider` component
 */
const props = defineProps({
  /** All the connection information that identifies you in the `Based` cloud. */
  client: BasedClient,
})

defineSlots<{
  default(): any
}>()

provide(BasedContext.CLIENT, props.client)
</script>

<template>
  <div class="based-io">
    <slot />
  </div>
</template>
