import {z} from "zod"
import {FirstAidKitSchema} from "#shared/schemas/first-aid-kit.schema";
import type User from "#shared/types/nuxt-auth-utils"

export const AccidentReportSchema = z.object({
    id: z.uuid(),
    kit: FirstAidKitSchema,
    createdBy: z.custom<typeof User>(),
    // Zeitpunkt des Vorfalls (nicht nur "wann gespeichert")
    occurredAt: z.string().transform((val) => new Date(val)),
    // Zeitpunkt der Eintragung (Dokumentationsdatum)
    createdAt: z.string().transform((val) => new Date(val)).optional(),
    // Name der verletzten Person (Pflichtangabe)
    injuredPerson: z.string().default(''),
    // Personengruppe (z.B. Schüler:in, Beschäftigte:r) – optional
    injuredGroup: z.string().nullable().default(null),
    // Ort des Unfalls (Pflichtangabe)
    accidentLocation: z.string().default(''),
    // Unfallart
    incident: z.string(),
    // Hergang
    description: z.string(),
    measures: z.string().optional().nullable(),
    firstAider: z.string(),
    // Materialliste
    materialList: z.array(z.object({
        type: z.string(),
        quantity: z.number()
    })).default([]),
    // Entnommenes Material
    message: z.string().nullable().default(null),
    // Zeuge
    witness: z.string().nullable().default(null),
    // Meldepflichtiger Unfall (Unfallanzeige an den Unfallversicherungsträger)
    reportable: z.boolean().default(false),
})

export type AccidentReport = z.infer<typeof AccidentReportSchema>