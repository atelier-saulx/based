export default (authState: any): any => {
  if (!authState) {
    return
  }
  if (typeof authState !== 'string') {
    return authState
  }
  try {
    return JSON.parse(authState)
  } catch (err) {}
  if (typeof authState === 'string') {
    return { token: authState }
  }
  return authState
}
