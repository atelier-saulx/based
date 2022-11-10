export default (payload, update, client) => {
  return client.observe(
    {
      children: true,
    },
    update
  )
}
