import {NoAuthError} from "#shared/errors/no-auth.error";

export default async function validateUser() {
    const {fetch, user} = useUserSession();
    await fetch();
    if (!user.value) throw createError(new NoAuthError())
}
