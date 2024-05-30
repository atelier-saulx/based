/*

*/

const schema = {
  types: {
    org: {
      // DUBAI POLICE
      properties: {
        members: {
          type: 'user',
          list: true,
          edge: {
            properties: {
              roles: {
                type: 'set',
                required: true,
                items: {
                  enum: ['owner', 'developer', 'viewer', 'clown'],
                },
              },
            },
          },
          inverseProperty: 'memberOf',
        },
        fileFolders: {
          type: 'fileFolder',
          list: true,
          inverseProperty: 'org',
        },
      },
    },

    fileFolder: {
      properties: {
        org: {
          type: 'org',
          inverseProperty: 'fileFolders',
        },
        files: {
          type: 'file',
          inverseProperty: 'fileFolders',
        },
      },
    },

    landing: {
      unique: true,
      properties: {
        powerRooms: { type: 'room', list: true },
      },
    },

    room: {
      properties: {
        messages: {
          type: 'msg',
          list: true,
          inverseProperty: 'room',
        },
        org: { type: 'org', dependant: true },
        members: {
          type: 'user',
          list: true,
          inverseProperty: 'rooms',
        },
      },
    },

    msg: {
      properties: {
        text: { type: 'string' },
        user: { type: 'user' },
        room: {
          type: 'room',
          inverseProperty: 'messages',
          dependant: true,
        },
      },
    },

    user: {
      properties: {
        rooms: {
          type: 'room',
          list: true,
          inverseProperty: 'members',
        },
        memberOf: {
          requiredRelationship: true,
          type: 'org',
          inverseProperty: 'members',
        },
      },
    },

    file: {
      properties: {
        fileFolders: {
          type: 'fileFolder',
          list: true,
          inverseProperty: 'files',
        },
      },
    },
  },
}

const db: any = {}
// file upload user upload file, and puts it in fileFolder (cool images)
// userIdB, fileFolderIdA, => fileId
const userId = 'us1'
const folderId = 'fo1'

db.query('article')
  .include('abstract.en', 'body') // props
  .exclude('id') // excludeProps
  .filter('published')

// ['published']

/*
{
  id: 'a',
  abstract: '42987fdsuof',
  body: 'success'
}
*/

db.query('user[email:beerdejim@gmail.com]').set({
  status: 2,
})

// db.update('user[email:beerdejim@gmail.com]', {})

db.query('article[friendlyUrl:world-politics]')

db.query('fo123')
  .filter(`org.members[email:beerdejim@gmail.com].@roles`, 'has', [
    'owner',
    'developer',
  ])
  .boolean()

// maybe do testrunner style assertions?

// OR
db.query('userIdA.memberOf')
  // TODO what do we do for iteration variables?
  .filter('fileFolders[id:fileFolderIdA].@roles', 'has', ['owner', 'developer'])
  .boolean()

export {}
