import { BasedClient } from '@based/client'

const makeButton = (label: string, fn: () => void) => {
  const button = document.createElement('button')
  button.innerHTML = label
  button.style.margin = '40px'
  button.onclick = fn
  document.body.appendChild(button)
}

const init = async () => {
  const coreClient = new BasedClient()

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:8081'
    },
  })

  makeButton('call hello', async () => {
    console.info(await coreClient.call('hello', { x: true }))
  })
}

init()
