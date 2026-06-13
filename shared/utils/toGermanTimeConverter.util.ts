export function formatDatetimeGerman(dt: string) {
    if (!dt) return '—'
    const [datePart, timePart] = dt.split('T')
    if (!datePart || !timePart) return dt

    const [y, m, d] = datePart.split('-')
    const hhmm = timePart.slice(0, 5)
    if (!y || !m || !d) return dt

    return `${d}.${m}.${y}, ${hhmm} Uhr`
}
