export default async (payload, client) => {
  client.set('hello', {})

  try {
    const x = await client.get({
      children: true,
    })

    const y = await client.get('counter')

    return [y, x]
  } catch (err) {
    console.error('ERR WHATS UP...', err)
  }
  return 'YESSS JONKOERNOxxxxxxxxFLAPxxxYES!'
}
