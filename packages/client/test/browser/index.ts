import based from '@based/client'
const client = based({
  url: 'ws://localhost:9910',
})
let firstLoad = false
client.query('meta').subscribe(
  (x, c) => {
    if (firstLoad) {
      window.location.reload()
    }
    firstLoad = true
  },
  (err) => {
    console.error('??')
  }
)

export const app = () => {
  const body = document.body

  const login = document.createElement('button')

  login.innerHTML = 'LOGIN'

  login.onclick = () => {
    client.call('login', { name: 'x', password: 'x' })
  }

  body.appendChild(login)

  const logout = document.createElement('button')

  logout.innerHTML = 'LOGOUT'

  logout.onclick = () => {
    client.setAuthState({})
  }
  body.appendChild(logout)

  const fileUpload = document.createElement('input')
  fileUpload.type = 'file'
  fileUpload.onchange = async (e) => {
    // @ts-ignore
    console.log('|--->', e.target.files[0])
    // @ts-ignore
    const x = await client.stream('flap', { contents: e.target.files[0] })
    console.info('READY', { x })
  }
  body.appendChild(fileUpload)

  const btn = document.createElement('button')
  btn.onclick = async (e) => {
    const x = await client.stream('flap', { contents: 'flap' })
    console.info('READY', { x })
  }
  btn.innerHTML = 'blap'
  body.appendChild(btn)

  const log = document.createElement('div')
  body.appendChild(log)
  const meta = document.createElement('pre')
  body.appendChild(meta)
  client.on('connect', (v) => {
    log.innerHTML += `<div>CONNECT: true</div>`
  })

  client.query('counter').subscribe(
    (d) => {
      log.innerHTML = `<span>cnt: ${d}</span>`
    },
    (err) => {
      console.error(err)
    }
  )

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
