import axios from 'axios';

/**
 * Handles error message extraction from Axios or standard errors,
 * with support for localized connection error messages.
 * 
 * @param {Error} error - The error object to handle.
 * @param {Function} t - The translation function from useLanguage.
 * @returns {string} - The user-friendly error message.
 */
export const getErrorMessage = (error, t) => {
    // Check for Connection/Network errors
    if (axios.isAxiosError(error)) {
        if (!error.response || error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('network')) {
            return t('connection_error');
        }
        
        // If the backend returned a specific message
        if (error.response.data && error.response.data.message) {
            return error.response.data.message;
        }
    }

    // Standard error or fallback
    return error.message || t('something_went_wrong');
};

export default getErrorMessage;
