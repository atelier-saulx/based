module.exports = async (payload) => {
  console.info('THIS IS A LOG')
  if (payload) {
    return payload.length
  }
  return 'flap'
}
