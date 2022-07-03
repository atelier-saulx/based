import based from '@based/client'

console.info('browser')

const init = async () => {
  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  client.client.debug = true

  const but = document.createElement('button')

  const loginStatus = document.createElement('div')

  but.innerHTML = 'LOGIN'

  but.onclick = () => {
    client.login({
      password: 'bla',
      email: 'bla@bla.com',
    })
  }

  client.observeAuth((d) => {
    loginStatus.innerHTML = d ? d.id : 'not logged in!'
  })

  //

  const butget = document.createElement('button')
  butget.innerHTML = 'GET'
  butget.onclick = () => {
    client.get({ $id: 'root', id: true })
  }

  document.body.appendChild(but)
  document.body.appendChild(loginStatus)
  document.body.appendChild(butget)
}

init()
