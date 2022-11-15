export default async ({ client, user, name, payload, callStack, type }) => {
  // authorize: async ({ user, payload, name, type, based, callstack }) => {

  /*

  js
user?._token == apiKey
const token = await user._token
const token = await user.token(envKey)
if (user.isBasedUser) {
        const isValid = await user.token()
        ...
}

js
√ based.set(model)
√ based.get(query)
√ based.delete(query)
based.opts.env === 'dev'
based.secret(envKey)
based.observe(query, update)

(d) => {
      subsResults[0].push(deepCopy(d))
    }),

{ payload, based }

  */

  console.info(
    '--> Need to auth',
    'NAME:',
    name,
    payload,
    callStack,
    type,
    user.ip
  )
  return true
}
