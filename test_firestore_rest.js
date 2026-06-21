require('dotenv').config();
const axios = require('axios');

const FIRESTORE_PROJECT = process.env.FIRESTORE_PROJECT || 'ecemikouygulamakeysistemi';
const FIRESTORE_API_KEY = process.env.FIRESTORE_API_KEY || 'AIzaSyADHMOGXr38ltWu6NLKG0qEagN9DQ2N3JI';

async function testQuery() {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:runAggregationQuery?key=${FIRESTORE_API_KEY}`;
        const body = {
            structuredAggregationQuery: {
                aggregations: [{ alias: 'count', count: {} }],
                structuredQuery: {
                    from: [{ collectionId: 'accounts' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'email' },
                            op: 'GREATER_THAN_OR_EQUAL',
                            value: { stringValue: '' }
                        }
                    }
                }
            }
        };
        const res = await axios.post(url, body);
        console.log("Success! Response data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log("Error:", e.response ? e.response.status : e.message);
        if (e.response) {
            console.log("Details:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

testQuery();
