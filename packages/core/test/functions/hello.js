export default async ({ payload }) => {
  if (payload) {
    return payload
  }
  return 'flap'
}
