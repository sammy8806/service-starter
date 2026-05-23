export function formatUptime(startedAt: number | undefined, now: number = Date.now()): string {
  if (startedAt === undefined || !Number.isFinite(startedAt)) return '—'

  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}
