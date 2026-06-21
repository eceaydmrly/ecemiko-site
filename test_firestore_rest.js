require('dotenv').config();
const axios = require('axios');

const FIRESTORE_PROJECT = process.env.FIRESTORE_PROJECT;
const FIRESTORE_API_KEY = process.env.FIRESTORE_API_KEY;

async function testQuery() {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/keys/ECW-A3X7?key=${FIRESTORE_API_KEY}`;
        const res = await axios.get(url);
        console.log("Success! Key found:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log("Key might not exist or error:", e.response ? e.response.status : e.message);
        if (e.response) {
            console.log("Details:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

testQuery();
