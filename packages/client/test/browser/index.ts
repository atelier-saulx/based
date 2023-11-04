import based from '@based/client'
const client = based({
  url: 'ws://localhost:9910',
})
let firstLoad = false
client.query('meta').subscribe((x, c) => {
  if (firstLoad) {
    window.location.reload()
  }
  firstLoad = true
})

export const app = () => {
  const body = document.body
  const log = document.createElement('div')
  body.appendChild(log)
  const meta = document.createElement('pre')
  body.appendChild(meta)
  client.on('connect', (v) => {
    log.innerHTML += `<div>CONNECT: true</div>`
  })

  client.query('meta').subscribe((x, c) => {
    // @ts-ignore
    const keys = Object.keys(Object.values(x.outputs)[0].inputs)
    // @ts-ignore
    const info = Object.values(Object.values(x.outputs)[0].inputs)
      .map((v, k) => {
        // @ts-ignore
        return { key: keys[k], bytes: v.bytesInOutput }
      })
      .filter((v) => {
        return v.key !== 'test/browser/index.ts'
      })
      .sort((a, b) => (a.bytes > b.bytes ? -1 : 1))

    log.innerHTML += `<div>bytes ${info.reduce((a, c) => a + c.bytes, 0)}</div>`

    meta.innerHTML = JSON.stringify(info, null, 2)
  })
}

app()
