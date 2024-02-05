import { BasedSchema } from '../../src/types.js'

export const newSchemas: BasedSchema[] = [
  {
    types: {
      thing: {
        prefix: 'ti',
        fields: {
          priority: { type: 'number' },
          something: { type: 'string', format: 'strongPassword' },
        },
      },
      bla: {
        prefix: 'bl',
        fields: {
          enum: {
            enum: ['tony', 'jim'],
          },
          setOfNumbers: {
            type: 'set',
            items: {
              type: 'number',
            },
          },
          object: {
            type: 'object',
            properties: {
              flap: { type: 'boolean' },
            },
          },
          flap: {
            type: 'boolean',
          },
          x: {
            type: 'object',
            properties: {
              flap: {
                type: 'boolean',
              },
            },
          },
          record: {
            type: 'record',
            values: {
              type: 'object',
              properties: {
                bla: {
                  type: 'array',
                  values: {
                    type: 'object',
                    properties: {
                      snux: {
                        type: 'object',
                        properties: {
                          x: {
                            type: 'number',
                          },
                        },
                      },
                      flap: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          bla: {
            type: 'set',
            items: { type: 'string', minLength: 3, maxLength: 6 },
          },
        },
      },
    },
    $defs: {},
    language: 'en',
    translations: ['de', 'nl', 'ro', 'za', 'ae'],
    root: {
      fields: {},
    },
    prefixToTypeMapping: {
      bl: 'bla',
      ti: 'thing',
    },
  },
  {
    types: {
      thing: {
        prefix: 'ti',
        fields: {
          dateHuman: { type: 'timestamp', display: 'human' },
          dateTime: { type: 'timestamp', display: 'date-time' },
          dateTimeText: { type: 'timestamp', display: 'date-time-text' },
          time: { type: 'timestamp', display: 'time' },
          timePrecise: { type: 'timestamp', display: 'time-precise' },
          capitalize: {
            type: 'string',
            display: 'capitalize',
            format: 'lowercase',
          },
          upperCase: { type: 'string', display: 'uppercase' },
          lowerCase: { type: 'string', display: 'lowercase' },
          euros: { type: 'number', display: 'euro' },
          dollars: { type: 'number', display: 'dollar' },
          pounds: { type: 'number', display: 'pound' },
          bytes: { type: 'number', display: 'bytes' },
          humanNumber: { type: 'number', display: 'human' },
          ratio: { type: 'number', display: 'ratio' },
          short: { type: 'number', display: 'short' },
        },
      },
    },
    $defs: {},
    language: 'en',
    root: {
      fields: {},
    },
    prefixToTypeMapping: {
      bl: 'bla',
      ti: 'thing',
    },
  },
  {
    language: 'en',
    translations: ['nl'],
    $defs: {},
    prefixToTypeMapping: {},
    root: {
      fields: {},
    },
    types: {
      file: {
        prefix: 'fi',
        fields: {
          usedIn: {
            type: 'references',
            bidirectional: { fromField: 'img' },
          },
          caption: {
            // needs translation?
            type: 'text',
            description: 'Caption for seo',
            title: 'Caption',
          },
        },
      },
      user: {
        prefix: 'us',
        fields: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          company: { type: 'reference' },
          newsletter: { type: 'integer' },
          ip: { type: 'string' },
          seen: { type: 'timestamp' },
          charges: {
            type: 'references',
            bidirectional: { fromField: 'user' },
            allowedTypes: ['charge'],
          },
          articles: {
            type: 'references',
            bidirectional: { fromField: 'contributors' },
            allowedTypes: ['article'],
          },
        },
      },
      charge: {
        fields: {
          // does this have a user?
          user: {
            type: 'reference',
            bidirectional: { fromField: 'charges' },
            allowedTypes: ['user'],
          },
          token: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          stripeId: { type: 'string' },
        },
      },
      category: {
        fields: {
          title: { type: 'text' },
          children: {
            type: 'references',
            allowedTypes: ['article'],
          },
        },
      },
      section: {
        fields: {
          title: { type: 'text' },
          membership: { type: 'number' },
          membershipFreeDays: { type: 'number' },
          hidden: { type: 'boolean' },
          metaDescription: { type: 'text' },
          // meta_keywords: { type: 'array', values: { type: 'string' } },
          children: {
            type: 'references',
            allowedTypes: ['article', 'category'],
          },
        },
      },
      article: {
        prefix: 'ar',
        fields: {
          contributors: {
            title: 'Writers',
            description: 'Writers or people involved with the article.',
            type: 'references',
            allowedTypes: ['user'],
            bidirectional: {
              fromField: 'articles',
            },
          },
          contributorsText: {
            title: 'Contributors text',
            description:
              'Gets auto generated based on contributors, fill it in to override.',
            examples: ['Peter Teffer, graphics by Kashyap Raibagi (EDJNET)'],
            type: 'text',
          },
          headline: {
            title: 'Headline',
            description: 'Displayed on pages, also used as meta title for seo.',
            type: 'text',
          },
          publishDate: {
            title: 'Publish date',
            description: 'Any time you want the article to show on the website',
            type: 'timestamp',
          },
          archived: {
            title: 'Archived',
            description:
              'Archived articles will not show up on the website or be available outside of the cms',
            type: 'boolean',
          },
          img: {
            type: 'reference',
            allowedTypes: ['file'],
            bidirectional: { fromField: 'usedIn' },
          },
          hits: { type: 'number' }, // get a bit more going here maybe? what does this mean
          membership: { enum: ['Need membership', 'Free'] },
          location: { type: 'text' }, // or string its just city name or smth
          bio: { type: 'text', format: 'json' }, //has a href and stuff so aarich text
          tweet: { type: 'string' }, // ask if it needs translation  // 'The 2009 allocation of solar subsidies in Solvakia "was rigged," say a US cable. PM Fico denies it.',
          notes: { type: 'string' },
          abstract: { type: 'text' },
          body: { type: 'text', format: 'json' }, // will add rich text
        },
      },
    },
  },
]
