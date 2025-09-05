'use server'

import { env } from '@/lib/env'
import { isProd } from '@/lib/environment'

export async function getOAuthProviderStatus() {
  // Disable all providers except WMJ Auth
  const githubAvailable = false
  const googleAvailable = false

  // WMJ Auth is now the primary provider
  const wmjAuthAvailable = !!(
    env.WMJ_AUTH_CLIENT_ID &&
    env.WMJ_AUTH_CLIENT_SECRET &&
    env.WMJ_AUTH_CLIENT_ID !== 'placeholder' &&
    env.WMJ_AUTH_CLIENT_SECRET !== 'placeholder'
  )

  return { githubAvailable, googleAvailable, wmjAuthAvailable, isProduction: isProd }
}
