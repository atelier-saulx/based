export default async ({ based }) => {
  console.info('GO GO GO', await based.secret('flap'))

  try {
    const x = await based.get({
      children: true,
    })

    const y = await based.get('counter')

    return [y, x]
  } catch (err) {
    console.error('ERR WHATS UP...', err)
  }
  return 'YESSS JONKOERNOxxxxxxxxFLAPxxxYES!'
}
