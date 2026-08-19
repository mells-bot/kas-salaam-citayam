import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kas Cluster Salaam Citayam',
  description: 'Sistem pencatatan keuangan iuran warga Cluster Salaam Citayam',
}

// Warga mengakses lewat HP (NF-03), jadi viewport diatur eksplisit.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f9f9f7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
