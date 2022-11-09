export default async (client, name, payload) => {
  console.info('AUTH TIME', name, payload, !!client)
  return true
}
