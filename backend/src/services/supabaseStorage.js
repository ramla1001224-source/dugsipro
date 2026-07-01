const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'dugsi-pro';

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false
        }
    });
} else {
    console.warn('[Supabase Storage Warning]: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. File uploads will fail.');
}

/**
 * Uploads a file buffer to Supabase Storage
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @param {string} folder 
 * @param {string} originalFilename 
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadFile(fileBuffer, mimeType, folder, originalFilename) {
    const extension = path.extname(originalFilename);
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${extension}`;
    const uniqueFilename = `${folder}/${filename}`;

    if (!supabase) {
        // Fallback to local upload
        const fs = require('fs');
        const uploadDir = path.join(__dirname, '../../uploads', folder);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const localPath = path.join(uploadDir, filename);
        fs.writeFileSync(localPath, fileBuffer);
        
        // Return local URL format matching what deleteFile expects
        return `/uploads/${folder}/${filename}`;
    }

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(uniqueFilename, fileBuffer, {
            contentType: mimeType,
            upsert: true
        });

    if (error) {
        console.error('[Supabase Upload Error]:', error);
        throw error;
    }

    const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueFilename);

    return urlData.publicUrl;
}

/**
 * Deletes a file from Supabase Storage or local filesystem depending on its URL
 * @param {string} fileUrl 
 * @returns {Promise<any>}
 */
async function deleteFile(fileUrl) {
    if (!fileUrl) return;

    // Check if it's a local upload
    if (fileUrl.includes('/uploads/')) {
        const fs = require('fs');
        const cleanPath = fileUrl.split('/uploads/')[1];
        const localPath = path.join(__dirname, '../../uploads', cleanPath);
        if (fs.existsSync(localPath)) {
            try {
                fs.unlinkSync(localPath);
            } catch (err) {
                console.error(`[Local Delete Error] Failed to delete local file ${localPath}:`, err);
            }
        }
        return;
    }

    // Otherwise, check if it's a Supabase URL
    if (fileUrl.includes('/storage/v1/object/public/')) {
        if (!supabase) {
            throw new Error('Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        }

        const parts = fileUrl.split('/storage/v1/object/public/');
        if (parts.length > 1) {
            // parts[1] is "<bucket-name>/<file-path>"
            const subParts = parts[1].split('/');
            const urlBucket = subParts[0];
            const filePath = subParts.slice(1).join('/');

            const { data, error } = await supabase.storage
                .from(urlBucket)
                .remove([filePath]);

            if (error) {
                console.error(`[Supabase Delete Error] Failed to delete file from bucket '${urlBucket}': ${filePath}`, error);
                throw error;
            }
            return data;
        }
    }
}

module.exports = {
    uploadFile,
    deleteFile
};
