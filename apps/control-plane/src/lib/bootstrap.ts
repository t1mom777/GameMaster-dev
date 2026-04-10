import fs from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { ingestDocument } from './document-ingest'

type BaseRecord = {
  id?: string | number
  slug?: string | null
}

type BootstrapRecord = BaseRecord &
  Record<string, unknown> & {
    id: string | number
  }

type SeedDocument = {
  slug: string
  title: string
  filePath: string
}

type BootstrapCollection =
  | 'admins'
  | 'campaigns'
  | 'documents'
  | 'game-sessions'
  | 'rulesets'
  | 'worlds'

type BootstrapGlobal = 'runtime-defaults' | 'site-settings'

type BootstrapSummary = {
  adminEmail: string
  campaignId: string
  sessionId: string
}

const bootstrapAdminEmail = process.env.GM_BOOTSTRAP_ADMIN_EMAIL?.trim() || ''
const bootstrapAdminPassword = process.env.GM_BOOTSTRAP_ADMIN_PASSWORD?.trim() || ''
const bootstrapAdminName = process.env.GM_BOOTSTRAP_ADMIN_NAME?.trim() || 'GameMaster Operator'

const seedRoot = path.resolve(process.cwd(), 'src/seed-content')
const uploadRoot = path.resolve(process.cwd(), 'media/documents')

async function findBySlug<T extends BaseRecord>(payload: Payload, collection: BootstrapCollection, slug: string) {
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

  return result.docs[0] as unknown as T | undefined
}

async function ensureAdmin(payload: Payload) {
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

async function upsertGlobal<TData extends Record<string, unknown>>(payload: Payload, slug: BootstrapGlobal, data: TData) {
  await payload.updateGlobal({
    data,
    slug,
  } as never)
}

async function upsertCollection<T extends BaseRecord & Record<string, unknown>>(
  payload: Payload,
  collection: BootstrapCollection,
  slug: string,
  data: Record<string, unknown>,
): Promise<BootstrapRecord> {
  const existing = await findBySlug<T>(payload, collection, slug)

  if (existing?.id) {
    return payload.update({
      collection,
      data,
      id: String(existing.id),
      overrideAccess: true,
    } as never) as unknown as Promise<BootstrapRecord>
  }

  return payload.create({
    collection,
    data: {
      slug,
      ...data,
    },
    overrideAccess: true,
  } as never) as unknown as Promise<BootstrapRecord>
}

async function upsertSeedDocument(
  payload: Payload,
  document: SeedDocument,
  extraData: Record<string, unknown>,
): Promise<BootstrapRecord> {
  const storedFile = await materializeSeedDocument(document)
  const existing = await findBySlug<BaseRecord & Record<string, unknown>>(payload, 'documents', document.slug)
  const rulesetId = relationId(extraData.ruleset as { id?: string | number } | string | number | null | undefined)
  const sessionId = relationId(extraData.session as { id?: string | number } | string | number | null | undefined)
  const db = payload.db as {
    drizzle: unknown
    execute: (args: { drizzle: unknown; sql: unknown }) => Promise<{ rows: Array<{ id: number | string }> }>
  }

  let docId = existing?.id ? String(existing.id) : ''

  if (existing?.id) {
    await db.execute({
      drizzle: db.drizzle,
      sql: sql`
        UPDATE documents
        SET
          title = ${document.title},
          slug = ${document.slug},
          kind = ${String(extraData.kind || 'supporting-book')},
          status = ${String(extraData.status || 'uploaded')},
          is_active = ${extraData.isActive !== false},
          is_primary = ${Boolean(extraData.isPrimary)},
          ruleset_id = ${rulesetId ? Number(rulesetId) : null},
          session_id = ${sessionId ? Number(sessionId) : null},
          reindex_requested = true,
          filename = ${storedFile.filename},
          mime_type = ${storedFile.mimeType},
          filesize = ${storedFile.filesize},
          updated_at = now()
        WHERE id = ${Number(existing.id)}
      `,
    })
  } else {
    const inserted = await db.execute({
      drizzle: db.drizzle,
      sql: sql`
        INSERT INTO documents (
          title,
          slug,
          kind,
          status,
          is_active,
          is_primary,
          ruleset_id,
          session_id,
          reindex_requested,
          filename,
          mime_type,
          filesize
        ) VALUES (
          ${document.title},
          ${document.slug},
          ${String(extraData.kind || 'supporting-book')},
          ${String(extraData.status || 'uploaded')},
          ${extraData.isActive !== false},
          ${Boolean(extraData.isPrimary)},
          ${rulesetId ? Number(rulesetId) : null},
          ${sessionId ? Number(sessionId) : null},
          true,
          ${storedFile.filename},
          ${storedFile.mimeType},
          ${storedFile.filesize}
        )
        RETURNING id
      `,
    })

    docId = String(inserted.rows[0]?.id || '')
  }

  if (!docId) {
    throw new Error(`Failed to create bootstrap document record for ${document.slug}.`)
  }

  const storedDoc = (await payload.findByID({
    collection: 'documents',
    id: docId,
    overrideAccess: true,
  } as never)) as unknown as BootstrapRecord

  await ingestDocument(payload, storedDoc as never)

  return (await payload.findByID({
    collection: 'documents',
    id: docId,
    overrideAccess: true,
  } as never)) as unknown as BootstrapRecord
}

async function ensureSeedFiles() {
  await fs.mkdir(seedRoot, { recursive: true })
  await fs.mkdir(uploadRoot, { recursive: true })
}

async function ensureSchemaRepairs(payload: Payload) {
  const db = payload.db as {
    drizzle: unknown
    execute: (args: { drizzle: unknown; sql: unknown }) => Promise<unknown>
  }

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      ALTER TABLE game_sessions_rels
      ADD COLUMN IF NOT EXISTS players_id integer
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      CREATE INDEX IF NOT EXISTS game_sessions_rels_players_id_idx
      ON game_sessions_rels (players_id)
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      ALTER TABLE payload_locked_documents_rels
      ADD COLUMN IF NOT EXISTS admins_id integer,
      ADD COLUMN IF NOT EXISTS players_id integer,
      ADD COLUMN IF NOT EXISTS player_mappings_id integer,
      ADD COLUMN IF NOT EXISTS campaigns_id integer,
      ADD COLUMN IF NOT EXISTS worlds_id integer,
      ADD COLUMN IF NOT EXISTS rulesets_id integer,
      ADD COLUMN IF NOT EXISTS documents_id integer,
      ADD COLUMN IF NOT EXISTS game_sessions_id integer,
      ADD COLUMN IF NOT EXISTS provider_connections_id integer
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS owner_player_id integer
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      CREATE INDEX IF NOT EXISTS documents_owner_player_id_idx
      ON documents (owner_player_id)
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS personal_rulebook_id integer,
      ADD COLUMN IF NOT EXISTS status varchar(32) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS quota_tier varchar(32) DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS monthly_session_quota integer DEFAULT 12,
      ADD COLUMN IF NOT EXISTS monthly_voice_minutes integer DEFAULT 600,
      ADD COLUMN IF NOT EXISTS can_create_rooms boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS access_notes text
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      CREATE INDEX IF NOT EXISTS players_personal_rulebook_id_idx
      ON players (personal_rulebook_id)
    `,
  })

  await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      UPDATE players
      SET
        status = COALESCE(status, 'active'),
        quota_tier = COALESCE(quota_tier, 'standard'),
        monthly_session_quota = COALESCE(monthly_session_quota, 12),
        monthly_voice_minutes = COALESCE(monthly_voice_minutes, 600),
        can_create_rooms = COALESCE(can_create_rooms, false)
    `,
  })
}

function getSeedMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.pdf') {
    return 'application/pdf'
  }

  if (extension === '.md') {
    return 'text/markdown'
  }

  return 'text/plain'
}

function relationId(input: { id?: string | number } | string | number | null | undefined): string | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input)
  }

  return input.id !== undefined ? String(input.id) : null
}

async function materializeSeedDocument(document: SeedDocument) {
  const extension = path.extname(document.filePath).toLowerCase() || '.txt'
  const data = await fs.readFile(document.filePath)
  const filename = `${document.slug}${extension}`
  const targetPath = path.join(uploadRoot, filename)
  await fs.writeFile(targetPath, data)

  return {
    filename,
    filesize: data.byteLength,
    mimeType: getSeedMimeType(document.filePath),
  }
}

export async function runBootstrap(payload: Payload): Promise<BootstrapSummary> {
  await ensureSeedFiles()
  await ensureSchemaRepairs(payload)
  const llmProvider = process.env.GOOGLE_API_KEY ? 'gemini' : 'openai'
  const llmModel = llmProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1-mini'

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
      status: 'uploaded',
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
      status: 'uploaded',
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
  } as never)

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
  } as never)

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
  } as never)

  await upsertGlobal(payload, 'runtime-defaults', {
    allowTextFallback: true,
    joinGreeting:
      'Welcome to the table. Introduce the current scene, confirm the player intent, and start with a strong first prompt.',
    llmModel,
    llmProvider,
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
    publicDescription:
      'Join a room, speak naturally, and let the GM keep the world coherent through active rulebooks and scene memory.',
    siteTitle: 'GameMaster',
    tagline: 'Voice-first tabletop sessions with admin-grade campaign control.',
  })

  return {
    adminEmail: bootstrapAdminEmail || 'existing',
    campaignId: String(campaign.id),
    sessionId: String(session.id),
  }
}
