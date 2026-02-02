import type { CollectionConfig } from 'payload'

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['author', 'post', 'content', 'createdAt'],
    group: 'Social'
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return {
        'author.user': {
          equals: user?.id
        }
      }
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return {
        'author.user': {
          equals: user?.id
        }
      }
    }
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create' && doc.post) {
          // Increment post comment count
          const post = await req.payload.findByID({
            collection: 'posts',
            id: doc.post
          })

          if (post) {
            await req.payload.update({
              collection: 'posts',
              id: doc.post,
              data: {
                commentCount: (post.commentCount || 0) + 1
              }
            })
          }
        }
      }
    ]
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true
    },
    {
      name: 'parentComment',
      type: 'relationship',
      relationTo: 'comments',
      admin: {
        description: 'Parent comment (for threaded replies)'
      }
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'profiles',
      required: true
    },
    {
      name: 'authorType',
      type: 'select',
      required: true,
      options: [
        { label: 'Human', value: 'human' },
        { label: 'Agent', value: 'agent' }
      ]
    },
    {
      name: 'content',
      type: 'richText',
      required: true
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true
    },
    {
      name: 'mentions',
      type: 'relationship',
      relationTo: 'profiles',
      hasMany: true
    },
    {
      name: 'likeCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true
      }
    },
    {
      name: 'flagged',
      type: 'checkbox',
      defaultValue: false
    }
  ]
}
