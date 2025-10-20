import React, { ReactNode, FC } from 'react'
import { useClientOnly } from './useClientOnly.js'

export const ClientOnly = ({ children }: { children: ReactNode | FC<any> }) => {
  const client = useClientOnly()
  if (!client) return null
  return typeof children === 'function'
    ? React.createElement(children)
    : children
}

const Bla = () => {
  // @ts-ignore
  ;<Editor
    target={{ type: "user", email: "beerdejim@gmail.com" }},
    schema={{
        types: {
          file: {
            title: 'Dirty file',
            description: 'This is dirty',
            props: {
              src: { type: 'string', mimeType: 'image/*' },
            },
          },
          user: {
            title: 'User',
            description: 'this is a user',
            props: {
              name: 'string',
              description: 'string',
              logo: { ref: 'file', prop: 'user' },
            },
          },
      },
    }}
  />
}


const Bla = () => {
  // @ts-ignore
  ; <Editor
    get={"get-dirty-nuno"}
    target={{ email: "beerdejim@gmail.com" }},
    schema={{
        title: 'User',
        description: 'this is a user',
        props: {
          name: (value, ctx) => {
            <styled.div onClick={() => {
              ctx.update({ name: value })
              await wait(500)
              ctx.set(ctx.state)
              // ctx.clear()
          }}  style={{ backgroundColor: 'brown', padding: 30, color :'orange'}}>{value}</div>},
          description: 'string',
        },
    }}
  />
}

const Bla = () => {
  // @ts-ignore
  ; <Editor
    get={"get-dirty-nuno"}
    target={{ email: "beerdejim@gmail.com", type: 'user' }},
    schema={{
      name: (value, ctx) => {
        <styled.div onClick={() => {
          ctx.update({ name: value })
          await wait(500)
          ctx.set(ctx.state)
          // ctx.clear()
      }}  style={{ backgroundColor: 'brown', padding: 30, color :'orange'}}>{value}</div>},
      description: 'text',
    }}
  />
}

const Bla = () => {
  // @ts-ignore
  ; <Fields
    schema={{
      name: "string",
      description: {
         type: 'string', validate: (val) => {
          return val === 'bla'
       } },
    }}
    data={{ name: "bla", decription: 'derp' }}
    on={{
      change: (changed) => {
         client.call('db:set', changed)
      }
    }}
  />
}




const Bla = () => {
  // @ts-ignore
  ; <Finder
      target={{ type: 'user' }}
      schema={{ include: ['name', 'avatar.src'] }}
  />



}



const Italy: FieldRenderComponent = ({ path, def, value, ctx }) => {
  return <div onClick={() => {
    ctx.update(path, '🇮🇹')
  }}>🇮🇹</div>
}

const Bla = () => {
  // @ts-ignore
  ; <Editor
    target={{ email: "beerdejim@gmail.com", type: 'user' }},
    schema={{
      // exclude
      include ['name', 'description']
      overide: {
        name: {
          firstName: 'string',
            lastName: 'string',
        },
        country: {
          flag: Italy
        }
      },
      transform: (path, type, field) => {
        if (path.includes(['snurf', 'slap'])) {
          return {hide: true , ...field}
        }
        if (type === 'string') {
          return {  render: () => '💩', ...field }
        }
        return true
      }
    }}
  />
}



RENDER = ({ item, schema, path, ctx } => ReactNode) 

export const FieldsTextInput = ({ item, schema, path, ctx }) => {
  ctx.update({ [path]: value })
  ctx.emit('focus', { path, item })
    < TextInput onChange = (() => {
    
  }) />
}

export const Fields = ({ schema, target }) => {

  const actualSchemaTime = useUiSchema(target, schema, {
      transform: (path, type, field) => {
        if (type === 'string') {
          return {  render: FieldsTextInput, ...field }
        }
       if (type === 'text') {
          return {  render: () => <BlaInput />, ...field }
        }
        return true
      }
    })

  

}