import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Admins } from './collections/Admins'
import { Campaigns } from './collections/Campaigns'
import { Documents } from './collections/Documents'
import { GameSessions } from './collections/GameSessions'
import { Players } from './collections/Players'
import { ProviderConnections } from './collections/ProviderConnections'
import { Rulesets } from './collections/Rulesets'
import { Worlds } from './collections/Worlds'
import { adminReindexDocumentEndpoint } from './endpoints/admin-reindex-document'
import { healthEndpoint } from './endpoints/health'
import { publicJoinEndpoint } from './endpoints/public-join'
import { publicSessionsEndpoint } from './endpoints/public-sessions'
import { runtimeRetrieveEndpoint } from './endpoints/runtime-retrieve'
import { runtimeSessionEndpoint } from './endpoints/runtime-session'
import { RuntimeDefaults } from './globals/RuntimeDefaults'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Admins.slug,
  },
  collections: [
    Admins,
    Players,
    Campaigns,
    Worlds,
    Rulesets,
    Documents,
    GameSessions,
    ProviderConnections,
  ],
  editor: lexicalEditor(),
  endpoints: [
    healthEndpoint,
    publicSessionsEndpoint,
    publicJoinEndpoint,
    runtimeSessionEndpoint,
    runtimeRetrieveEndpoint,
    adminReindexDocumentEndpoint,
  ],
  globals: [RuntimeDefaults, SiteSettings],
  routes: {
    admin: '/t1m0m',
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: true,
  }),
  sharp,
})
