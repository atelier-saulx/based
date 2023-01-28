import { BasedClient } from '@based/client'
import { logs, button, toggleButton } from './ui'

const init = async () => {
  document.body.style.padding = '10px'

  const based = new BasedClient()

  based.connect({
    url: async () => {
      return 'ws://localhost:8081'
    },
  })

  button('Call hello', async () => {
    log('Call hello', await based.call('hello', { x: true }))
  })

  toggleButton('Counter', () => {
    return based.query('counter', { speed: 10 }).subscribe((d) => {
      log('Counter', d)
    })
  })

  toggleButton('Counter slow', () => {
    return based.query('counter', { speed: 1e3 }).subscribe((d) => {
      log('Counter slow', d)
    })
  })

  based.on('authstate-change', (d) => {
    log('authstate-change', d)
  })

  toggleButton('setAuthState', () => {
    based.setAuthState({
      token: 'power',
    })
    return () => {
      based.clearAuthState()
    }
  })

  const log = logs()
}

init()
