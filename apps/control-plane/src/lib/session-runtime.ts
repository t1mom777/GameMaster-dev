import type { Payload } from 'payload'

type SessionRecord = {
  activeDocuments?: Array<{ id?: string | number } | string | number> | null
  id: string | number
  roomName?: string | null
  ruleset?: { id?: string | number } | string | number | null
  title?: string | null
  welcomeText?: string | null
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

export async function loadRuntimeContext(payload: Payload, session: SessionRecord) {
  const runtimeDefaults = await payload.findGlobal({
    overrideAccess: true,
    slug: 'runtime-defaults',
  })

  let activeDocumentIds =
    session.activeDocuments
      ?.map((document) => relationId(document))
      .filter((value): value is string => Boolean(value)) || []

  if (!activeDocumentIds.length && session.ruleset) {
    const rulesetId = relationId(session.ruleset)
    const documents = await payload.find({
      collection: 'documents',
      depth: 0,
      limit: 50,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          {
            isActive: {
              equals: true,
            },
          },
          {
            ruleset: {
              equals: rulesetId,
            },
          },
        ],
      },
    })
    activeDocumentIds = documents.docs.map((document) => String(document.id))
  }

  return {
    runtimeDefaults,
    sessionSummary: {
      id: session.id,
      roomName: session.roomName || String(session.id),
      title: session.title || 'Session',
      welcomeText: session.welcomeText || '',
    },
    activeDocumentIds,
  }
}
