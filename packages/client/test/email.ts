import test from 'ava'
import createServer from '@based/server'
import based from '../src'

// need to add 'salt' for the hashing function in the db for passwords
test.serial('call functions', async (t) => {
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      sendEmail: async ({ to, subject, body, from }) => {
        return {
          status: 'ok',
          message: `Send email to ${to} from ${from} subject ${subject} body ${body}`,
        }
      },
      functions: {
        doit: {
          observable: false,
          function: async ({ based }) => {
            return based.sendEmail({
              to: 'bla@bla.com',
              subject: 'fun',
              body: 'hello',
              from: 'bla@bla.com',
            })
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const email = await client.call('doit')

  console.info(email)

  t.deepEqual(email, {
    status: 'ok',
    message: `Send email to bla@bla.com from bla@bla.com subject fun body hello`,
  })

  client.disconnect()
})
