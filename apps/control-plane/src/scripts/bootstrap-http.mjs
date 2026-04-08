const bootstrapToken = process.env.GM_INTERNAL_API_TOKEN || ''
const bootstrapAdminEmail = process.env.GM_BOOTSTRAP_ADMIN_EMAIL || ''
const bootstrapAdminPassword = process.env.GM_BOOTSTRAP_ADMIN_PASSWORD || ''
const port = process.env.PORT || '3000'
const baseUrl = process.env.GM_BOOTSTRAP_URL || `http://127.0.0.1:${port}`
const healthUrl = `${baseUrl}/api/gm/health`
const bootstrapUrl = `${baseUrl}/api/gm/internal/bootstrap`
const maxAttempts = 60
const retryDelayMs = 2000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth() {
  let lastError = 'healthcheck_unavailable'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl)
      if (response.ok) {
        return
      }
      lastError = `healthcheck_status_${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await sleep(retryDelayMs)
  }

  throw new Error(`Control plane did not become healthy: ${lastError}`)
}

async function main() {
  if (!bootstrapToken) {
    console.log('Bootstrap skipped: GM_INTERNAL_API_TOKEN is not configured.')
    return
  }

  if (!bootstrapAdminEmail || !bootstrapAdminPassword) {
    console.log('Bootstrap skipped: admin bootstrap credentials are not configured.')
    return
  }

  await waitForHealth()
  try {
    const response = await fetch(bootstrapUrl, {
      body: JSON.stringify({ trigger: 'entrypoint' }),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bootstrapToken}`,
        'x-gm-internal-token': bootstrapToken,
      },
      method: 'POST',
    })

    if (!response.ok) {
      const message = await response.text()
      console.error(`Bootstrap warning: request failed with ${response.status}: ${message.slice(0, 500)}`)
      return
    }

    const result = await response.json()
    console.log(
      `Bootstrap complete: admin=${result.adminEmail || 'existing'}, campaign=${result.campaignId}, session=${result.sessionId}`,
    )
  } catch (error) {
    console.error(`Bootstrap warning: ${error instanceof Error ? error.message : String(error)}`)
  }
}

main()
