const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
require('dotenv').config();

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
    (process.env.GOOGLE_CLIENT_ID || '').trim(),
    (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    'http://localhost'
);

// Set credentials from refresh token
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

/**
 * Parses the PostgreSQL connection string safely.
 */
function parseDatabaseUrl(connectionString) {
    try {
        const url = new URL(connectionString);
        return {
            user: url.username,
            password: decodeURIComponent(url.password),
            host: url.hostname,
            port: url.port || '5432',
            database: url.pathname.substring(1).split('?')[0] // Remove leading slash and query params
        };
    } catch (error) {
        console.error('[BACKUP] Failed to parse database URL:', error.message);
        return null;
    }
}

/**
 * Authenticates with Google Drive API
 */
async function authenticateGoogleDrive() {
    return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Performs a database backup and uploads it to Google Drive
 */
async function performBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `dugsi-pro-backup-${timestamp}.sql`;
    const tempFilePath = path.join(os.tmpdir(), fileName);
    
    console.log(`[BACKUP] Starting backup: ${fileName}`);

    try {
        const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_URL not found in .env');

        const dbConfig = parseDatabaseUrl(dbUrl);
        if (!dbConfig) throw new Error('Could not parse database connection string');

        // Execute pg_dump
        const dumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F c -f "${tempFilePath}"`;
        
        await new Promise((resolve, reject) => {
            exec(dumpCommand, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[BACKUP] pg_dump error: ${error.message}`);
                    return reject(error);
                }
                resolve();
            });
        });

        console.log(`[BACKUP] Database dumped to temporary file: ${tempFilePath}`);

        // Upload to Google Drive using OAuth2
        const drive = await authenticateGoogleDrive();
        
        const fileMetadata = {
            name: fileName,
            parents: ['1FOfg0DVztqcl6PTQLnlBUDt8E35J-y2Z'] // Shared folder ID
        };
        
        const media = {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(tempFilePath),
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
            supportsAllDrives: true,
        });

        console.log(`[BACKUP] Successfully uploaded to Google Drive. File ID: ${response.data.id}`);

        // Cleanup temporary file
        fs.unlinkSync(tempFilePath);
        return { success: true, fileId: response.data.id };

    } catch (error) {
        console.error(`[BACKUP] Backup failed:`, error);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw error;
    }
}

/**
 * Lists backups available on Google Drive
 */
async function listBackups() {
    try {
        const drive = await authenticateGoogleDrive();
        const response = await drive.files.list({
            q: "name contains 'dugsi-pro-backup-'",
            pageSize: 10,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        return response.data.files;
    } catch (error) {
        console.error('[RESTORE] Failed to list backups:', error);
        throw error;
    }
}

/**
 * Downloads a specific backup from Google Drive
 */
async function downloadBackup(fileId, destinationPath) {
    try {
        const drive = await authenticateGoogleDrive();
        const dest = fs.createWriteStream(destinationPath);
        
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
        );

        return new Promise((resolve, reject) => {
            response.data
                .on('end', () => resolve())
                .on('error', err => reject(err))
                .pipe(dest);
        });
    } catch (error) {
        console.error('[RESTORE] Failed to download backup:', error);
        throw error;
    }
}

module.exports = {
    performBackup,
    listBackups,
    downloadBackup
};
