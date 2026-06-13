import {z} from "zod"

export const ProductSchema = z.object({
    id: z.uuid(),
    type: z.string()
})

export type Product = z.infer<typeof ProductSchema>