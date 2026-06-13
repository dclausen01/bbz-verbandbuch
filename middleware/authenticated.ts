export default defineNuxtRouteMiddleware(async () => {
    const {fetch, user} = useUserSession()

    await fetch();

    if (!user.value) {
        return navigateTo('/login')
    }
})
