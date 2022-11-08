export default async (_client, name) => {
  console.warn('  No authorize configured for server - dummy auth', name)
  return true
}
