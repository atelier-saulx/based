import based from '@based/client'
const client = based(
  {
    url: 'ws://localhost:5050',
  },
  {
    restFallBack: {
      pollInverval: 500,
    },
  },
)

client.on('authstate-change', (v) => {
  console.log('auth change', v)
})

export const app = () => {
  const body = document.body

  const hello = document.createElement('button')
  hello.innerHTML = 'HELLO'
  body.appendChild(hello)
  hello.onclick = () => {
    client.call('hello').then(alert)
  }

  const helloSecure = document.createElement('button')
  helloSecure.innerHTML = 'HELLO SECURE'
  body.appendChild(helloSecure)
  helloSecure.onclick = () => {
    client.call('helloSecure').then(alert)
  }

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
  btn.innerHTML = 'upload from contents'
  body.appendChild(btn)

  const log = document.createElement('div')
  body.appendChild(log)
  client.on('connect', (v) => {
    log.innerHTML += `<div>CONNECT: true</div>`
  })
  client.query('counter').subscribe(
    (d) => {
      log.innerHTML = `<span>cnt: ${d}</span>`
    },
    (err) => {
      console.error(err)
    },
  )

  const text = document.createElement('pre')
  body.appendChild(text)
  client.query('text').subscribe(
    (d) => {
      text.innerHTML = d.join('\n')
    },
    (err) => {
      console.error(err)
    },
  )
}

app()
