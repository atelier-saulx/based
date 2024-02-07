import { BasedOldSchema } from '../../src/compat/oldSchemaType.js'

export const oldSchemas: BasedOldSchema[] = [
  {
    languages: ['en', 'nl'],
    prefixToTypeMapping: {},
    rootType: {
      fields: {},
    },
    types: {
      thing1: {
        meta: {
          name: 'name',
          description: 'bla',
        },
        prefix: 'ti',
        fields: {
          number: {
            type: 'number',
          },
          object: {
            type: 'object',
            properties: {
              objectNumber: {
                type: 'number',
                meta: {
                  name: 'name',
                },
              },
            },
          },
        },
      },
    },
  },
  {
    languages: ['en', 'nl', 'de'],
    rootType: {
      prefix: 'ro',
      fields: {
        createdAt: {
          type: 'timestamp',
        },
        type: {
          type: 'string',
        },
        id: {
          type: 'id',
        },
        updatedAt: {
          type: 'timestamp',
        },
        children: {
          type: 'references',
        },
        descendants: {
          type: 'references',
        },
      },
    },
    prefixToTypeMapping: {
      ai: 'airhubIcon',
      do: 'document',
      co: 'contact',
      ei: 'executedChecklistItem',
      ci: 'checklistItem',
      ac: 'activity',
      ba: 'battery',
      aa: 'apiAccess',
      ce: 'certificate',
      ec: 'executedChecklist',
      fa: 'flightApproval',
      ss: 'subscription',
      tr: 'training',
      me: 'media',
      ni: 'nonUserInvite',
      mc: 'maintenanceCompletion',
      om: 'organizationMember',
      po: 'pointOfInterest',
      lm: 'liveSessionMessage',
      fi: 'file',
      fo: 'incidentFollowUp',
      tc: 'trainingCompletion',
      ta: 'tag',
      dr: 'drone',
      er: 'error',
      ft: 'flightTemplate',
      ct: 'capabilitiesTemplate',
      ch: 'checklist',
      cf: 'config',
      rt: 'refreshToken',
      or: 'organization',
      wm: 'waypointMission',
      ph: 'photo',
      gs: 'groundStation',
      rl: 'role',
      li: 'liveSession',
      eq: 'equipment',
      tq: 'trainingCompletionRequest',
      vs: 'videoStream',
      in: 'incident',
      ll: 'liveSessionLink',
      no: 'notification',
      us: 'user',
      ma: 'maintenance',
      ls: 'liveStream',
      pt: 'pushToken',
      fl: 'flight',
    },
    types: {
      activity: {
        prefix: 'ac',
        fields: {
          ancestors: {
            type: 'references',
          },
          initiator: {
            type: 'reference',
          },
          id: {
            type: 'id',
          },
          performedAt: {
            type: 'timestamp',
          },
          createdAt: {
            type: 'timestamp',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          updatedAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          actionType: {
            type: 'string',
          },
          children: {
            type: 'references',
          },
          params: {
            type: 'json',
          },
        },
      },
      pushToken: {
        prefix: 'pt',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          token: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      liveStream: {
        prefix: 'ls',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          finishedAt: {
            type: 'timestamp',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
      flightTemplate: {
        prefix: 'ft',
        fields: {
          note: {
            type: 'string',
          },
          payloadOperators: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
          permissionForm: {
            properties: {
              signature: {
                type: 'reference',
              },
              firstName: {
                type: 'string',
              },
              lastName: {
                type: 'string',
              },
              reason: {
                type: 'string',
              },
            },
            type: 'object',
          },
          pilot: {
            type: 'reference',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          pointsOfInterest: {
            items: {
              properties: {
                color: {
                  type: 'string',
                },
                location: {
                  properties: {
                    lon: {
                      type: 'number',
                    },
                    lat: {
                      type: 'number',
                    },
                  },
                  type: 'object',
                },
                icon: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
              },
              type: 'object',
            },
            type: 'array',
          },
          createdAt: {
            type: 'timestamp',
          },
          riskAnalysis: {
            items: {
              type: 'object',
              properties: {
                probabilityAfterMeasure: {
                  type: 'int',
                },
                description: {
                  type: 'string',
                },
                severityAfterMeasure: {
                  type: 'int',
                },
                severity: {
                  type: 'int',
                },
                title: {
                  type: 'string',
                },
                measure: {
                  type: 'string',
                },
                probability: {
                  type: 'int',
                },
              },
            },
            type: 'array',
          },
          flightHeight: {
            type: 'number',
          },
          losType: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          geofence: {
            type: 'json',
          },
          type: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          drone: {
            type: 'reference',
          },
          endTime: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          takeOffTime: {
            type: 'timestamp',
          },
          batteries: {
            type: 'references',
          },
          equipment: {
            type: 'references',
          },
          observers: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          location: {
            properties: {
              lon: {
                type: 'number',
              },
              lat: {
                type: 'number',
              },
            },
            type: 'object',
          },
          flightType: {
            type: 'string',
          },
          groundStation: {
            type: 'reference',
          },
          mission: {
            type: 'reference',
          },
        },
      },
      organizationMember: {
        prefix: 'om',
        fields: {
          type: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          descendants: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          status: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          archived: {
            type: 'boolean',
          },
          roles: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      role: {
        prefix: 'rl',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
      airhubIcon: {
        prefix: 'ai',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          type: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          file: {
            type: 'reference',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      liveSessionLink: {
        prefix: 'll',
        fields: {
          type: {
            type: 'string',
          },
          disabled: {
            type: 'boolean',
          },
          expiresAt: {
            type: 'timestamp',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          features: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          parents: {
            type: 'references',
          },
          ipWhitelist: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          children: {
            type: 'references',
          },
          accessCode: {
            type: 'string',
          },
        },
      },
      pointOfInterest: {
        prefix: 'po',
        fields: {
          type: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          children: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          location: {
            properties: {
              lon: {
                type: 'number',
              },
              lat: {
                type: 'number',
              },
            },
            type: 'object',
          },
          updatedAt: {
            type: 'timestamp',
          },
          icon: {
            type: 'reference',
          },
          color: {
            type: 'string',
          },
        },
      },
      drone: {
        prefix: 'dr',
        fields: {
          avatar: {
            type: 'reference',
          },
          color: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          weight: {
            type: 'number',
          },
          status: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          markings: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          registration: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          isLiveStreamPrivate: {
            type: 'boolean',
          },
          createdAt: {
            type: 'timestamp',
          },
          model: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          firmwareVersion: {
            type: 'string',
          },
          archived: {
            type: 'boolean',
          },
          manufacturer: {
            type: 'string',
          },
          serial: {
            type: 'string',
          },
          airFrame: {
            type: 'string',
          },
        },
      },
      subscription: {
        prefix: 'ss',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          name: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          endsAt: {
            type: 'timestamp',
          },
          createdAt: {
            type: 'timestamp',
          },
          startedAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      videoStream: {
        prefix: 'vs',
        fields: {
          masterService: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          cameras: {
            items: {
              type: 'object',
              properties: {
                webrtcHubPortId: {
                  type: 'string',
                },
                port: {
                  type: 'number',
                },
                rtpId: {
                  type: 'string',
                },
                ip: {
                  type: 'string',
                },
              },
            },
            type: 'array',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          masterTick: {
            type: 'number',
          },
          createdAt: {
            type: 'timestamp',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          finished: {
            type: 'boolean',
          },
          id: {
            type: 'id',
          },
          externalId: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          flowing: {
            type: 'boolean',
          },
          type: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          videoStreamType: {
            type: 'string',
          },
        },
      },
      file: {
        meta: {
          name: 'File',
          description:
            'System file type, used to store and reference static files',
        },
        fields: {
          description: {
            meta: {
              index: 7,
              name: 'Description',
            },
            type: 'text',
          },
          origin: {
            meta: {
              // validation: 'url',
              description: 'Original file',
              name: 'Origin',
            },
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          dashManifest: {
            meta: {
              index: 14,
              name: 'DASH',
            },
            type: 'url',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          videoPreview: {
            meta: {
              index: 15,
              name: 'Video preview',
            },
            type: 'url',
          },
          status: {
            meta: {
              index: 11,
              name: 'Status',
            },
            type: 'number',
          },
          updatedAt: {
            meta: {
              index: 9,
              name: 'Updated at',
            },
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          size: {
            meta: {
              format: 'bytes',
            },
            type: 'number',
          },
          type: {
            type: 'string',
          },
          id: {
            meta: {
              index: 5,
            },
            type: 'id',
          },
          progress: {
            type: 'number',
          },
          ancestors: {
            type: 'references',
          },
          src: {
            meta: {
              description: 'Transformed source of the file',
              name: 'Source',
              // validation: 'url',
            },
            type: 'string',
          },
          version: {
            meta: {
              index: 8,
              name: 'Version',
            },
            type: 'string',
          },
          mimeType: {
            meta: {
              index: 2,
              name: 'Mime',
            },
            type: 'string',
          },
          name: {
            meta: {
              index: 1,
            },
            type: 'string',
          },
          thumb: {
            meta: {
              // format: 'bytes',
              index: 10,
              name: 'Thumbnail',
            },
            type: 'url',
          },
          hlsManifest: {
            meta: {
              index: 13,
              name: 'HLS',
            },
            type: 'url',
          },
          statusText: {
            meta: {
              index: 12,
              name: 'Status text',
            },
            type: 'string',
          },
          createdAt: {
            meta: {
              name: 'Created at',
              index: 3,
            },
            type: 'timestamp',
          },
          mime: {
            type: 'string',
          },
        },
        prefix: 'fi',
      },
      organization: {
        prefix: 'or',
        fields: {
          avatar: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          postalCode: {
            type: 'string',
          },
          phone: {
            type: 'phone',
          },
          country: {
            type: 'string',
          },
          about: {
            type: 'string',
          },
          email: {
            type: 'email',
          },
          name: {
            type: 'string',
          },
          website: {
            type: 'url',
          },
          governmentRegistration: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          descendants: {
            type: 'references',
          },
          branch: {
            type: 'string',
          },
        },
      },
      document: {
        prefix: 'do',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          internal: {
            type: 'boolean',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          file: {
            type: 'reference',
          },
          children: {
            type: 'references',
          },
          expirationDate: {
            type: 'timestamp',
          },
        },
      },
      photo: {
        prefix: 'ph',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          type: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          file: {
            type: 'reference',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      training: {
        prefix: 'tr',
        fields: {
          description: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          category: {
            type: 'string',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          recurring: {
            type: 'boolean',
          },
          id: {
            type: 'id',
          },
          createdBy: {
            type: 'reference',
          },
          descendants: {
            type: 'references',
          },
          attachments: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          roles: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          name: {
            type: 'string',
          },
          organization: {
            type: 'reference',
          },
          frequency: {
            type: 'int',
          },
        },
      },
      liveSessionMessage: {
        prefix: 'lm',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          text: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          file: {
            type: 'reference',
          },
          children: {
            type: 'references',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      refreshToken: {
        prefix: 'rt',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          name: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          token: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          expiresAt: {
            type: 'timestamp',
          },
        },
      },
      apiAccess: {
        prefix: 'aa',
        fields: {
          ancestors: {
            type: 'references',
          },
          expiresAt: {
            type: 'timestamp',
          },
          id: {
            type: 'id',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          features: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          token: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          revoked: {
            type: 'boolean',
          },
        },
      },
      media: {
        prefix: 'me',
        fields: {
          mediaType: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          location: {
            properties: {
              lon: {
                type: 'number',
              },
              lat: {
                type: 'number',
              },
              alt: {
                type: 'number',
              },
            },
            type: 'object',
          },
          file: {
            type: 'reference',
          },
          attitude: {
            properties: {
              pitch: {
                type: 'number',
              },
              roll: {
                type: 'number',
              },
              yaw: {
                type: 'number',
              },
            },
            type: 'object',
          },
          size: {
            type: 'int',
          },
        },
      },
      battery: {
        prefix: 'ba',
        fields: {
          avatar: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          weight: {
            type: 'number',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          createdAt: {
            type: 'timestamp',
          },
          lastCharged: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          model: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          manufacturer: {
            type: 'string',
          },
          serial: {
            type: 'string',
          },
          firmwareVersion: {
            type: 'string',
          },
        },
      },
      flightApproval: {
        prefix: 'fa',
        fields: {
          externalReviewer: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
          children: {
            type: 'references',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          airspaceController: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          message: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          parents: {
            type: 'references',
          },
          airspaceControllerEmail: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          internalReviewer: {
            type: 'reference',
          },
          internal: {
            type: 'boolean',
          },
        },
      },
      contact: {
        prefix: 'co',
        fields: {
          responded: {
            type: 'boolean',
          },
          initiator: {
            type: 'reference',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          descendants: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          message: {
            type: 'string',
          },
          read: {
            type: 'boolean',
          },
          name: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
      checklist: {
        prefix: 'ch',
        fields: {
          ancestors: {
            type: 'references',
          },
          updatedBy: {
            type: 'reference',
          },
          checklistType: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          type: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          purpose: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      executedChecklist: {
        prefix: 'ec',
        fields: {
          ancestors: {
            type: 'references',
          },
          executedBy: {
            type: 'reference',
          },
          createdAt: {
            type: 'timestamp',
          },
          checklistType: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          name: {
            type: 'string',
          },
          executedAt: {
            type: 'timestamp',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          completed: {
            type: 'boolean',
          },
          descendants: {
            type: 'references',
          },
          purpose: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdFrom: {
            type: 'reference',
          },
        },
      },
      capabilitiesTemplate: {
        prefix: 'ct',
        fields: {
          capabilities: {
            type: 'json',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          public: {
            type: 'boolean',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
      incident: {
        prefix: 'in',
        fields: {
          description: {
            type: 'string',
          },
          incidentType: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          flightPhase: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          reporter: {
            type: 'reference',
          },
          status: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          consequences: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          hazardPreviousCausedAccident: {
            type: 'boolean',
          },
          title: {
            type: 'string',
          },
          reportedAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          proposedMeasures: {
            type: 'string',
          },
          investigator: {
            type: 'string',
          },
        },
      },
      config: {
        prefix: 'cf',
        fields: {
          API_BASE_URL: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          ALTITUDE_ANGEL_CURRENT_TOKEN: {
            properties: {
              accessToken: {
                type: 'string',
              },
              expiredIn: {
                type: 'number',
              },
              issuedAt: {
                type: 'number',
              },
              refreshToken: {
                type: 'string',
              },
            },
            type: 'object',
          },
          STREAMING_SERVER_HOSTNAME: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          STREAMING_SERVER_RTMP_PORT: {
            type: 'int',
          },
          createdAt: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          DASHBOARD_BASE_URL: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          descendants: {
            type: 'references',
          },
        },
      },
      waypointMission: {
        prefix: 'wm',
        fields: {
          ancestors: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          missionType: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          waypoints: {
            items: {
              type: 'object',
              properties: {
                heading: {
                  type: 'number',
                },
                holdingTime: {
                  type: 'int',
                },
                speed: {
                  type: 'number',
                },
                waypointType: {
                  type: 'string',
                },
                location: {
                  type: 'object',
                  properties: {
                    lon: {
                      type: 'number',
                    },
                    lat: {
                      type: 'number',
                    },
                    alt: {
                      type: 'number',
                    },
                  },
                },
              },
            },
            type: 'array',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
        },
      },
      incidentFollowUp: {
        prefix: 'fo',
        fields: {
          ancestors: {
            type: 'references',
          },
          description: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          reporter: {
            type: 'reference',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      maintenanceCompletion: {
        prefix: 'mc',
        fields: {
          ancestors: {
            type: 'references',
          },
          cost: {
            properties: {
              currencyIsoCode: {
                type: 'string',
              },
              amount: {
                type: 'number',
              },
            },
            type: 'object',
          },
          id: {
            type: 'id',
          },
          notes: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          date: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      maintenance: {
        prefix: 'ma',
        fields: {
          assets: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          children: {
            type: 'references',
          },
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          checklists: {
            type: 'references',
          },
          technician: {
            type: 'reference',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          notes: {
            type: 'string',
          },
          location: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          behaviour: {
            properties: {
              timeUsage: {
                type: 'int',
              },
              flightsUsage: {
                type: 'int',
              },
              timeframe: {
                type: 'int',
              },
            },
            type: 'object',
          },
          parents: {
            type: 'references',
          },
        },
      },
      trainingCompletion: {
        prefix: 'tc',
        fields: {
          training: {
            type: 'reference',
          },
          trainee: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          completionRequest: {
            type: 'reference',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          notes: {
            type: 'string',
          },
          level: {
            type: 'int',
          },
          approved: {
            type: 'boolean',
          },
          ancestors: {
            type: 'references',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      user: {
        prefix: 'us',
        fields: {
          current: {
            type: 'boolean',
          },
          avatar: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          flyingRules: {
            properties: {
              flights: {
                type: 'int',
              },
              hours: {
                type: 'int',
              },
              affectsCurrency: {
                type: 'boolean',
              },
              timeFrame: {
                type: 'int',
              },
            },
            type: 'object',
          },
          lastName: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          firstName: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          status: {
            meta: {
              name: 'Status',
              index: 3,
            },
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          lastSessionDate: {
            type: 'timestamp',
          },
          id: {
            meta: {
              index: 4,
            },
            type: 'id',
          },
          fireBasePassword: {
            type: 'string',
          },
          email: {
            meta: {
              name: 'Email',
              index: 2,
            },
            type: 'email',
          },
          password: {
            meta: {
              name: 'Password',
              index: 5,
            },
            type: 'digest',
          },
          name: {
            meta: {
              name: 'Name',
              index: 1,
            },
            type: 'string',
          },
          preferences: {
            properties: {
              theme: {
                type: 'string',
              },
              units: {
                type: 'string',
              },
            },
            type: 'object',
          },
          ancestors: {
            type: 'references',
          },
          fireBaseSalt: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
        },
      },
      notification: {
        prefix: 'no',
        fields: {
          parents: {
            type: 'references',
          },
          asset: {
            type: 'reference',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          notificationTypeStr: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
          sentiment: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          read: {
            type: 'boolean',
          },
          title: {
            type: 'text',
          },
          createdAt: {
            type: 'timestamp',
          },
          body: {
            type: 'text',
          },
          type: {
            type: 'string',
          },
          notificationType: {
            type: 'number',
          },
          name: {
            type: 'string',
          },
        },
      },
      flight: {
        prefix: 'fl',
        fields: {
          note: {
            type: 'string',
          },
          payloadOperators: {
            type: 'references',
          },
          telemetry: {
            meta: {
              name: 'Telemetry',
            },
            type: 'object',
            properties: {
              drcState: {
                type: 'string',
              },
              elevation: {
                meta: {
                  name: 'Elevation',
                },
                type: 'number',
              },
              waypointIndex: {
                type: 'int',
              },
              gimbal: {
                meta: {
                  name: 'Gimbal',
                },
                type: 'object',
                properties: {
                  attitude: {
                    meta: {
                      name: 'Attitude',
                    },
                    type: 'object',
                    properties: {
                      pitch: {
                        meta: {
                          name: 'Pitch',
                        },
                        type: 'number',
                      },
                      roll: {
                        meta: {
                          name: 'Roll',
                        },
                        type: 'number',
                      },
                      yaw: {
                        meta: {
                          name: 'Yaw',
                        },
                        type: 'number',
                      },
                    },
                  },
                },
              },
              batteries: {
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                    },
                    percentage: {
                      type: 'number',
                    },
                  },
                },
                type: 'array',
                meta: {
                  name: 'Batteries',
                },
              },
              homeDistance: {
                meta: {
                  name: 'HomeDistance',
                },
                type: 'number',
              },
              location: {
                meta: {
                  name: 'Location',
                },
                type: 'object',
                properties: {
                  lon: {
                    meta: {
                      name: 'Lon',
                    },
                    type: 'number',
                  },
                  lat: {
                    meta: {
                      name: 'Lat',
                    },
                    type: 'number',
                  },
                  alt: {
                    meta: {
                      name: 'Alt',
                    },
                    type: 'number',
                  },
                },
              },
              speed: {
                meta: {
                  name: 'Speed',
                },
                type: 'object',
                properties: {
                  vertical: {
                    meta: {
                      name: 'Vertical',
                    },
                    type: 'number',
                  },
                  horizontal: {
                    meta: {
                      name: 'Horizontal',
                    },
                    type: 'number',
                  },
                  ned: {
                    properties: {
                      down: {
                        type: 'number',
                      },
                      east: {
                        type: 'number',
                      },
                      north: {
                        type: 'number',
                      },
                    },
                    type: 'object',
                  },
                },
              },
              datetime: {
                meta: {
                  name: 'Datetime',
                },
                type: 'timestamp',
              },
              satellites: {
                meta: {
                  name: 'Satellites',
                },
                type: 'int',
              },
              droneState: {
                type: 'string',
              },
              attitude: {
                meta: {
                  name: 'Attitude',
                },
                type: 'object',
                properties: {
                  pitch: {
                    meta: {
                      name: 'Pitch',
                    },
                    type: 'number',
                  },
                  roll: {
                    meta: {
                      name: 'Roll',
                    },
                    type: 'number',
                  },
                  yaw: {
                    meta: {
                      name: 'Yaw',
                    },
                    type: 'number',
                  },
                },
              },
              flightTaskStep: {
                type: 'string',
              },
            },
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          riskAnalysis: {
            items: {
              type: 'object',
              properties: {
                probabilityAfterMeasure: {
                  type: 'int',
                },
                description: {
                  type: 'string',
                },
                severityAfterMeasure: {
                  type: 'int',
                },
                severity: {
                  type: 'int',
                },
                title: {
                  type: 'string',
                },
                measure: {
                  type: 'string',
                },
                probability: {
                  type: 'int',
                },
              },
            },
            type: 'array',
          },
          regulationSet: {
            properties: {
              airspaceProvider: {
                type: 'string',
              },
              regulations: {
                items: {
                  type: 'object',
                  properties: {
                    details: {
                      items: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          text: {
                            type: 'string',
                          },
                        },
                      },
                      type: 'array',
                    },
                    description: {
                      type: 'string',
                    },
                    title: {
                      type: 'string',
                    },
                  },
                },
                type: 'array',
              },
            },
            type: 'object',
          },
          command: {
            properties: {
              datetime: {
                type: 'timestamp',
              },
              name: {
                type: 'string',
              },
              parameters: {
                type: 'json',
              },
            },
            type: 'object',
          },
          geofence: {
            type: 'json',
          },
          drone: {
            type: 'reference',
          },
          endTime: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          losType: {
            type: 'string',
          },
          mission: {
            type: 'reference',
          },
          flightType: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          permissionForm: {
            properties: {
              firstName: {
                type: 'string',
              },
              signature: {
                type: 'reference',
              },
              lastName: {
                type: 'string',
              },
              reason: {
                type: 'string',
              },
            },
            type: 'object',
          },
          flyzone: {
            items: {
              properties: {
                lon: {
                  type: 'number',
                },
                lat: {
                  type: 'number',
                },
              },
              type: 'object',
            },
            type: 'array',
          },
          pilot: {
            type: 'reference',
          },
          pointsOfInterest: {
            items: {
              properties: {
                color: {
                  type: 'string',
                },
                location: {
                  properties: {
                    lon: {
                      type: 'number',
                    },
                    lat: {
                      type: 'number',
                    },
                  },
                  type: 'object',
                },
                icon: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
              },
              type: 'object',
            },
            type: 'array',
          },
          capabilities: {
            type: 'json',
          },
          type: {
            type: 'string',
          },
          flightHeight: {
            type: 'number',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          status: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          commands: {
            type: 'json',
          },
          draft: {
            type: 'boolean',
          },
          flightTime: {
            type: 'int',
          },
          id: {
            type: 'id',
          },
          takeOffWeather: {
            properties: {
              sunrise: {
                type: 'timestamp',
              },
              gpsAccuracy: {
                type: 'number',
              },
              kpIndex: {
                type: 'int',
              },
              humidity: {
                type: 'number',
              },
              sunset: {
                type: 'timestamp',
              },
              condition: {
                type: 'string',
              },
              cloudCover: {
                type: 'number',
              },
              precipitation: {
                properties: {
                  intensity: {
                    type: 'number',
                  },
                  accumulation: {
                    type: 'number',
                  },
                  probability: {
                    type: 'number',
                  },
                },
                type: 'object',
              },
              pressure: {
                type: 'number',
              },
              time: {
                type: 'timestamp',
              },
              windSpeed: {
                type: 'number',
              },
              temperature: {
                type: 'number',
              },
              windGusting: {
                type: 'number',
              },
              visibility: {
                type: 'number',
              },
              windBearing: {
                type: 'number',
              },
            },
            type: 'object',
          },
          takeOffTime: {
            type: 'timestamp',
          },
          batteries: {
            type: 'references',
          },
          equipment: {
            type: 'references',
          },
          observers: {
            type: 'references',
          },
          approvals: {
            type: 'references',
          },
          batteryCharges: {
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                },
                startPercentage: {
                  type: 'number',
                },
                endPercentage: {
                  type: 'number',
                },
              },
            },
            type: 'array',
          },
          location: {
            properties: {
              lon: {
                type: 'number',
              },
              lat: {
                type: 'number',
              },
            },
            type: 'object',
          },
          ancestors: {
            type: 'references',
          },
          groundStation: {
            type: 'reference',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      executedChecklistItem: {
        prefix: 'ei',
        fields: {
          ancestors: {
            type: 'references',
          },
          description: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          createdAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          title: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          isChecked: {
            type: 'boolean',
          },
          index: {
            type: 'int',
          },
        },
      },
      trainingCompletionRequest: {
        prefix: 'tq',
        fields: {
          training: {
            type: 'reference',
          },
          description: {
            type: 'string',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          id: {
            type: 'id',
          },
          ancestors: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          attachments: {
            type: 'references',
          },
          reviewed: {
            type: 'boolean',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdBy: {
            type: 'reference',
          },
        },
      },
      equipment: {
        prefix: 'eq',
        fields: {
          avatar: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          purchasedAt: {
            type: 'timestamp',
          },
          descendants: {
            type: 'references',
          },
          weight: {
            type: 'number',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          ancestors: {
            type: 'references',
          },
          serialNumber: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          hardwareVersion: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          type: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          model: {
            type: 'string',
          },
          isLiveStreamPrivate: {
            type: 'boolean',
          },
          status: {
            type: 'string',
          },
          firmwareVersion: {
            type: 'string',
          },
          manufacturer: {
            type: 'string',
          },
        },
      },
      checklistItem: {
        prefix: 'ci',
        fields: {
          ancestors: {
            type: 'references',
          },
          index: {
            type: 'int',
          },
          id: {
            type: 'id',
          },
          type: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            type: 'timestamp',
          },
          title: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          description: {
            type: 'string',
          },
        },
      },
      liveSession: {
        prefix: 'li',
        fields: {
          ancestors: {
            type: 'references',
          },
          description: {
            type: 'string',
          },
          avatar: {
            type: 'reference',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          createdAt: {
            type: 'timestamp',
          },
          name: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          parents: {
            type: 'references',
          },
        },
      },
      nonUserInvite: {
        prefix: 'ni',
        fields: {
          type: {
            type: 'string',
          },
          id: {
            type: 'id',
          },
          invitedBy: {
            type: 'reference',
          },
          ancestors: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
          token: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          roles: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          email: {
            type: 'email',
          },
        },
      },
      error: {
        prefix: 'er',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          type: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          message: {
            type: 'text',
          },
          read: {
            type: 'boolean',
          },
          name: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          dismissed: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
      certificate: {
        prefix: 'ce',
        fields: {
          certificateType: {
            type: 'string',
          },
          expirationDate: {
            type: 'timestamp',
          },
          id: {
            type: 'id',
          },
          descendants: {
            type: 'references',
          },
          children: {
            type: 'references',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          updatedAt: {
            type: 'timestamp',
          },
          createdAt: {
            type: 'timestamp',
          },
          affectsCurrency: {
            type: 'boolean',
          },
          type: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          file: {
            type: 'reference',
          },
          documentNumber: {
            type: 'string',
          },
          ancestors: {
            type: 'references',
          },
        },
      },
      groundStation: {
        prefix: 'gs',
        fields: {
          avatar: {
            type: 'reference',
          },
          parents: {
            type: 'references',
          },
          streamingConfig: {
            properties: {
              address: {
                type: 'string',
              },
            },
            type: 'object',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          manufacturer: {
            type: 'string',
          },
          descendants: {
            type: 'references',
          },
          platformType: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          archived: {
            type: 'boolean',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          geofence: {
            type: 'json',
          },
          drones: {
            type: 'references',
          },
          ancestors: {
            type: 'references',
          },
          capabilities: {
            type: 'json',
          },
          groundStationCoverState: {
            type: 'int',
          },
          id: {
            type: 'id',
          },
          name: {
            type: 'string',
          },
          online: {
            type: 'boolean',
          },
          credentials: {
            properties: {
              password: {
                type: 'string',
              },
              username: {
                type: 'string',
              },
              address: {
                type: 'string',
              },
            },
            type: 'object',
          },
          createdAt: {
            type: 'timestamp',
          },
          groundStationState: {
            type: 'int',
          },
          droneInDockState: {
            type: 'int',
          },
          model: {
            type: 'string',
          },
          location: {
            properties: {
              lon: {
                type: 'number',
              },
              lat: {
                type: 'number',
              },
              alt: {
                type: 'number',
              },
            },
            type: 'object',
          },
          type: {
            type: 'string',
          },
          serial: {
            type: 'string',
          },
          remoteId: {
            type: 'string',
          },
        },
      },
      tag: {
        prefix: 'ta',
        fields: {
          ancestors: {
            type: 'references',
          },
          id: {
            type: 'id',
          },
          aliases: {
            items: {
              type: 'string',
            },
            type: 'set',
          },
          descendants: {
            type: 'references',
          },
          name: {
            type: 'string',
          },
          parents: {
            type: 'references',
          },
          type: {
            type: 'string',
          },
          updatedAt: {
            type: 'timestamp',
          },
          children: {
            type: 'references',
          },
          createdAt: {
            type: 'timestamp',
          },
        },
      },
    },
  },
  //@ts-ignore
  {
    rootType: {
      fields: {},
    },
    prefixToTypeMapping: {},
    languages: [
      'en',
      'de',
      'es',
      'fr',
      'nl',
      'ru',
      'sr',
      'pl',
      'da',
      'pt',
      'sv',
      'cs',
    ],
    types: {
      edition: {
        prefix: 'ed',
        fields: {
          comments: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              nameText: { type: 'text' },
              emailText: { type: 'text' },
              messageText: { type: 'text' },
              button: { type: 'text' },
            },
          },
          redirect: {
            type: 'object',
            properties: { enabled: { type: 'boolean' }, url: { type: 'url' } },
          },
          votePerShow: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          tracking: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          allowMultiple: {
            type: 'object',
            properties: { enabled: { type: 'boolean' }, max: { type: 'int' } },
          },
          requireAuth: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          requirePayment: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              buttonNext: { type: 'text' },
              buttonTryAgain: { type: 'text' },
              buttonSubmit: { type: 'text' },
              errorMessage: { type: 'text' },
              invalidCountryMessage: { type: 'text' },
              countryNotInListMessage: { type: 'text' },
              disclaimer: { type: 'text' },
              price: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          requireEmailVerification: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              button: { type: 'text' },
              placeholder: { type: 'text' },
              optInEmail: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
              completed: {
                type: 'object',
                properties: {
                  label: { type: 'text' },
                  title: { type: 'text' },
                  body: { type: 'text' },
                },
              },
              email: {
                type: 'object',
                properties: {
                  title: { type: 'text' },
                  subject: { type: 'text' },
                  body: { type: 'text' },
                  footer: { type: 'text' },
                  buttonText: { type: 'text' },
                  from: { type: 'string' },
                  logo: { type: 'url' },
                },
              },
            },
          },
          name: { type: 'string' },
          languages: { type: 'set', items: { type: 'string' } },
          defaultLanguage: { type: 'string' },
          sharing: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              image: { type: 'url' },
              sharingText: { type: 'text' },
              copyLinkText: { type: 'text' },
              emailText: { type: 'text' },
              socialMediaText: { type: 'text' },
              moreOptionsText: { type: 'text' },
              options: {
                type: 'object',
                properties: {
                  whatsapp: { type: 'boolean' },
                  twitter: { type: 'boolean' },
                  email: { type: 'boolean' },
                  facebook: { type: 'boolean' },
                  telegram: { type: 'boolean' },
                  url: { type: 'boolean' },
                },
              },
            },
          },
          htmlHead: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              value: { type: 'string' },
            },
          },
          htmlBody: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              value: { type: 'string' },
            },
          },
          video: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              image: { type: 'url' },
              url: { type: 'url' },
            },
          },
          footer: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              items: {
                type: 'record',
                values: {
                  type: 'object',
                  properties: { text: { type: 'text' }, url: { type: 'url' } },
                },
              },
            },
          },
          logo: { type: 'url' },
          updatedAt: { type: 'timestamp' },
          meta: {
            type: 'object',
            properties: {
              favicon: { type: 'url' },
              title: { type: 'text' },
              description: { type: 'text' },
            },
          },
          logoLink: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              logoUrl: { type: 'url' },
            },
          },
          brand: {
            type: 'object',
            properties: {
              background: { type: 'string' },
              logo: { type: 'url' },
              image: { type: 'url' },
              imageMobile: { type: 'url' },
              logoHeight: { type: 'number' },
              logoHeightMobile: { type: 'number' },
            },
          },
          colors: {
            type: 'object',
            properties: {
              primary: { type: 'string' },
              secondary: { type: 'string' },
              accent: { type: 'string' },
              background: { type: 'string' },
              border: { type: 'string' },
              error: { type: 'string' },
              buttonText: { type: 'string' },
              button: { type: 'string' },
            },
          },
          borderWidth: { type: 'number' },
          corners: {
            type: 'object',
            properties: {
              primary: { type: 'number' },
              secondary: { type: 'number' },
              tertiary: { type: 'number' },
            },
          },
          font: { type: 'reference' },
          fontScales: {
            type: 'object',
            properties: { title: { type: 'number' } },
          },
          iframe: {
            type: 'object',
            properties: {
              minWidth: { type: 'number' },
              minHeight: { type: 'number' },
              tooSmallScreen: {
                type: 'object',
                properties: {
                  labelText: { type: 'text' },
                  titleText: { type: 'text' },
                  bodyText: { type: 'text' },
                  buttonText: { type: 'text' },
                },
              },
            },
          },
          layer2: {
            type: 'object',
            properties: {
              live: { type: 'boolean' },
              play: { type: 'boolean' },
              active: { type: 'string' },
              sorted: { type: 'array', items: { type: 'string' } },
              artboards: { type: 'record', values: { type: 'json' } },
            },
          },
          layer: {
            type: 'object',
            properties: {
              activePage: { type: 'reference' },
              footer: { type: 'text' },
              limit: { type: 'int' },
              barSize: { type: 'int' },
              mapSettings: {
                type: 'object',
                properties: {
                  colorBuckets: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      buckets: { type: 'json' },
                    },
                  },
                  lineWidth: { type: 'int' },
                  size: { type: 'int' },
                  fontSize: { type: 'int' },
                  x: { type: 'string' },
                  y: { type: 'string' },
                  sizeMultiplier: { type: 'number' },
                  activeMinColor: { type: 'string' },
                  activeMaxColor: { type: 'string' },
                  inactiveColor: { type: 'string' },
                  lineColor: { type: 'string' },
                  textColor: { type: 'string' },
                  textTemplate: { type: 'string' },
                },
              },
              displayName: { type: 'string' },
              displayValue: { type: 'string' },
              layout: { type: 'string' },
              sort: { type: 'string' },
              brand: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  image: { type: 'url' },
                },
              },
              colors: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  primary: { type: 'string' },
                  accent: { type: 'string' },
                },
              },
              font: { type: 'reference' },
              sizes: {
                type: 'object',
                properties: { w: { type: 'string' }, h: { type: 'string' } },
              },
              positions: {
                type: 'object',
                properties: { x: { type: 'string' }, y: { type: 'string' } },
              },
              css: { type: 'record', values: { type: 'json' } },
            },
          },
        },
      },
      font: {
        prefix: 'ft',
        fields: {
          name: { type: 'string' },
          regular: { type: 'url' },
          bold: { type: 'url' },
          light: { type: 'url' },
        },
      },
      live: {
        prefix: 'li',
        fields: {
          modifiedAt: { type: 'timestamp' },
          comments: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              nameText: { type: 'text' },
              emailText: { type: 'text' },
              messageText: { type: 'text' },
              button: { type: 'text' },
            },
          },
          redirect: {
            type: 'object',
            properties: { enabled: { type: 'boolean' }, url: { type: 'url' } },
          },
          votePerShow: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          tracking: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          allowMultiple: {
            type: 'object',
            properties: { enabled: { type: 'boolean' }, max: { type: 'int' } },
          },
          requireAuth: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          requirePayment: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              buttonNext: { type: 'text' },
              buttonTryAgain: { type: 'text' },
              buttonSubmit: { type: 'text' },
              errorMessage: { type: 'text' },
              invalidCountryMessage: { type: 'text' },
              countryNotInListMessage: { type: 'text' },
              disclaimer: { type: 'text' },
              price: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          requireEmailVerification: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              button: { type: 'text' },
              placeholder: { type: 'text' },
              optInEmail: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
              completed: {
                type: 'object',
                properties: {
                  label: { type: 'text' },
                  title: { type: 'text' },
                  body: { type: 'text' },
                },
              },
              email: {
                type: 'object',
                properties: {
                  title: { type: 'text' },
                  subject: { type: 'text' },
                  body: { type: 'text' },
                  footer: { type: 'text' },
                  buttonText: { type: 'text' },
                  from: { type: 'string' },
                  logo: { type: 'url' },
                },
              },
            },
          },
          name: { type: 'string' },
          languages: { type: 'set', items: { type: 'string' } },
          defaultLanguage: { type: 'string' },
          sharing: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              description: { type: 'text' },
              image: { type: 'url' },
              sharingText: { type: 'text' },
              copyLinkText: { type: 'text' },
              emailText: { type: 'text' },
              socialMediaText: { type: 'text' },
              moreOptionsText: { type: 'text' },
              options: {
                type: 'object',
                properties: {
                  whatsapp: { type: 'boolean' },
                  twitter: { type: 'boolean' },
                  email: { type: 'boolean' },
                  facebook: { type: 'boolean' },
                  telegram: { type: 'boolean' },
                  url: { type: 'boolean' },
                },
              },
            },
          },
          htmlHead: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              value: { type: 'string' },
            },
          },
          htmlBody: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              value: { type: 'string' },
            },
          },
          video: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              image: { type: 'url' },
              url: { type: 'url' },
            },
          },
          footer: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              items: {
                type: 'record',
                values: {
                  type: 'object',
                  properties: { text: { type: 'text' }, url: { type: 'url' } },
                },
              },
            },
          },
          logo: { type: 'url' },
          updatedAt: { type: 'timestamp' },
          meta: {
            type: 'object',
            properties: {
              favicon: { type: 'url' },
              title: { type: 'text' },
              description: { type: 'text' },
            },
          },
          logoLink: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              logoUrl: { type: 'url' },
            },
          },
          brand: {
            type: 'object',
            properties: {
              background: { type: 'string' },
              logo: { type: 'url' },
              image: { type: 'url' },
              imageMobile: { type: 'url' },
              logoHeight: { type: 'number' },
              logoHeightMobile: { type: 'number' },
            },
          },
          colors: {
            type: 'object',
            properties: {
              primary: { type: 'string' },
              secondary: { type: 'string' },
              accent: { type: 'string' },
              background: { type: 'string' },
              border: { type: 'string' },
              error: { type: 'string' },
              buttonText: { type: 'string' },
              button: { type: 'string' },
            },
          },
          borderWidth: { type: 'number' },
          corners: {
            type: 'object',
            properties: {
              primary: { type: 'number' },
              secondary: { type: 'number' },
              tertiary: { type: 'number' },
            },
          },
          font: { type: 'reference' },
          fontScales: {
            type: 'object',
            properties: { title: { type: 'number' } },
          },
          iframe: {
            type: 'object',
            properties: {
              minWidth: { type: 'number' },
              minHeight: { type: 'number' },
              tooSmallScreen: {
                type: 'object',
                properties: {
                  labelText: { type: 'text' },
                  titleText: { type: 'text' },
                  bodyText: { type: 'text' },
                  buttonText: { type: 'text' },
                },
              },
            },
          },
          layer2: {
            type: 'object',
            properties: {
              live: { type: 'boolean' },
              play: { type: 'boolean' },
              active: { type: 'string' },
              sorted: { type: 'array', items: { type: 'string' } },
              artboards: { type: 'record', values: { type: 'json' } },
            },
          },
          layer: {
            type: 'object',
            properties: {
              activePage: { type: 'reference' },
              footer: { type: 'text' },
              limit: { type: 'int' },
              barSize: { type: 'int' },
              mapSettings: {
                type: 'object',
                properties: {
                  colorBuckets: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      buckets: { type: 'json' },
                    },
                  },
                  lineWidth: { type: 'int' },
                  size: { type: 'int' },
                  fontSize: { type: 'int' },
                  x: { type: 'string' },
                  y: { type: 'string' },
                  sizeMultiplier: { type: 'number' },
                  activeMinColor: { type: 'string' },
                  activeMaxColor: { type: 'string' },
                  inactiveColor: { type: 'string' },
                  lineColor: { type: 'string' },
                  textColor: { type: 'string' },
                  textTemplate: { type: 'string' },
                },
              },
              displayName: { type: 'string' },
              displayValue: { type: 'string' },
              layout: { type: 'string' },
              sort: { type: 'string' },
              brand: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  image: { type: 'url' },
                },
              },
              colors: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  primary: { type: 'string' },
                  accent: { type: 'string' },
                },
              },
              font: { type: 'reference' },
              sizes: {
                type: 'object',
                properties: { w: { type: 'string' }, h: { type: 'string' } },
              },
              positions: {
                type: 'object',
                properties: { x: { type: 'string' }, y: { type: 'string' } },
              },
              css: { type: 'record', values: { type: 'json' } },
            },
          },
        },
      },
      organization: { prefix: 'or', fields: { name: { type: 'string' } } },
      sequence: {
        prefix: 'se',
        fields: {
          name: { type: 'string' },
          ref: { type: 'reference' },
          editable: { type: 'boolean' },
          index: { type: 'int' },
          startTime: { type: 'timestamp' },
        },
      },
      show: {
        prefix: 'sh',
        fields: {
          name: { type: 'string' },
          logo: { type: 'url' },
          updatedAt: { type: 'timestamp' },
        },
      },
      user: {
        prefix: 'us',
        fields: {
          name: { type: 'string' },
          status: { type: 'string' },
          email: { type: 'email' },
          password: { type: 'digest' },
          language: { type: 'string' },
          content: { type: 'set', items: { type: 'string' } },
          avatar: { type: 'url' },
        },
      },
      userGroup: { prefix: 'ug', fields: { name: { type: 'string' } } },
      pageAuthScreen: {
        prefix: 'au',
        fields: {
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          link: { type: 'string' },
          getToken: { type: 'string' },
          verifyToken: { type: 'string' },
          placeOnTop: { type: 'boolean' },
          selectRandomMedia: { type: 'boolean' },
          countdown: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              centered: { type: 'boolean' },
              startTime: { type: 'timestamp' },
              daysText: { type: 'text' },
              hoursText: { type: 'text' },
              minutesText: { type: 'text' },
            },
          },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
        },
      },
      pageCaptchaScreen: {
        prefix: 'ca',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          placeholder: { type: 'text' },
          button: { type: 'text' },
          errorText: { type: 'text' },
          captchaType: { type: 'string' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          audioCaptcha: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
        },
      },
      pageCommentScreen: {
        prefix: 'cm',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          maxLength: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          includeName: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              required: { type: 'boolean' },
              placeholder: { type: 'text' },
            },
          },
          includeEmail: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              required: { type: 'boolean' },
              placeholder: { type: 'text' },
            },
          },
          includePhone: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              required: { type: 'boolean' },
              placeholder: { type: 'text' },
            },
          },
          placeholder: { type: 'text' },
        },
      },
      pageContentScreen: {
        prefix: 'co',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          placeOnTop: { type: 'boolean' },
          selectRandomMedia: { type: 'boolean' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          countdown: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              centered: { type: 'boolean' },
              startTime: { type: 'timestamp' },
              daysText: { type: 'text' },
              hoursText: { type: 'text' },
              minutesText: { type: 'text' },
            },
          },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
        },
      },
      pageCorrectAnswer: {
        prefix: 'cn',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          button: { type: 'text' },
          pageRef: { type: 'reference' },
          yourAnswerText: { type: 'text' },
          correctAnswerText: { type: 'text' },
          youDidntVoteText: { type: 'text' },
          incorrectText: { type: 'text' },
          correctText: { type: 'text' },
          bottomText: { type: 'text' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          showAudienceResults: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              type: { type: 'string' },
            },
          },
          showScore: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
        },
      },
      pageDataForm: {
        prefix: 'fx',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          formFields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'text' },
                body: { type: 'text' },
                wrong: { type: 'text' },
                required: { type: 'boolean' },
                fieldType: { type: 'string' },
                fieldId: { type: 'string' },
                genderMale: { type: 'text' },
                genderFemale: { type: 'text' },
                age: { type: 'text' },
                regex: { type: 'string' },
                checkbox: { type: 'boolean' },
              },
            },
          },
          customFields: { type: 'set', items: { type: 'string' } },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
        },
      },
      pageIQScreen: {
        prefix: 'iq',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          placeOnTop: { type: 'boolean' },
          selectRandomMedia: { type: 'boolean' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      pageMapScreen: {
        prefix: 'ma',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      pageMultipleChoice: {
        prefix: 'mc',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          itemSettings: {
            type: 'object',
            properties: {
              viewText: { type: 'text' },
              buttonText: { type: 'text' },
              backText: { type: 'text' },
            },
          },
          imageFit: { type: 'string' },
          layout: { type: 'string' },
          layoutDesktop: { type: 'string' },
          bottomText: { type: 'text' },
          allowMultiple: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              min: { type: 'int' },
              max: { type: 'int' },
              allAnswersMustBeCorrect: { type: 'boolean' },
              maxPerItem: { type: 'int' },
            },
          },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
          skipSubmitted: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          quiz: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  duration: { type: 'int' },
                  buffer: { type: 'int' },
                },
              },
              requiresCorrectAnswer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          segmentations: { type: 'references' },
          layer: { type: 'object', properties: { limit: { type: 'int' } } },
        },
      },
      itemMultipleChoice: {
        prefix: 'im',
        fields: {
          title: { type: 'text' },
          body: { type: 'text' },
          index: { type: 'int' },
          ref: { type: 'reference' },
          correct: { type: 'boolean' },
          points: { type: 'int' },
          image: { type: 'string' },
          popup: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              title: { type: 'text' },
              body: { type: 'text' },
              media: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    src: { type: 'url' },
                    poster: { type: 'url' },
                    fullscreen: { type: 'boolean' },
                    autoplay: { type: 'boolean' },
                    loop: { type: 'boolean' },
                    required: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                        text: { type: 'text' },
                      },
                    },
                  },
                },
              },
              share: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  title: { type: 'text' },
                  body: { type: 'text' },
                  image: { type: 'string' },
                },
              },
            },
          },
        },
      },
      pageOpenQuestion: {
        prefix: 'op',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          placeholder: { type: 'text' },
          button: { type: 'text' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                points: { type: 'int' },
              },
            },
          },
          strict: { type: 'boolean' },
          inputType: { type: 'text' },
          maxChars: { type: 'int' },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
          skipSubmitted: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          quiz: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  duration: { type: 'int' },
                  buffer: { type: 'int' },
                },
              },
              requiresCorrectAnswer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      pageOverview: {
        prefix: 'po',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          placeOnTop: { type: 'boolean' },
          selectRandomMedia: { type: 'boolean' },
          questionsOptional: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      pageRankingQuestion: {
        prefix: 'ra',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          bottomText: { type: 'text' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
          quiz: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  duration: { type: 'int' },
                  buffer: { type: 'int' },
                },
              },
              requiresCorrectAnswer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
            },
          },
          ranks: { type: 'array', items: { type: 'number' } },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          imageFit: { type: 'string' },
        },
      },
      itemRankingQuestion: {
        prefix: 'ri',
        fields: {
          title: { type: 'text' },
          image: { type: 'url' },
          body: { type: 'text' },
          index: { type: 'int' },
          ref: { type: 'reference' },
        },
      },
      pageResultScreen: {
        prefix: 're',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          pageRef: { type: 'reference' },
          yourAnswerText: { type: 'text' },
          otherAnswersText: { type: 'text' },
          youDidntVoteText: { type: 'text' },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
          showAudienceResults: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              type: { type: 'string' },
            },
          },
        },
      },
      pageScaleQuestion: {
        prefix: 'sc',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          skip: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              text: { type: 'text' },
            },
          },
          quiz: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  duration: { type: 'int' },
                  buffer: { type: 'int' },
                },
              },
              requiresCorrectAnswer: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  text: { type: 'text' },
                },
              },
            },
          },
          skipSubmitted: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          layout: { type: 'string' },
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number' },
          unit: { type: 'string' },
          labels: {
            type: 'object',
            properties: { enabled: { type: 'boolean' } },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      itemScaleQuestion: {
        prefix: 'si',
        fields: {
          ref: { type: 'reference' },
          title: { type: 'text' },
          index: { type: 'int' },
          value: { type: 'number' },
          correct: { type: 'boolean' },
          points: { type: 'int' },
        },
      },
      pageSMSScreen: {
        prefix: 'sm',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          name: { type: 'string' },
          label: { type: 'text' },
          title: { type: 'text' },
          body: { type: 'text' },
          button: { type: 'text' },
          placeOnTop: { type: 'boolean' },
          selectRandomMedia: { type: 'boolean' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                target: { type: 'string' },
                text: { type: 'text' },
                title: { type: 'text' },
                description: { type: 'text' },
                button: { type: 'text' },
                action: { type: 'string' },
              },
            },
          },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                src: { type: 'url' },
                poster: { type: 'url' },
                fullscreen: { type: 'boolean' },
                autoplay: { type: 'boolean' },
                loop: { type: 'boolean' },
                required: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    text: { type: 'text' },
                  },
                },
              },
            },
          },
          condition: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              conditions: { type: 'array', items: { type: 'json' } },
            },
          },
        },
      },
      smartCopy: {
        prefix: 'cp',
        fields: {
          ref: { type: 'reference' },
          index: { type: 'int' },
          linked: { type: 'reference' },
        },
      },
    },
  },
  {
    languages: ['en', 'nl'],
    types: {
      file: {
        prefix: 'fi',
        fields: {
          index: {
            type: 'number',
          },
          tempOrder: {
            type: 'string',
          },
        },
      },
      folder: {
        fields: {
          tempOrder: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          index: {
            type: 'number',
          },
        },
        prefix: 'di',
      },
      user: {
        prefix: 'us',
        fields: {
          currentToken: { type: 'string' },
          profileImg: { type: 'url' },
        },
      },
    },
  },
]
