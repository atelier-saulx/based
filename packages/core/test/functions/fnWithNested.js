const { runFunction, get, decode } = require('@based/server/worker')

module.exports = async (payload, context) => {
  const x = await runFunction('hello', payload, context)
  await get('obsWithNested', 'json', context)
  // const bla =
  // console.info('NESTED -->', bla, JSON.parse(decode(bla)))
  return x
}
