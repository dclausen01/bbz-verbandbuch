export class AppError extends Error {
    private readonly _date: Date

    constructor(userMessage: string) {
        super(userMessage);
        this._date = new Date();
    }
}