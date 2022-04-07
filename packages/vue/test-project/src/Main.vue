<template>
  <div v-if="loading">LOADING</div>
  <div v-else>
    <div class="chat-app">
      <div class="chat-list">
        <h2>Chat Rooms</h2>
        <!-- <li><a href=""> person one </a></li>
        <li><a href=""> person two </a></li>
        <li><a href=""> person three </a></li> -->
      </div>
      <div class="chat-area">
        <div class="message-list">
          {{ data.messages }}
        </div>
        <div class="message-box">
          <input-text
            placeHolder="Type new message and press enter to send..."
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'
import InputText from './components/InputText.vue'
import { useData, useClient } from '../../'
import { ref } from 'vue'

export default {
  name: 'App',
  components: {
    HelloWorld,
    InputText,
  },
  setup: () => {
    const client = useClient()
    return {
      sendMessage: () => {
        client.set({
          type: 'message',
          sender: 'lfdksjhf',
          content: 'testytest',
        })
      },
      ...useData({
        messages: {
          $id: 'root',
          $all: true,
          $list: {
            $sort: { $field: 'createdAt', $order: 'desc' },
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'type',
                $operator: '=',
                $value: 'message',
              },
            },
          },
        },
      }),
    }
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.chat-app {
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-area {
  margin: 10rem;
}
.message-list {
  list-style: none;
}
</style>
