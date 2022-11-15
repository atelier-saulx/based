export default async ({ update, client }) => {
  console.info('!!nice observe!')
  return client.observe(
    {
      children: true,
    },
    update
  )
}
