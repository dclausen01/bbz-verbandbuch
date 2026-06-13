import {z} from "zod"
import {FirstAidKitSchema} from "#shared/schemas/first-aid-kit.schema";
import type User from "#shared/types/nuxt-auth-utils"

export const AccidentReportSchema = z.object({
    id: z.uuid(),
    kit: FirstAidKitSchema,
    createdBy: z.custom<typeof User>(),
    // Zeitpunkt des Vorfalls (nicht nur "wann gespeichert")
    occurredAt: z.string().transform((val) => new Date(val)),
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
})

export type AccidentReport = z.infer<typeof AccidentReportSchema>