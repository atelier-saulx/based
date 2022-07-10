import based from '@based/client'

console.info('browser')

const init = async () => {
  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  client.client.debug = true
  client.observe('bla', (d) => {
    console.info(d)
  })

  // client.observe({ id: true }, () => {})
}

init()