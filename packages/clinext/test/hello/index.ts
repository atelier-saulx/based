import type { BasedFunction } from '@based/functions'
// import {
//   adjectives,
//   animals,
//   colors,
//   uniqueNamesGenerator,
// } from 'unique-names-generator'

// wiohfwepofhew

const hello: BasedFunction = async (based) => {
  await based.db.setSchema({
    types: {
      user: {
        email: 'alias',
        firstName: 'string',
        lastName: 'string',
      },
    },
  })
  let i = 1
  while (i--) {
    const firstName = 'John ' + i
    const lastName = 'Doe ' + i
    const email = `${firstName}${lastName}@example.com`.toLowerCase()

    based.db.upsert('user', {
      firstName,
      lastName,
      email,
    })
  }

  await based.db.drain()
  return 'populated'
}

export default hello
