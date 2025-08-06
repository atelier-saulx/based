export const formatMetaDateTime = (createdAt: number) => {
  if (!createdAt) {
    return ''
  }
  return `${new Date(createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })} ${new Date(createdAt).toLocaleTimeString(undefined, { hour12: false })}`
}
