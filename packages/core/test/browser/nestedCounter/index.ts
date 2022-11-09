export default async (payload, update, client) => {
  const cl2 = client.observe('counter', (d) => {
    console.info('counter => auto decoded', d)
  })

  const cl = client.observe('counter', update)

  const cl3 = client.observe(payload, update)

  return () => {
    cl()
    cl2()
    cl3()
  }
}
