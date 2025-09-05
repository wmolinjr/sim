'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useBrandConfig } from '@/lib/branding/branding'
import { GridPattern } from '@/app/(landing)/components/grid-pattern'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = useBrandConfig()

  return (
    <main className='relative flex min-h-screen flex-col bg-[var(--brand-background-hex)] font-geist-sans text-white'>
      {/* Background pattern */}
      <GridPattern
        x={-5}
        y={-5}
        className='absolute inset-0 z-0 stroke-[#ababab]/5'
        width={90}
        height={90}
        aria-hidden='true'
      />

      {/* Header */}
      <div className='relative z-10 px-6 pt-9'>
        <div className='mx-auto max-w-7xl'>
          <Link href='/' className='inline-flex'>
            {brand.logoUrl ? (
              <Image
                src={brand.logoUrl}
                alt={`${brand.name} Logo`}
                width={56}
                height={56}
                className='h-[56px] w-[56px] object-contain'
              />
            ) : (
              <Image src='/sim.svg' alt={`${brand.name} Logo`} width={56} height={56} />
            )}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className='relative z-10 flex flex-1 items-center justify-center px-4 pb-6'>
        <div className='w-full max-w-md'>{children}</div>
      </div>
    </main>
  )
}
