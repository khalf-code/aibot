import type { CollectionConfig } from 'payload'

export const Likes: CollectionConfig = {
  slug: 'likes',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['profile', 'targetType', 'reactionType', 'createdAt'],
    group: 'Social'
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return {
        'profile.user': {
          equals: user?.id
        }
      }
    }
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Increment like count on target
          const targetCollection = doc.targetType === 'post' ? 'posts' : 'comments'
          const targetId = doc.targetPost || doc.targetComment

          if (targetId) {
            const target = await req.payload.findByID({
              collection: targetCollection,
              id: targetId
            })

            if (target) {
              await req.payload.update({
                collection: targetCollection,
                id: targetId,
                data: {
                  likeCount: (target.likeCount || 0) + 1
                }
              })
            }
          }
        }
      }
    ],
    afterDelete: [
      async ({ doc, req }) => {
        // Decrement like count on target
        const targetCollection = doc.targetType === 'post' ? 'posts' : 'comments'
        const targetId = doc.targetPost || doc.targetComment

        if (targetId) {
          const target = await req.payload.findByID({
            collection: targetCollection,
            id: targetId
          })

          if (target && target.likeCount > 0) {
            await req.payload.update({
              collection: targetCollection,
              id: targetId,
              data: {
                likeCount: target.likeCount - 1
              }
            })
          }
        }
      }
    ]
  },
  fields: [
    {
      name: 'profile',
      type: 'relationship',
      relationTo: 'profiles',
      required: true
    },
    {
      name: 'targetType',
      type: 'select',
      required: true,
      options: [
        { label: 'Post', value: 'post' },
        { label: 'Comment', value: 'comment' }
      ]
    },
    {
      name: 'targetPost',
      type: 'relationship',
      relationTo: 'posts',
      admin: {
        condition: (data) => data?.targetType === 'post'
      }
    },
    {
      name: 'targetComment',
      type: 'relationship',
      relationTo: 'comments',
      admin: {
        condition: (data) => data?.targetType === 'comment'
      }
    },
    {
      name: 'reactionType',
      type: 'select',
      defaultValue: 'like',
      options: [
        { label: '❤️ Like', value: 'like' },
        { label: '😍 Love', value: 'love' },
        { label: '😂 Laugh', value: 'laugh' },
        { label: '😮 Wow', value: 'wow' },
        { label: '🧠 Smart', value: 'smart' },
        { label: '🔥 Fire', value: 'fire' }
      ]
    }
  ],
  indexes: [
    {
      fields: {
        profile: 1,
        targetType: 1,
        targetPost: 1,
        targetComment: 1
      },
      unique: true
    }
  ]
}
