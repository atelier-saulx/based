<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useBasedQuery } from '../../src'

const queries: FakeQueryPayloads[] = [
  { name: 'counter', payload: { id: 0, count: true, speed: 100 } },
  { name: 'counter', payload: { id: 1, count: false } },
  { name: 'counter', payload: { id: 2, count: true, speed: 3000 } },
]

const name = ref<string>(queries[0].name)
const payload = ref<FakeQueryPayloads['payload']>(queries[0].payload)

type FakeQueryPayloads = {
  name: string | null
  payload?: {
    id: number
    count?: boolean
    data?: boolean
    speed?: number
  }
}

const setQuery = (_name: string, _payload: FakeQueryPayloads['payload']) => {
  name.value = _name
  payload.value = _payload
}

const query = computed(() => useBasedQuery(name.value, payload.value))
</script>

<template>
  <div
    :style="{
      display: 'flex',
      flexDirection: 'row',
    }"
  >
    <div
      :style="{
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column',
      }"
    >
      <h3>Dynamic Queries</h3>
      <div
        :style="{
          marginTop: '10px',
          display: 'flex',
        }"
      >
        <div
          v-for="query in queries"
          :style="{
            marginRight: '10px',
            cursor: 'pointer',
            border: '1px solid black',
          }"
          @click="setQuery(query.name, query.payload)"
        >
          <pre
            :style="{
              padding: '30px',
              height: '280px',
              alignContent: 'center',
            }"
            >{{ JSON.stringify(query, null, 2) }}
          </pre>
        </div>
      </div>
    </div>
    <div
      :style="{
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column',
      }"
    >
      <h3>Live Result</h3>
      <pre
        :style="{
          padding: '30px',
          background: 'black',
          color: 'white',
          width: '250px',
          marginTop: '10px',
          height: '280px',
          alignContent: 'center',
        }"
        >{{
          JSON.stringify(
            {
              payload,
              data: query.data.value,
              error: query.error.value,
              checksum: query.checksum.value,
              loading: query.loading.value,
            },
            null,
            2,
          )
        }}
      </pre>
    </div>
  </div>
</template>
