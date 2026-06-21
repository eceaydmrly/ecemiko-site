require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const FIRESTORE_PROJECT = process.env.FIRESTORE_PROJECT || 'ecemikouygulamakeysistemi';
const FIRESTORE_API_KEY = process.env.FIRESTORE_API_KEY || 'AIzaSyADHMOGXr38ltWu6NLKG0qEagN9DQ2N3JI';

function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ECW-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function uploadKey(code) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/accounts/_key_${code}?key=${FIRESTORE_API_KEY}`;
    try {
        await axios.patch(url, {
            fields: {
                package: { stringValue: 'premium' }
            }
        });
        return { success: true, code };
    } catch (error) {
        console.error(`Failed to upload key ${code}:`, error.response ? error.response.data : error.message);
        return { success: false, code };
    }
}

async function main() {
    const codesCount = 200;
    const codes = [];
    
    // Generate 200 unique random codes
    while (codes.length < codesCount) {
        const newCode = generateRandomCode();
        if (!codes.includes(newCode)) {
            codes.push(newCode);
        }
    }

    console.log(`Successfully generated ${codesCount} codes.`);
    console.log('Writing codes to "generated_keys.txt"...');
    fs.writeFileSync('generated_keys.txt', codes.join('\n'), 'utf8');
    console.log('File "generated_keys.txt" written successfully.');

    console.log('Starting upload of 200 keys to Firestore database...');
    
    let uploadedCount = 0;
    // Process uploads in small chunks of 10 concurrent requests to not overwhelm connection/rate limits
    const chunkSize = 10;
    for (let i = 0; i < codes.length; i += chunkSize) {
        const chunk = codes.slice(i, i + chunkSize);
        const promises = chunk.map(code => uploadKey(code));
        const results = await Promise.all(promises);
        
        const successCount = results.filter(r => r.success).length;
        uploadedCount += successCount;
        console.log(`Uploaded progress: ${i + chunk.length}/${codesCount} (${successCount} successful in this batch)`);
        
        // Brief 100ms pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nAll done! Successfully uploaded ${uploadedCount} out of ${codesCount} keys to Firestore.`);
    console.log('You can find all generated keys in the "generated_keys.txt" file in your project directory.');
}

main();
