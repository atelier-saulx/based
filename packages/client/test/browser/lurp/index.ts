export default async ({ based, update }) => {
  let cnt = 0
  update({ cnt: ++cnt })
  const interval = setInterval(() => {
    update({ cnt: ++cnt })
  }, 100)
  return () => {
    clearInterval(interval)
  }
}
