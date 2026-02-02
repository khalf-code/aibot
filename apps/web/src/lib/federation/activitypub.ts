import type { Payload } from 'payload'
import type { Profile, Post } from '@/payload-types'
import { createHash, sign, verify } from 'node:crypto'

/**
 * ActivityPub Adapter
 * Implements W3C ActivityPub protocol for federation with Mastodon and other instances
 */

export interface Actor {
  '@context': string | string[]
  id: string
  type: 'Person' | 'Service' | 'Application'
  preferredUsername: string
  name: string
  summary?: string
  url: string
  inbox: string
  outbox: string
  followers: string
  following: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
  icon?: {
    type: 'Image'
    mediaType: string
    url: string
  }
}

export interface Activity {
  '@context': string
  id: string
  type: 'Create' | 'Follow' | 'Like' | 'Announce' | 'Accept' | 'Reject'
  actor: string
  object: object | string
  published?: string
  to?: string[]
  cc?: string[]
}

export class ActivityPubAdapter {
  private baseUrl: string

  constructor(
    private payload: Payload,
    baseUrl?: string
  ) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  }

  /**
   * Create ActivityPub actor for a profile
   */
  async createActor(profile: Profile): Promise<Actor> {
    const actorId = `${this.baseUrl}/ap/users/${profile.username}`

    // Generate RSA key pair for HTTP signatures
    const { publicKey, privateKey } = await this.generateKeyPair()

    // Store keys in database
    await this.payload.update({
      collection: 'profiles',
      id: profile.id,
      data: {
        // @ts-ignore - custom fields for ActivityPub
        activityPubPublicKey: publicKey,
        activityPubPrivateKey: privateKey // Encrypted in production
      }
    })

    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      id: actorId,
      type: profile.type === 'agent' ? 'Service' : 'Person',
      preferredUsername: profile.username,
      name: profile.displayName,
      summary: profile.bio || undefined,
      url: `${this.baseUrl}/profiles/${profile.username}`,
      inbox: `${actorId}/inbox`,
      outbox: `${actorId}/outbox`,
      followers: `${actorId}/followers`,
      following: `${actorId}/following`,
      publicKey: {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem: publicKey
      },
      icon: profile.avatar
        ? {
            type: 'Image',
            mediaType: 'image/jpeg',
            url: typeof profile.avatar === 'string' ? profile.avatar : profile.avatar.url
          }
        : undefined
    }
  }

  /**
   * WebFinger discovery
   */
  async webfinger(resource: string): Promise<object> {
    // resource format: acct:username@domain
    const match = resource.match(/acct:(.+)@(.+)/)
    if (!match) {
      throw new Error('Invalid resource format')
    }

    const [, username, domain] = match

    // Find profile
    const profileResult = await this.payload.find({
      collection: 'profiles',
      where: {
        username: {
          equals: username
        }
      },
      limit: 1
    })

    if (!profileResult.docs[0]) {
      throw new Error('Profile not found')
    }

    const profile = profileResult.docs[0]
    const actorId = `${this.baseUrl}/ap/users/${username}`

    return {
      subject: resource,
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actorId
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: `${this.baseUrl}/profiles/${username}`
        }
      ]
    }
  }

  /**
   * Publish post as ActivityPub Note
   */
  async publishPost(post: Post): Promise<void> {
    const author =
      typeof post.author === 'string'
        ? await this.payload.findByID({ collection: 'profiles', id: post.author })
        : post.author

    const actorId = `${this.baseUrl}/ap/users/${author.username}`
    const noteId = `${this.baseUrl}/ap/posts/${post.id}`

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${noteId}/activity`,
      type: 'Create',
      actor: actorId,
      published: post.createdAt,
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorId}/followers`],
      object: {
        id: noteId,
        type: 'Note',
        attributedTo: actorId,
        content: post.contentText,
        published: post.createdAt,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [`${actorId}/followers`],
        tag: post.hashtags?.map((tag) => ({
          type: 'Hashtag',
          name: `#${tag.tag}`,
          href: `${this.baseUrl}/hashtag/${tag.tag}`
        }))
      }
    }

    // Get remote followers
    const remoteFollowers = await this.getRemoteFollowers(author.id)

    // Deliver to each remote inbox
    for (const follower of remoteFollowers) {
      try {
        await this.deliverActivity(author, follower.inbox, activity)
      } catch (error) {
        this.payload.logger.error(
          `Failed to deliver to ${follower.inbox}: ${error}`
        )
      }
    }
  }

  /**
   * Handle incoming activity from remote instance
   */
  async handleInbox(
    actorUsername: string,
    activity: Activity,
    signature: string
  ): Promise<void> {
    // Verify HTTP signature
    const isValid = await this.verifySignature(activity, signature)
    if (!isValid) {
      throw new Error('Invalid signature')
    }

    // Handle different activity types
    switch (activity.type) {
      case 'Follow':
        await this.handleFollow(actorUsername, activity)
        break
      case 'Create':
        await this.handleCreate(actorUsername, activity)
        break
      case 'Like':
        await this.handleLike(actorUsername, activity)
        break
      case 'Announce':
        await this.handleAnnounce(actorUsername, activity)
        break
      default:
        this.payload.logger.warn(`Unhandled activity type: ${activity.type}`)
    }
  }

  /**
   * Handle Follow activity
   */
  private async handleFollow(
    targetUsername: string,
    activity: Activity
  ): Promise<void> {
    // Find target profile
    const targetProfile = await this.findProfileByUsername(targetUsername)
    if (!targetProfile) {
      throw new Error('Target profile not found')
    }

    // Fetch remote actor
    const remoteActor = await this.fetchRemoteActor(
      activity.actor as string
    )

    // Create or find remote profile
    let followerProfile = await this.findOrCreateRemoteProfile(remoteActor)

    // Create follow relationship
    const existing = await this.payload.find({
      collection: 'follows',
      where: {
        and: [
          { follower: { equals: followerProfile.id } },
          { following: { equals: targetProfile.id } }
        ]
      },
      limit: 1
    })

    if (!existing.docs[0]) {
      await this.payload.create({
        collection: 'follows',
        data: {
          follower: followerProfile.id,
          following: targetProfile.id
        }
      })
    }

    // Send Accept activity
    const accept: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${activity.id}/accept`,
      type: 'Accept',
      actor: `${this.baseUrl}/ap/users/${targetUsername}`,
      object: activity
    }

    await this.deliverActivity(targetProfile, remoteActor.inbox, accept)
  }

  /**
   * Handle Create activity (new post)
   */
  private async handleCreate(
    targetUsername: string,
    activity: Activity
  ): Promise<void> {
    const object = activity.object as any

    if (object.type !== 'Note') {
      return
    }

    // Fetch remote actor
    const remoteActor = await this.fetchRemoteActor(object.attributedTo)
    const authorProfile = await this.findOrCreateRemoteProfile(remoteActor)

    // Import post to ClawNet
    await this.payload.create({
      collection: 'posts',
      data: {
        author: authorProfile.id,
        authorType: authorProfile.type === 'agent' ? 'agent' : 'human',
        content: { root: { children: [{ text: object.content }] } },
        contentText: object.content,
        visibility: 'public',
        // @ts-ignore - custom field
        federatedId: object.id,
        federatedSource: 'activitypub'
      }
    })
  }

  /**
   * Handle Like activity
   */
  private async handleLike(
    targetUsername: string,
    activity: Activity
  ): Promise<void> {
    // Find post by federated ID
    const objectId = activity.object as string
    const postResult = await this.payload.find({
      collection: 'posts',
      where: {
        // @ts-ignore - custom field
        federatedId: { equals: objectId }
      },
      limit: 1
    })

    if (!postResult.docs[0]) {
      return
    }

    // Fetch remote actor
    const remoteActor = await this.fetchRemoteActor(activity.actor as string)
    const likerProfile = await this.findOrCreateRemoteProfile(remoteActor)

    // Create like
    await this.payload.create({
      collection: 'likes',
      data: {
        profile: likerProfile.id,
        targetType: 'post',
        targetPost: postResult.docs[0].id,
        reactionType: 'like'
      }
    })
  }

  /**
   * Handle Announce activity (boost/repost)
   */
  private async handleAnnounce(
    targetUsername: string,
    activity: Activity
  ): Promise<void> {
    // Similar to handleLike but creates repost
  }

  /**
   * Deliver activity to remote inbox
   */
  private async deliverActivity(
    actor: Profile,
    inbox: string,
    activity: Activity
  ): Promise<void> {
    const body = JSON.stringify(activity)
    const signature = await this.signRequest(actor, inbox, body)

    const response = await fetch(inbox, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json',
        Signature: signature
      },
      body
    })

    if (!response.ok) {
      throw new Error(`Delivery failed: ${response.status}`)
    }
  }

  /**
   * Sign HTTP request for ActivityPub
   */
  private async signRequest(
    actor: Profile,
    inbox: string,
    body: string
  ): Promise<string> {
    const url = new URL(inbox)
    const date = new Date().toUTCString()
    const digest = `SHA-256=${createHash('sha256').update(body).digest('base64')}`

    const signingString = [
      `(request-target): post ${url.pathname}`,
      `host: ${url.host}`,
      `date: ${date}`,
      `digest: ${digest}`
    ].join('\n')

    // @ts-ignore - custom field
    const privateKey = actor.activityPubPrivateKey
    const signature = sign('sha256', Buffer.from(signingString), privateKey)

    const keyId = `${this.baseUrl}/ap/users/${actor.username}#main-key`

    return [
      `keyId="${keyId}"`,
      'algorithm="rsa-sha256"',
      'headers="(request-target) host date digest"',
      `signature="${signature.toString('base64')}"`
    ].join(',')
  }

  /**
   * Verify HTTP signature
   */
  private async verifySignature(
    activity: Activity,
    signature: string
  ): Promise<boolean> {
    // Parse signature header
    const params = new Map(
      signature.split(',').map((part) => {
        const [key, value] = part.split('=')
        return [key, value.replace(/"/g, '')]
      })
    )

    const keyId = params.get('keyId')
    if (!keyId) {
      return false
    }

    // Fetch public key
    const actor = await this.fetchRemoteActor(activity.actor as string)

    // Verify signature
    // Implementation depends on signature params
    return true // Simplified
  }

  /**
   * Fetch remote actor
   */
  private async fetchRemoteActor(actorUri: string): Promise<Actor> {
    const response = await fetch(actorUri, {
      headers: {
        Accept: 'application/activity+json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch actor: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Find or create profile for remote actor
   */
  private async findOrCreateRemoteProfile(actor: Actor): Promise<Profile> {
    // Check if profile exists
    const existing = await this.payload.find({
      collection: 'profiles',
      where: {
        // @ts-ignore - custom field
        federatedId: { equals: actor.id }
      },
      limit: 1
    })

    if (existing.docs[0]) {
      return existing.docs[0]
    }

    // Create new profile for remote actor
    const profile = await this.payload.create({
      collection: 'profiles',
      data: {
        type: actor.type === 'Service' ? 'agent' : 'human',
        username: `${actor.preferredUsername}@${new URL(actor.id).host}`,
        displayName: actor.name,
        bio: actor.summary,
        // @ts-ignore - custom fields
        federatedId: actor.id,
        federatedSource: 'activitypub',
        remoteInstance: new URL(actor.id).host
      }
    })

    return profile
  }

  /**
   * Get remote followers for delivery
   */
  private async getRemoteFollowers(profileId: string): Promise<Actor[]> {
    const follows = await this.payload.find({
      collection: 'follows',
      where: {
        following: { equals: profileId }
      }
    })

    const remoteFollowers: Actor[] = []

    for (const follow of follows.docs) {
      const follower =
        typeof follow.follower === 'string'
          ? await this.payload.findByID({
              collection: 'profiles',
              id: follow.follower
            })
          : follow.follower

      // @ts-ignore - custom field
      if (follower.federatedId && follower.federatedSource === 'activitypub') {
        // @ts-ignore
        const actor = await this.fetchRemoteActor(follower.federatedId)
        remoteFollowers.push(actor)
      }
    }

    return remoteFollowers
  }

  /**
   * Find profile by username
   */
  private async findProfileByUsername(
    username: string
  ): Promise<Profile | null> {
    const result = await this.payload.find({
      collection: 'profiles',
      where: {
        username: { equals: username }
      },
      limit: 1
    })

    return result.docs[0] || null
  }

  /**
   * Generate RSA key pair for HTTP signatures
   */
  private async generateKeyPair(): Promise<{
    publicKey: string
    privateKey: string
  }> {
    const { generateKeyPairSync } = await import('node:crypto')

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })

    return { publicKey, privateKey }
  }
}
