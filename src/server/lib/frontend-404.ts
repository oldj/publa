import { matchRedirectRule } from '@/server/services/redirect-rules'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export async function redirectOrNotFound(pathname: string): Promise<never> {
  const matchedRule = await matchRedirectRule(pathname)

  if (matchedRule) {
    if (matchedRule.permanent) {
      permanentRedirect(matchedRule.destination)
    }

    redirect(matchedRule.destination)
  }

  notFound()
}

export async function redirectResponseOrNotFound(
  pathname: string,
  request: Request,
  body = 'Not Found',
) {
  const matchedRule = await matchRedirectRule(pathname)

  if (matchedRule) {
    const destination = matchedRule.destination.startsWith('/')
      ? new URL(matchedRule.destination, request.url)
      : matchedRule.destination

    return NextResponse.redirect(destination, {
      status: matchedRule.permanent ? 308 : 307,
    })
  }

  return new NextResponse(body, { status: 404 })
}
