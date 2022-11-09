export default async (payload, update, client) => {
  // const cl2 = client.observe('counter', (d, c) => {
  //   console.info('NESTED OBSSSSS', d, c)
  // })

  // const cl = client.observe('counter', update)

  const cl3 = client.observe(payload, update)

  return () => {
    // cl()
    // cl2()
    cl3()
  }
}
