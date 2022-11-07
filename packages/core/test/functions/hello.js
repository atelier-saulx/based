module.exports = async (payload) => {
  console.info('???--->', payload)
  if (payload) {
    return payload.length
  }
  return 'flap'
}
