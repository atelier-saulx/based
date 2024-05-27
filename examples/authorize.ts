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
                  enum: ['owner', 'developer', 'viewer'],
                },
              },
            },
          },
          inverseProperty: 'memberOf',
        },
        fileFolders: {
          // RECON
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

    user: {
      properties: {
        memberOf: {
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
  .language('en')
  .properties('id', 'abstract', 'body') // props
  .excludeProperties('id', 'abstract', 'body') // excludeProps
  .where('published')
  .is(true)
  .and('publishDate')
  .gt('now-1w')

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

db.query(folderId)
  // value is on the edge

  //

  .select(`org.members[email:beerdejim@gmail.com].@roles`)
  .has(['owner', 'developer'])
  .select()

  // .filter(`org.members.@${userId}.roles`, 'has', ['owner', 'developer'])
  .boolean()
// .is(1)

// maybe do testrunner style assertions?

// OR
db.query('userIdA.memberOf')
  // TODO what do we do for iteration variables?
  .filter('fileFolders.fileFolderIdA.@{%}.roles', 'has', ['owner', 'developer'])
  .boolean()

export {}
