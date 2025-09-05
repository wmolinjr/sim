import { getOAuthProviderStatus } from '@/app/(auth)/components/oauth-provider-checker'
import LoginForm from '@/app/(auth)/login/login-form'

// Force dynamic rendering to avoid prerender errors with search params
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const { githubAvailable, googleAvailable, wmjAuthAvailable, isProduction } = await getOAuthProviderStatus()

  return (
    <LoginForm
      githubAvailable={githubAvailable}
      googleAvailable={googleAvailable}
      wmjAuthAvailable={wmjAuthAvailable}
      isProduction={isProduction}
    />
  )
}
