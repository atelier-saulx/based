export default async (payload) => {
  throw new Error('My crash ' + payload)
}
