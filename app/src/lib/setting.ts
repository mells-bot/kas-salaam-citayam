import { db } from './db'

/// Pembacaan pengaturan dengan nilai bawaan, supaya halaman tidak pernah
/// gagal render hanya karena satu baris setting belum ada.
export async function ambilSetting(key: string, bawaan = ''): Promise<string> {
  const s = await db.setting.findUnique({ where: { key } })
  return s?.value ?? bawaan
}

export async function namaCluster() {
  return ambilSetting('nama_cluster', 'Cluster Salaam Citayam')
}

export async function simpanSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
