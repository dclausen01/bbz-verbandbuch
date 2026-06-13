import {z} from "zod";

export const MaterialSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    unit: z.string()
})

export type Material = z.infer<typeof MaterialSchema>