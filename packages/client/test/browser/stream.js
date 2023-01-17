module.exports = async ({ payload, stream }) => {
  console.info('---------------Incoming stream! \n', payload)
  stream.on('progress', (p) => {
    console.info('progress', payload, p)
  })
  let size = 0
  stream.on('data', (c) => {
    size += c.byteLength
  })

  stream.on('end', () => {
    console.info(
      'done!/....',
      Math.floor((100 * size) / 1024 / 1024) / 100,
      'mb'
    )
  })
  return 'flap!'
}
