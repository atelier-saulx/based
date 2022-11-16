module.exports = async (payload) => {
  if (payload) {
    return payload.length
  }
  return 'flap'
}
