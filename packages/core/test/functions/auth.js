module.exports = async (context) => {
  console.info(context)
  return context.authState === 'mock_token'
}
