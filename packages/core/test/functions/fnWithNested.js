const { runFunction, get, decode } = require('@based/server/worker')

module.exports = async (payload, context) => {
  const x = await runFunction('hello', payload, context)
  const bla = await get('obsWithNested', 'json', context)
  console.info('NESTED -->', bla, JSON.parse(decode(bla)))
  return x
}
