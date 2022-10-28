module.exports = async (context) => {
  return context.authState === 'mock_token'
}
