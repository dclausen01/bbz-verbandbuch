declare module '#auth-utils' {
    interface User {
        id: number
        // LDAP-Kennung (z. B. sAMAccountName)
        loginSub: string
        name: string
        role: string
    }

    interface UserSession {
        // Keine zusätzlichen Felder – die Identität liegt unter `user`.
    }

    interface SecureSessionData {
        // Add your own fields
    }
}

export {}
