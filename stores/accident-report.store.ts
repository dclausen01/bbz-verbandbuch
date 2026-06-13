import {defineStore} from 'pinia'
import {type AccidentReport, AccidentReportSchema} from "#shared/schemas/accident-report.schema";
import {useSnackBar} from "#imports";
import validateUser from "~/composables/validate-user.composable";

export const useAccidentReportStore = defineStore('accidentReportStore', {
    state: () => ({
        _route: '/entry',
        _accidentReports: [] as AccidentReport[]
    }),
    getters: {
        accidentReports: (state) => state._accidentReports
    },
    actions: {
        toDTO(accidentReport: AccidentReport) {
            return {
                kitId: accidentReport.kit.id,
                occurredAt: accidentReport.occurredAt,
                injuredPerson: accidentReport.injuredPerson,
                injuredGroup: accidentReport.injuredGroup,
                accidentLocation: accidentReport.accidentLocation,
                description: accidentReport.description,
                firstAider: accidentReport.firstAider,
                materialList: accidentReport.materialList,
                message: accidentReport.message,
                incident: accidentReport.incident,
                measures: accidentReport.measures,
                witness: accidentReport.witness,
                reportable: accidentReport.reportable,
            }
        },
        async getAllAccidentReportsForUser(): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();

            const result = await $msFetch(this._route)
            const parsedData = AccidentReportSchema.array().safeParse(result)

            if (!parsedData.success) throw createError(parsedData.error)

            this._accidentReports = parsedData.data;
        },
        async getAccidentReportById(id: string): Promise<AccidentReport> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const result = await $msFetch(`${this._route}/${id}`)

            const parsedData = AccidentReportSchema.safeParse(result)

            if (!parsedData.success) throw createError(parsedData.error)

            return parsedData.data;
        },
        async saveAccidentReport(accidentReport: AccidentReport): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(this._route, {
                method: "POST",
                body: this.toDTO(accidentReport)
            })
            showSnackbarSuccess("Der Verbandsbucheintrag wurde erfolgreich gespeichert.")
        },

        async updateReport(accidentReport: AccidentReport): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();

            await $msFetch(`${this._route}/${accidentReport.id}`, {
                method: "PUT",
                body: this.toDTO(accidentReport)
            })
            showSnackbarSuccess("Der Verbandsbucheintrag wurde erfolgreich aktualisiert.")
        },

        async deleteAccidentReport(id: string): Promise<void> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            const {showSnackbarSuccess} = useSnackBar();
            await $msFetch(`${this._route}/${id}`, {
                method: "DELETE"
            })
            showSnackbarSuccess("Der Verbandsbucheintrag wurde erfolgreich gelöscht.")
        },

        async getRevisions(id: string): Promise<any[]> {
            await validateUser();
            const {$msFetch} = useNuxtApp();
            return await $msFetch(`${this._route}/${id}/revisions`)
        },
    },
})
