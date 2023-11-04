// @ts-nocheck

import based from '@based/client'

const client = based({
  url: 'ws://localhost:9910',
})

client.on('connect', (v) => {
  console.log('CONNECT', v)
})

export const app = () => {
  const body = document.body
  let firstLoad = false

  console.log('?dssdsd')

  client.query('meta').subscribe((x, c) => {
    // if (firstLoad) {
    //   window.location.reload()
    // }
    // firstLoad = true

    console.log(x, c)

    let total = 0
    const keys = Object.keys(Object.values(x.outputs)[0].inputs)
    const info = Object.values(Object.values(x.outputs)[0].inputs)
      .map((v, k) => {
        total += v.bytesInOutput
        return { key: keys[k], bytes: v.bytesInOutput }
      })
      .sort((a, b) => (a.bytes > b.bytes ? -1 : 1))

    body.innerHTML = `-> ${~~(total / 1024)} kb<pre>${JSON.stringify(
      info,
      null,
      2
    )}</pre>`
  })
}

app()
