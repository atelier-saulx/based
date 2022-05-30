import { createApp } from 'vue'
import { createClient } from '@based/vue'
import App from './Main.vue'

const app = createApp(App)

app.use(
  createClient({
    url: 'ws://localhost:9100',
  })
)

app.mount('#app')
