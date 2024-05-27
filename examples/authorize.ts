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
// userId, fileFolderId, => fileId

db.query('fileFolderIdA')
  // value is on the edge
  .filter('org.members.@userIdB.roles', 'has', ['owner', 'developer'])
  .boolean()

// OR
db.query('userIdA.memberOf')
  // TODO what do we do for iteration variables?
  .filter('fileFolders.fileFolderIdA.@{%}.roles', 'has', ['owner', 'developer'])
  .boolean()

export {}
