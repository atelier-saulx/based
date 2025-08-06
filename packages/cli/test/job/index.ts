import type { BasedJobFunction } from '@based/functions'

let cnt = 0

const testJob: BasedJobFunction = (based) => {
  console.log('---- this is job', based)
  const interval = setInterval(() => {
    console.info('--- job interval ', ++cnt)
  }, 3e3)
  return () => {
    console.log('---- close job')
    clearInterval(interval)
  }
}
export default testJob
