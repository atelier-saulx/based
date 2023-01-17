const myCrasher = () => {
  throw new Error('RANDO OBSERVER CRASH!')
}

export default async (payload, update, client) => {
  const close = client.observe('counter', (d, c) => {
    myCrasher()
    update(d, c)
  })
  return () => {
    close()
  }
}
