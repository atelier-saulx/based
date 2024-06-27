<script lang="ts" setup>
import { useBasedQuery } from '../../src'

const { data, loading, error, checksum } = useBasedQuery('counter', {
  count: true,
})
</script>

<template>
  <div
    :style="{
      marginTop: '30px',
      display: 'flex',
      flexDirection: 'column',
    }"
  >
    <h3>Static Query - Live Result</h3>
    <pre
      :style="{
        padding: '30px',
        marginTop: '10px',
        alignContent: 'center',
        border: '1px solid black',
        width: '250px',
      }"
      >{{
        JSON.stringify(
          {
            data,
            error,
            checksum,
            loading,
          },
          null,
          2,
        )
      }}
    </pre>
  </div>
</template>
