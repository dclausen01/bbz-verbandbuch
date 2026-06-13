import {AppError} from "#shared/errors/app.error";

export class NoAuthError extends AppError {
    constructor() {
        super("Nutzer ist nicht authentifiziert.");
    }
}