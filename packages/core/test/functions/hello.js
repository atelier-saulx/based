module.exports = async (payload) => {
  console.log('???', payload)
  if (payload) {
    return payload
  }
  return 'flap'
}
