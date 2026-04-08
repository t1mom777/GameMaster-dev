import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../payload.config'

type BaseRecord = {
  id?: string | number
  slug?: string | null
}

type SeedDocument = {
  slug: string
  title: string
  filePath: string
}

const bootstrapAdminEmail = process.env.GM_BOOTSTRAP_ADMIN_EMAIL?.trim() || ''
const bootstrapAdminPassword = process.env.GM_BOOTSTRAP_ADMIN_PASSWORD?.trim() || ''
const bootstrapAdminName = process.env.GM_BOOTSTRAP_ADMIN_NAME?.trim() || 'GameMaster Operator'

const seedRoot = path.resolve(process.cwd(), 'src/seed-content')

async function findBySlug<T extends BaseRecord>(payload: Awaited<ReturnType<typeof getPayload>>, collection: string, slug: string) {
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs[0] as T | undefined
}

async function ensureAdmin(payload: Awaited<ReturnType<typeof getPayload>>) {
  const existing = await payload.find({
    collection: 'admins',
    depth: 0,
    limit: 1,
    pagination: false,
  })

  if (existing.docs.length) {
    return existing.docs[0]
  }

  if (!bootstrapAdminEmail || !bootstrapAdminPassword) {
    throw new Error(
      'Bootstrap admin credentials are missing. Set GM_BOOTSTRAP_ADMIN_EMAIL and GM_BOOTSTRAP_ADMIN_PASSWORD in Coolify.',
    )
  }

  return payload.create({
    collection: 'admins',
    data: {
      email: bootstrapAdminEmail,
      name: bootstrapAdminName,
      password: bootstrapAdminPassword,
      role: 'owner',
    },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
}

async function upsertGlobal<TData extends Record<string, unknown>>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string,
  data: TData,
) {
  await payload.updateGlobal({
    data,
    slug,
  })
}

async function upsertCollection<T extends BaseRecord & Record<string, unknown>>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  slug: string,
  data: Record<string, unknown>,
) {
  const existing = await findBySlug<T>(payload, collection, slug)

  if (existing?.id) {
    return payload.update({
      collection,
      data,
      id: String(existing.id),
      overrideAccess: true,
    })
  }

  return payload.create({
    collection,
    data: {
      slug,
      ...data,
    },
    overrideAccess: true,
  })
}

async function upsertSeedDocument(
  payload: Awaited<ReturnType<typeof getPayload>>,
  document: SeedDocument,
  extraData: Record<string, unknown>,
) {
  const existing = await findBySlug<BaseRecord & Record<string, unknown>>(payload, 'documents', document.slug)

  if (existing?.id) {
    return payload.update({
      collection: 'documents',
      data: {
        ...extraData,
        slug: document.slug,
        title: document.title,
      },
      id: String(existing.id),
      overrideAccess: true,
    })
  }

  return payload.create({
    collection: 'documents',
    data: {
      ...extraData,
      slug: document.slug,
      title: document.title,
    },
    filePath: document.filePath,
    overrideAccess: true,
  } as never)
}

async function ensureSeedFiles() {
  await fs.mkdir(seedRoot, { recursive: true })
}

async function main() {
  const payload = await getPayload({ config })
  await ensureSeedFiles()

  await ensureAdmin(payload)

  const campaign = await upsertCollection(payload, 'campaigns', 'ashen-gate', {
    pitch:
      'A public demo campaign about a fractured city where lantern light keeps back something old, hungry, and patient.',
    tableExpectations: [
      { expectation: 'Keep the opening scene moving.' },
      { expectation: 'Ground every ruling in the active sources.' },
      { expectation: 'Leave room for player choice on every beat.' },
    ],
    title: 'Ashen Gate',
  })

  const world = await upsertCollection(payload, 'worlds', 'ashen-gate-city', {
    campaign: campaign.id,
    playerPromise: 'Every choice changes the shape of the city and the people who survive it.',
    title: 'Ashen Gate: The Broken Light',
    tone: 'Gothic, pressured, and conversational.',
  })

  const ruleset = await upsertCollection(payload, 'rulesets', 'ashen-gate-core', {
    campaign: campaign.id,
    summary: 'Core rules for the Ashen Gate demo table and its first public session.',
    title: 'Ashen Gate Core Rules',
  })

  const primaryRulebook = await upsertSeedDocument(
    payload,
    {
      filePath: path.join(seedRoot, 'primary-rulebook.md'),
      slug: 'ashen-gate-core-rulebook',
      title: 'Ashen Gate Core Rulebook',
    },
    {
      isActive: true,
      isPrimary: true,
      kind: 'primary-rulebook',
      ruleset: ruleset.id,
      status: 'ready',
    },
  )

  const supportingBook = await upsertSeedDocument(
    payload,
    {
      filePath: path.join(seedRoot, 'supporting-book.md'),
      slug: 'ashen-gate-table-reference',
      title: 'Ashen Gate Table Reference',
    },
    {
      isActive: true,
      isPrimary: false,
      kind: 'supporting-book',
      ruleset: ruleset.id,
      status: 'ready',
    },
  )

  await payload.update({
    collection: 'rulesets',
    data: {
      campaign: campaign.id,
      primaryRulebook: primaryRulebook.id,
      supportingBooks: [supportingBook.id],
      summary: 'Core rules for the Ashen Gate demo table and its first public session.',
      title: 'Ashen Gate Core Rules',
    },
    id: String(ruleset.id),
    overrideAccess: true,
  })

  await payload.update({
    collection: 'campaigns',
    data: {
      pitch:
        'A public demo campaign about a fractured city where lantern light keeps back something old, hungry, and patient.',
      primaryRuleset: ruleset.id,
      tableExpectations: [
        { expectation: 'Keep the opening scene moving.' },
        { expectation: 'Ground every ruling in the active sources.' },
        { expectation: 'Leave room for player choice on every beat.' },
      ],
      title: 'Ashen Gate',
    },
    id: String(campaign.id),
    overrideAccess: true,
  })

  const session = await upsertCollection(payload, 'game-sessions', 'ashen-gate-demo-table', {
    activeDocuments: [primaryRulebook.id, supportingBook.id],
    allowGuests: true,
    campaign: campaign.id,
    publicJoinEnabled: true,
    publicSummary: 'A public demo table for the migration stack. Join, speak, and test the new GM runtime.',
    roomName: 'ashen-gate-demo-room',
    ruleset: ruleset.id,
    scheduledFor: new Date().toISOString(),
    status: 'live',
    title: 'Ashen Gate Demo Table',
    welcomeText:
      'Welcome to Ashen Gate. Keep your opening move sharp, and let the GM pull the table into the first scene immediately.',
    world: world.id,
  })

  await payload.update({
    collection: 'game-sessions',
    data: {
      activeDocuments: [primaryRulebook.id, supportingBook.id],
      allowGuests: true,
      campaign: campaign.id,
      publicJoinEnabled: true,
      publicSummary: 'A public demo table for the migration stack. Join, speak, and test the new GM runtime.',
      roomName: 'ashen-gate-demo-room',
      ruleset: ruleset.id,
      scheduledFor: new Date().toISOString(),
      status: 'live',
      title: 'Ashen Gate Demo Table',
      welcomeText:
        'Welcome to Ashen Gate. Keep your opening move sharp, and let the GM pull the table into the first scene immediately.',
      world: world.id,
    },
    id: String(session.id),
    overrideAccess: true,
  })

  await upsertGlobal(payload, 'runtime-defaults', {
    allowTextFallback: true,
    joinGreeting: 'Welcome to the table. Introduce the current scene, confirm the player intent, and start with a strong first prompt.',
    llmModel: 'gemini-2.5-flash',
    llmProvider: 'gemini',
    maxParticipants: 6,
    retrievalTopK: 5,
    sttModel: 'nova-3',
    sttProvider: 'deepgram',
    systemPrompt:
      'You are the GameMaster. Run a vivid, fast-moving tabletop RPG session. Respect the current campaign tone, stay grounded in the active rulebooks, and keep responses speakable for voice output.',
    ttsModel: 'aura-2',
    ttsProvider: 'deepgram',
    ttsVoice: 'thalia-en',
    voiceMode: 'auto-vad',
  })

  await upsertGlobal(payload, 'site-settings', {
    publicDescription: 'Join a room, speak naturally, and let the GM keep the world coherent through active rulebooks and scene memory.',
    siteTitle: 'GameMaster',
    tagline: 'Voice-first tabletop sessions with admin-grade campaign control.',
  })

  process.stdout.write(
    `Bootstrap complete: admin=${bootstrapAdminEmail || 'existing'}, campaign=${String(campaign.id)}, session=${String(session.id)}\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
