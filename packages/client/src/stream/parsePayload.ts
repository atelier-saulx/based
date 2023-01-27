export const parsePayload = (payload: any): string => {
  if (typeof payload === 'string') {
    return payload
  }
  try {
    return JSON.stringify(payload)
  } catch (err) {}
  return payload
}
