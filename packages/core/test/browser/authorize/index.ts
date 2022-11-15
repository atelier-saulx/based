export default async (client, name, payload) => {
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

  */

  console.info('--> Need to auth', name, payload)
  return true
}
