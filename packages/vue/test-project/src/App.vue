<template>
  <div v-if="loading">LOADING</div>
  <div v-else>
    <button @click="limit">limit it</button>
    <button @click="makeThing">
      {{ data.things?.length }}
    </button>
    <div>{{ badboy }}</div>
    <hello-world :msg="data" />
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

<script>
import HelloWorld from './components/HelloWorld.vue'
import { useData, useClient } from '../../'
import { ref } from 'vue'

export default {
  name: 'App',
  components: {
    HelloWorld,
  },
  setup: () => {
    const client = useClient()
    // x
    const badboy = useData('counter', {}).data

    const limit = ref(1000)
    return {
      limit: () => {
        console.log('x')
        limit.value = ~~(Math.random() * 50)
      },
      makeThing: () => {
        client.set({
          type: 'thing',
          randomNumber: ~~(Math.random() * 999999),
          name: 'Thing ' + ~~(Math.random() * 999999),
        })
      },
      badboy,
      ...useData({
        things: {
          $all: true,
          $list: {
            $sort: { $field: 'randomNumber', $order: 'asc' },
            $offset: 0,
            $limit: limit,
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'type',
                $operator: '=',
                $value: 'thing',
              },
            },
          },
        },
      }),
    }
  },
}
</script>
