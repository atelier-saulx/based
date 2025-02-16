import test from 'node:test'
import { parse } from '@based/schema'

await test('roles', () => {
  parse({
    types: {
      myFile: {
        props: {
          fileName: {
            type: 'string',
            role: 'title',
          },
          srcUrl: {
            type: 'string',
            format: 'URL',
            role: 'source',
            mime: ['*/*'],
          },
          srcBinary: {
            type: 'binary',
            role: 'source',
            mime: ['*/*'],
          },
          progress: {
            type: 'number',
            min: 0,
            max: 1,
            display: 'meter',
          },
          uploadDate: {
            type: 'timestamp',
            display: 'date',
          },
          videoArticles: {
            items: {
              ref: 'myArticle',
              prop: 'video',
            },
          },
          imageArticles: {
            items: {
              ref: 'myArticle',
              prop: 'image',
            },
          },
        },
      },

      myArticle: {
        props: {
          image: {
            ref: 'myFile',
            mime: 'image/*',
            prop: 'imageArticles',
          },

          video: {
            ref: 'myFile',
            mime: ['video/mp4', 'video/quicktime'],
            prop: 'videoArticles',
          },
        },
      },
    },
  })
})
