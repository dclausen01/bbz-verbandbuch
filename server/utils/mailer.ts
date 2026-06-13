import nodemailer from 'nodemailer'
import type {EntryDTO} from './db'

/**
 * Optionaler E-Mail-Versand für meldepflichtige Unfälle. Bewusst „best effort":
 * Schlägt der Versand fehl oder ist kein SMTP konfiguriert, wird das Anlegen
 * eines Eintrags NICHT blockiert.
 *
 * Es wird KEIN Exchange-Zugriff benötigt – es genügt ein beliebiges
 * SMTP-Konto, z. B. ein auf dem Plesk-Server eingerichtetes Postfach
 * (SMTP_HOST=localhost). Konfiguration über Umgebungsvariablen:
 *   SMTP_HOST, SMTP_PORT (Default 587), SMTP_SECURE (true für 465),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM, BGM_NOTIFY_EMAIL (Empfänger).
 */
export async function sendReportableNotification(entry: EntryDTO): Promise<boolean> {
    const host = process.env.SMTP_HOST
    const to = process.env.BGM_NOTIFY_EMAIL
    if (!host || !to) return false // nicht konfiguriert → still überspringen

    try {
        const transport = nodemailer.createTransport({
            host,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
                ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? ''}
                : undefined,
        })

        const occurred = new Date(entry.occurredAt).toLocaleString('de-DE')
        await transport.sendMail({
            from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? `verbandbuch@${host}`,
            to,
            subject: `Meldepflichtiger Unfall – ${entry.injuredPerson} (${occurred})`,
            text: [
                'Im Verbandbuch wurde ein als MELDEPFLICHTIG gekennzeichneter Unfall erfasst.',
                '',
                `Verletzte Person: ${entry.injuredPerson}${entry.injuredGroup ? ` (${entry.injuredGroup})` : ''}`,
                `Zeitpunkt:        ${occurred}`,
                `Ort:              ${entry.accidentLocation}`,
                `Verletzung:       ${entry.incident}`,
                `Hergang:          ${entry.description}`,
                `Erste Hilfe:      ${entry.measures ?? '—'}`,
                `Ersthelfer:in:    ${entry.firstAider}`,
                '',
                'Bitte prüfen, ob eine Unfallanzeige an den Unfallversicherungsträger',
                'erforderlich ist (i. d. R. bei mehr als 3 Tagen Arbeits-/Schulunfähigkeit',
                'oder tödlichem Ausgang).',
            ].join('\n'),
        })
        return true
    } catch (e) {
        console.error('[MAIL] Versand der Meldung fehlgeschlagen (Eintrag wurde trotzdem gespeichert):', e)
        return false
    }
}
