import supabase from '../config/supabase.js';

/**
 * Generate unique Patient ID in format: PT-YYYY-XXXX
 * This function ensures the ID is unique and persistent across devices
 * @param {string} userId - User UUID
 * @returns {Promise<string>} - Generated Patient ID
 */
export async function generatePatientId(userId) {
    try {
        // First, check if patient already has an ID
        const { data: existingPatient, error: checkError } = await supabase
            .from('patients')
            .select('patient_id')
            .eq('user_id', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw checkError;
        }

        // If patient already has an ID, return it (multi-device consistency)
        if (existingPatient && existingPatient.patient_id) {
            return existingPatient.patient_id;
        }

        // Generate new ID using database function
        const { data, error } = await supabase
            .rpc('generate_patient_id');

        if (error) {
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error generating patient ID:', error);
        throw new Error('Failed to generate patient ID');
    }
}

/**
 * Check if patient ID already exists
 * @param {string} patientId - Patient ID to check
 * @returns {Promise<boolean>} - True if exists, false otherwise
 */
export async function patientIdExists(patientId) {
    try {
        const { data, error } = await supabase
            .from('patients')
            .select('id')
            .eq('patient_id', patientId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    } catch (error) {
        console.error('Error checking patient ID:', error);
        return false;
    }
}

/**
 * Get patient ID for a user
 * @param {string} userId - User UUID
 * @returns {Promise<string|null>} - Patient ID or null if not found
 */
export async function getPatientId(userId) {
    try {
        const { data, error } = await supabase
            .from('patients')
            .select('patient_id')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data?.patient_id || null;
    } catch (error) {
        console.error('Error getting patient ID:', error);
        return null;
    }
}
/**
 * Generate unique Patient ID in format: MT-XXXXXX
 * @returns {string} - Generated MT Patient ID
 */
export function generateMTPatientId() {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `MT-${random}`;
}
