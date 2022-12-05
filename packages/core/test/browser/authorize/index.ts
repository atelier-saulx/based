export default async ({ based, user, name, payload, callStack, type }) => {
  console.info(
    '--> Need to auth',
    'NAME:',
    name,
    'TOKEN:',
    await user.token(),
    payload,
    callStack,
    type,
    user.ip,
    'GET',
    await based.get({ id: true })
  )
  return true
}
