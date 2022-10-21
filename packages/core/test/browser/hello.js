module.exports = async (payload) => {
  console.info('worker incoming payload:', payload.length / 1024 / 1024)
  return 'ha! ' + payload.length
}
