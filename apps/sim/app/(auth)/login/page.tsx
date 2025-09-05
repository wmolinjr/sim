import { getOAuthProviderStatus } from '@/app/(auth)/components/oauth-provider-checker'
import LoginForm from '@/app/(auth)/login/login-form'
import WmjAuthRedirect from '@/app/(auth)/login/wmj-auth-redirect'

// Force dynamic rendering to avoid prerender errors with search params
export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams?: { manual?: string } }) {
  const { githubAvailable, googleAvailable, wmjAuthAvailable, isProduction } =
    await getOAuthProviderStatus()

  if (wmjAuthAvailable) {
    return <WmjAuthRedirect />
  }

  return (
    <LoginForm
      githubAvailable={githubAvailable}
      googleAvailable={googleAvailable}
      wmjAuthAvailable={wmjAuthAvailable}
      isProduction={isProduction}
    />
  )
}
