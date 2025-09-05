'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { client } from '@/lib/auth-client'

export default function WmjAuthRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleWmjAuthRedirect = async () => {
      try {
        // Pega o callbackURL dos parâmetros ou usa o padrão
        const callbackURL = searchParams?.get('callbackUrl') || '/workspace'

        // Redireciona automaticamente para WMJ Auth
        await client.signIn.oauth2({
          providerId: 'wmj-auth',
          callbackURL,
        })

        // Marca que o usuário já logou anteriormente
        if (typeof window !== 'undefined') {
          localStorage.setItem('has_logged_in_before', 'true')
          document.cookie = 'has_logged_in_before=true; path=/; max-age=31536000; SameSite=Lax'
        }
      } catch (error) {
        console.error('Erro no redirecionamento WMJ Auth:', error)
        // Em caso de erro, redireciona para a página de login manual
        router.push('/login?manual=true')
      }
    }

    handleWmjAuthRedirect()
  }, [router, searchParams])

  return (
    <div className='flex min-h-screen items-center justify-center bg-neutral-900'>
      <div className='space-y-4 text-center'>
        <div
          className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-current·border-e-transparent border-solid align-[-0.125em] text-primary motion-reduce:animate-[spin_1.5s_linear_infinite]'
          role='status'
        >
          <span className='!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]'>
            Loading...
          </span>
        </div>
        <p className='text-white'>Redirecionando para WMJ Auth...</p>
        <p className='text-neutral-400 text-sm'>
          Você será redirecionado automaticamente para o sistema de autenticação.
        </p>
      </div>
    </div>
  )
}
