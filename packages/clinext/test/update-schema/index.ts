import type { BasedFunction } from '@based/functions'
// import {
//   adjectives,
//   animals,
//   colors,
//   uniqueNamesGenerator,
// } from 'unique-names-generator'

// wiohfwepofhew

const clean = (obj: any) => {
  delete obj.id
  delete obj.hash
  delete obj.lastId
  for (const i in obj) {
    if (obj[i] && typeof obj[i] === 'object') {
      clean(obj[i])
    }
  }
}

const hello: BasedFunction = async (based, payload) => {
  clean(payload)
  return based.db.setSchema(payload)
}

export default hello
