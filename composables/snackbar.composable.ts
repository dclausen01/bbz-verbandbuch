export const useSnackBar = () => {
    const snackbar = useState('snackbar', () => ({
        show: false,
        message: '',
        color: 'error' as 'error' | 'success' | 'warning',
    }))

    function showSnackbarError(message: string) {
        snackbar.value = {show: true, message, color: 'error'}
    }

    function showSnackbarSuccess(message: string) {
        snackbar.value = {show: true, message, color: 'success'}
    }

    return {snackbar, showSnackbarError, showSnackbarSuccess}
}