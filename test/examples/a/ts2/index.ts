import { BasedQueryFunction, BasedAppFunction } from '@based/functions'

const bla: BasedQueryFunction = async (based, payload, update) => {
  let n = 0
  const i = setInterval(async () => {
    update(
      'snurko!!???xxxxx: ' +
        n++ +
        JSON.stringify(
          await based
            .call('db:get', {
              $id: 'root',
              $all: true,
            })
            .catch(console.error),
        ),
    )
  }, 500)

  return () => {
    clearInterval(i)
  }
}

export default bla
