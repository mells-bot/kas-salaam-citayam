import { NextResponse } from 'next/server'
import { hapusSesi } from '@/lib/auth'

/// Logout lewat form POST agar tombolnya tetap berfungsi tanpa JavaScript.
export async function POST(request: Request) {
  await hapusSesi()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
