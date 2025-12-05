import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[Auth Callback] Received request:', { code: !!code, origin, next })

  if (code) {
    try {
      const supabase = await createClient()
      console.log('[Auth Callback] Exchanging code for session...')

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('[Auth Callback] Exchange error:', error)
        return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
      }

      console.log('[Auth Callback] Getting user...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        console.error('[Auth Callback] Get user error:', userError)
        return NextResponse.redirect(`${origin}/login?error=user_failed`)
      }

      console.log('[Auth Callback] User email:', user?.email)

      if (user?.email?.endsWith('@studiohawk.com.au')) {
        console.log('[Auth Callback] Valid StudioHawk email, redirecting to dashboard')
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.log('[Auth Callback] Not a StudioHawk email, signing out')
        // Sign out non-studiohawk users
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }
    } catch (err) {
      console.error('[Auth Callback] Unexpected error:', err)
      return NextResponse.redirect(`${origin}/login?error=server_error`)
    }
  }

  console.log('[Auth Callback] No code provided')
  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
