export default async (payload, update, client) => {
  console.info('!!nice observe!')
  return client.observe(
    {
      children: true,
    },
    update
  )
}
