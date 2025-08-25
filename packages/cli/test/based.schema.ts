// import { schema } from '@based/schema'
// based.schema.ts

const schema1 = {
  version: '1',
  types: {
    user: {
      firstName: 'string',
      lastName: 'string',
    },
  },
}

const schema2 = {
  version: '1',
  types: {
    user: {
      firstName: 'string',
      lastName: 'string',
      age: 'number',
    },
  },
}

const schema3 = {
  version: '1',
  types: {
    user: {
      firstName: 'string',
      lastName: 'string',
      age: 'uint8',
      email: 'youzi@example.nl',
    },
  },
}

const schema4 = {
  version: '2',
  types: {
    user: {
      fullName: 'string',
      age: 'uint8',
      email: 'youzi@example.nl',
    },
  },
  migrations: [
    {
      version: '<2',
      migrate: {
        user({ firstName, lastName, ...rest }) {
          return {
            fullName: firstName + ' ' + lastName,
            ...rest,
          }
        },
      },
    },
  ],
}

const schema4 = {
  version: '3',
  types: {
    user: {
      name: 'string',
      age: 'uint8',
      email: 'youzi@example.nl',
    },
  },
  migrations: [
    {
      version: '<3',
      migrate: {
        user({ firstName, lastName, fullName, ...rest }) {
          return {
            fullName: fullName || firstName + ' ' + lastName,
            ...rest,
          }
        },
      },
    },
  ],
}
