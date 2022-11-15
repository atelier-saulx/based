module.exports = async (context) => {
  console.info('AUTH===>', context)
  return context.authState === 'mock_token'
}
