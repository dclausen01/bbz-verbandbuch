import {AppError} from "#shared/errors/app.error";
import {useSnackBar} from "#imports";
import {NoAuthError} from "#shared/errors/no-auth.error";
import type {NuxtError} from "#app";

export default defineNuxtPlugin((nuxtApp) => {
    // @ts-ignore
    nuxtApp.vueApp.config.errorHandler = async (error: NuxtError<unknown>) => {
        const {showSnackbarError} = useSnackBar();

        if (error.cause instanceof NoAuthError) {
            await navigateTo('/login')
            return;
        }

        if (error.cause instanceof AppError) {
            showSnackbarError(error.message)
            return;
        }

        console.error("[ERROR] handler: ", error);
        showError(error as Error)
    }
})