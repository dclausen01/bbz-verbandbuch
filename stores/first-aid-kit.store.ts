import validateUser from "~/composables/validate-user.composable";
import {type FirstAidKit, FirstAidKitSchema} from "#shared/schemas/first-aid-kit.schema";
import {type Product, ProductSchema} from "#shared/schemas/product.schema";
import {useSnackBar} from "#imports";

export const useFirstAidKitStore = defineStore('first-aid-kit-store', {
    state: () => ({
        _route: '/firstAidKit',
        _productRoute: '/product',
        _firstAidKits: [] as FirstAidKit[],
        _products: [] as Product[]
    }),
    actions: {
        async getAllFirstAidKits(): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();

            const result = await $msFetch(this._route)
            const parsedData = FirstAidKitSchema.array().safeParse(result)

            if (!parsedData.success) throw createError(parsedData.error)

            this._firstAidKits = parsedData.data
        },
        async getAllProducts(): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();

            const result = await $msFetch(this._productRoute)
            const parsedData = ProductSchema.array().safeParse(result)

            if (!parsedData.success) throw createError(parsedData.error)

            this._products = parsedData.data
        },
        async createFirstAidKit(code: string, location: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(this._route, {method: "POST", body: {code, location}})
            showSnackbarSuccess("Verbandkasten wurde angelegt.")
            await this.getAllFirstAidKits()
        },
        async updateFirstAidKit(id: string, code: string, location: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(`${this._route}/${id}`, {method: "PUT", body: {code, location}})
            showSnackbarSuccess("Verbandkasten wurde aktualisiert.")
            await this.getAllFirstAidKits()
        },
        async deleteFirstAidKit(id: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(`${this._route}/${id}`, {method: "DELETE"})
            showSnackbarSuccess("Verbandkasten wurde gelöscht.")
            await this.getAllFirstAidKits()
        },
        async createProduct(type: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(this._productRoute, {method: "POST", body: {type}})
            showSnackbarSuccess("Material wurde angelegt.")
            await this.getAllProducts()
        },
        async deleteProduct(id: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(`${this._productRoute}/${id}`, {method: "DELETE"})
            showSnackbarSuccess("Material wurde gelöscht.")
            await this.getAllProducts()
        }
    },
    getters: {
        firstAidKits: (state) => state._firstAidKits,
        products: (state) => state._products
    },
})
