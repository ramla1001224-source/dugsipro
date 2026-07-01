/**
 * Utility for standardized API responses
 */
const responseHelper = {
    /**
     * Send a success response
     * @param {Object} res - Express response object
     * @param {any} data - Data to send
     * @param {string} message - Success message
     * @param {number} code - HTTP status code
     */
    success: (res, data = null, message = 'Success', code = 200) => {
        return res.status(code).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Send an error response
     * @param {Object} res - Express response object
     * @param {string} message - Error message for user
     * @param {any} error - Original error details (optional)
     * @param {number} code - HTTP status code
     */
    error: (res, message = 'An error occurred', error = null, code = 500) => {
        console.error(`API Error: ${message}`, error);
        return res.status(code).json({
            success: false,
            message,
            error: error ? (error.message || error) : null,
            code,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = responseHelper;
