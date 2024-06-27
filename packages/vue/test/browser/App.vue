<script lang="ts" setup>
import based from '@based/client'
import { BasedProvider } from '../../src'
import BasedContextChecker from './BasedContextChecker.vue'
import MultipleCounter from './MultipleCounter.vue'
import SimpleCounter from './SimpleCounter.vue'

const client = based({
  url: 'ws://localhost:8081',
})
</script>

<template>
  <BasedProvider :client="client">
    <h1>Based.io VueJS Demo</h1>
    <BasedContextChecker />
    <MultipleCounter />
    <SimpleCounter />
  </BasedProvider>
</template>
