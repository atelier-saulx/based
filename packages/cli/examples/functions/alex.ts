export default async ({ based, payload }) => {
  await based.set({
    type: 'thing',
    name: payload.name,
  })

  return 'the best guy!!!'
}
