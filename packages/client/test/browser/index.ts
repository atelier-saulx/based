import based from '@based/client'

const client = based({
  url: 'ws://localhost:8082',
})

export const app = () => {
  const body = document.body
  client.query('text').subscribe((d) => {
    body.innerHTML = d.map((v) => `<div>${v}</div>`).join('!!!----------')
  })
}

app()
