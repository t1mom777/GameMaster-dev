import { getPayload } from 'payload'

import { runBootstrap } from '../lib/bootstrap'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const result = await runBootstrap(payload)
  process.stdout.write(
    `Bootstrap complete: admin=${result.adminEmail}, campaign=${result.campaignId}, session=${result.sessionId}\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
