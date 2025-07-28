import { Infer } from '../src/infer.js'
import { Schema } from '../src/index.js'

// Test schema
const testSchema = {
  types: {
    user: {
      props: {
        name: { type: 'string' },
        age: { type: 'number' },
        status: { enum: ['active', 'inactive'] },
        friends: { items: { ref: 'user', prop: 'friends' } },
        profile: { props: { bio: { type: 'text' } } },
      },
    },
    post: {
      title: { type: 'string' },
      content: { type: 'text' },
      author: { ref: 'user', prop: 'author' },
      tags: { items: 'string' },
      metadata: { type: 'json' },
      published: { type: 'boolean' },
      createdAt: { type: 'timestamp' },
    },
  },
} as const satisfies Schema

// Inferred type
type TestSchemaParsed = Infer<typeof testSchema>

// Type assertions to verify the inference works correctly
type User = TestSchemaParsed['user']
type Post = TestSchemaParsed['post']

function createUser(data: User): User {
  return data
}

function createPost(data: Post): Post {
  return data
}

// Test the type inference
const user: User = {
  id: 1,
  name: 'John Doe',
  age: 30,
  status: 'active', // TypeScript will enforce this must be 'active' | 'inactive'
  friends: [], // Array of numbers (user IDs)
  profile: {
    bio: 'Hello world!',
  },
}

const post: Post = {
  id: 1,
  title: 'My First Post',
  content: 'This is the content of my post',
  author: {
    id: 1,
    name: 'John Doe',
    age: 30,
    status: 'active',
    friends: [],
    profile: { bio: 'Hello world!' },
  },
  tags: ['typescript', 'schema'],
  metadata: { views: 100, likes: 5 },
  published: true,
  createdAt: Date.now(),
}

console.log('Type inference working correctly!')
console.log('User:', user)
console.log('Post:', post)

export { testSchema, createUser, createPost }

const x = createUser(user)

console.log(x.friends[0].name)
