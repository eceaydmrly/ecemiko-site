const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin Setup
// const serviceAccount = {
//   "project_id": process.env.FIREBASE_PROJECT_ID,
//   "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   "client_email": process.env.FIREBASE_CLIENT_EMAIL,
// };

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://ecemikokosite-default-rtdb.europe-west1.firebasedatabase.app"
// });

// const db = admin.database();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate Limiting could be added here for production

const validCodes = [
    "ECW-A3X7", "ECW-M9R2", "ECW-K4F8", "ECW-P7Y3", "ECW-T2W5",
    "ECW-H8N4", "ECW-B5J9", "ECW-C6V2", "ECW-D3M7", "ECW-E9K4",
    "ECW-G2P8", "ECW-Q5T3", "ECW-R7H6", "ECW-S4B2", "ECW-U8C9",
    "ECW-V3D5", "ECW-W9E7", "ECW-X2G4", "ECW-Y6Q8", "ECW-Z4R3",
    "ECW-F7S5", "ECW-J2U9", "ECW-N8V4", "ECW-A5W2", "ECW-M3X8",
    "ECW-K9Y4", "ECW-P2Z7", "ECW-T6A3", "ECW-H4B9", "ECW-B8C5",
    "ECW-C3D2", "ECW-D7E6", "ECW-E2G9", "ECW-G5H4", "ECW-Q9J2",
    "ECW-R4K8", "ECW-S8M3", "ECW-U3N7", "ECW-V7P2", "ECW-W4Q6",
    "ECW-X9R5", "ECW-Y2S8", "ECW-Z6T4", "ECW-F3U2", "ECW-J8V7",
    "ECW-N5W3", "ECW-A9X2", "ECW-M4Y6", "ECW-K2Z8", "ECW-P6A5",
    "ECW-T3B9", "ECW-H7C4", "ECW-B2D8", "ECW-C9E3", "ECW-D4G7",
    "ECW-E8H2", "ECW-G3J6", "ECW-Q7K4", "ECW-R2M9", "ECW-S5N3",
    "ECW-U9P8", "ECW-V4Q2", "ECW-W8R7", "ECW-X3S5", "ECW-Y7T2",
    "ECW-Z2U9", "ECW-F6V4", "ECW-J3W8", "ECW-N9X5", "ECW-A4Y2",
    "ECW-M8Z6", "ECW-K5A3", "ECW-P9B7", "ECW-T4C2", "ECW-H2D9",
    "ECW-B7E4", "ECW-C4G8", "ECW-D9H3", "ECW-E5J2", "ECW-G8K7",
    "ECW-Q2M5", "ECW-R6N9", "ECW-S3P4", "ECW-U7Q2", "ECW-V2R8",
    "ECW-W5S3", "ECW-X8T7", "ECW-Y4U2", "ECW-Z9V5", "ECW-F2W8",
    "ECW-J7X4", "ECW-N3Y9", "ECW-A8Z2", "ECW-M5A7", "ECW-K3B4",
    "ECW-P8C9", "ECW-T2D5", "ECW-H9E2", "ECW-B4G6", "ECW-C7H8"
];

// In-memory store for demonstration. In production, use Firebase Realtime DB (admin sdk)
let usedCodes = {};

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Route to verify code
app.post('/api/verify-code', (req, res) => {
    const { code, userId } = req.body;

    // 1. Basic Validation
    if (!code || !userId) {
        return res.status(400).json({ success: false, message: 'Geçersiz istek.' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Funny Troll for fake validCodes we put in the frontend
    if (["ECW-N1C3-TRY0", "ECW-G3T-R3KT", "ECW-L0L-N00B", "ECW-H4CK3R-M4N"].includes(cleanCode)) {
        return res.status(418).json({ success: false, message: "Ayy o kodları kaynak kodundan mı buldun? Olmadı ama denemen güzel. Git orijinalini satın al!" });
    }

    // 2. Check if code is in the valid list
    if (!validCodes.includes(cleanCode)) {
        return res.status(401).json({ success: false, message: 'Geçersiz kod!' });
    }

    // 3. Check if code is already used
    if (usedCodes[cleanCode]) {
        return res.status(401).json({ success: false, message: 'Bu kod daha önce kullanılmış!' });
    }

    // 4. Mark code as used (In memory for now, should be DB)
    usedCodes[cleanCode] = { userId: userId, usedAt: Date.now() };

    // 5. Generate Access Token (JWT)
    const accessToken = jwt.sign({ userId: userId, role: 'premium' }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ success: true, token: accessToken });
});

// Configure Multer for file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Route for proxying ImgBB Uploads (Hides API Key)
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const formData = new FormData();
        formData.append('image', req.file.buffer, req.file.originalname);

        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, {
            headers: formData.getHeaders()
        });

        res.json(response.data);

    } catch (error) {
        console.error('ImgBB Upload Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Image upload failed.' });
    }
});

// Troll Routes (Honey Pots for Hackers)
app.get(['/.env', '/wp-admin', '/wp-login.php', '/config.php', '/Lucy V2.0.0.exe'], (req, res) => {
    res.status(418).send(`
        <html>
            <body style="background: black; color: #00ff00; font-family: monospace; text-align: center; padding-top: 100px;">
                <h1 style="font-size: 50px;">⚠️ HACKER TESPİT EDİLDİ ⚠️</h1>
                <p style="font-size: 20px;">IP Adresiniz kaydedildi: <strong>\${req.ip || 'Bilinmiyor'}</strong></p>
                <img src="https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif" alt="matrix" style="max-width: 100%; height: auto; margin-top: 20px; border: 2px solid #00ff00;">
                <p style="margin-top: 20px; font-size: 24px;">Burada aradığın şeyi bulamazsın. 😎</p>
                <script>
                    setTimeout(() => window.location.href="https://www.youtube.com/watch?v=dQw4w9WgXcQ", 5000);
                </script>
            </body>
        </html>
    `);
});

// Protected Download Route
app.get('/api/download-app', authenticateToken, (req, res) => {
    // Only users with a valid JWT (which means they verified a code) can reach here

    if (req.user.role !== 'premium') {
        return res.status(403).json({ success: false, message: 'Bunun için yetkiniz yok.' });
    }

    // Path to the actual exe file. This file MUST NOT be in the 'public' folder anymore.
    const file = path.join(__dirname, 'secure_downloads', 'Lucy V2.0.0.exe');

    if (fs.existsSync(file)) {
        res.download(file); // Serve the file for download
    } else {
        res.status(404).json({ success: false, message: 'Dosya bulunamadı.' });
    }
});


app.listen(port, () => {
    console.log(`Ecemiko secure server running on port ${port}`);
});
