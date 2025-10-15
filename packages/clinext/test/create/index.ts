import type { BasedFunction } from '@based/functions'
import { deepCopy, deepMerge } from '@based/utils'

const create: BasedFunction = async (based, args: [string]) => {
  const type = args[0]
  if (!based.db.schema?.types?.[type]) {
    await based.call(
      'update-schema',
      deepMerge(
        {
          types: {
            [type]: {
              props: {
                name: 'string',
              },
            },
          },
        },
        deepCopy(based.db.schema),
      ),
    )
  }
  await based.db.create(...args)
}

export default create
