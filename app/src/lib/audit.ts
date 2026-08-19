import 'server-only'
import { db } from './db'
import type { Sesi } from './auth'

/// Menulis jejak audit (F-10). Sengaja tidak pernah melempar error:
/// kegagalan mencatat log tidak boleh membatalkan transaksi keuangan yang sah.
export async function catatAudit(opts: {
  aktor: Sesi | null
  aksi: string
  entitas: string
  entitasId?: string | null
  ringkasan: string
  detail?: unknown
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: opts.aktor?.userId ?? null,
        actorNama: opts.aktor ? `${opts.aktor.nama} (${opts.aktor.role})` : 'Sistem',
        aksi: opts.aksi,
        entitas: opts.entitas,
        entitasId: opts.entitasId ?? null,
        ringkasan: opts.ringkasan,
        detail: opts.detail === undefined ? null : JSON.stringify(opts.detail),
      },
    })
  } catch (e) {
    console.error('[audit] gagal mencatat log:', e)
  }
}
