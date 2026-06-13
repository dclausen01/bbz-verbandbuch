import {z} from "zod"

export const FirstAidKitSchema = z.object({
    id: z.uuid(),
    code: z.string(),
    location: z.string(),
    createdAt: z.string().transform((val) => new Date(val))
})

export type FirstAidKit = z.infer<typeof FirstAidKitSchema>