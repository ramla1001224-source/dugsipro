const axios = require('axios');
require('dotenv').config();
const prisma = require('../prisma');

/**
 * Sends an SMS using the generic SMS API (e.g. Golis).
 * @param {string} phone - The recipient's phone number.
 * @param {string} message - The SMS text to send.
 * @returns {Promise<Object>} - The response from the API or a simulated success object.
 */
const { sendSMS } = require('../services/smsService');

/**
 * Sends an SMS using the centralized SMS Service.
 * This is a legacy wrapper to ensure compatibility with existing routes like exams.
 * @param {string} phone - The recipient's phone number.
 * @param {string} message - The SMS text to send.
 * @returns {Promise<Object>} - The response object.
 */
const sendGolisSMS = async (phone, message) => {
    // Note: This helper doesn't have schoolId context in its current signature.
    // We try to find the schoolId from the global settings or default to a generic one.
    // However, most routes using this should be updated to use sendSMS directly.
    
    // For now, we attempt to find a schoolId to satisfy the service requirements.
    // If not possible, the service might fail, but this pushes for better integration.
    const result = await sendSMS(phone, message, { type: 'legacy_helper' });
    return result;
};

module.exports = {
    sendGolisSMS
};
