const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ecemiko_default_secure_jwt_secret_key_2026';

// Firebase SDK tamamen kaldirildi — REST API kullaniliyor (SDK persistent conn nodemailer'i blokluyor)
// Firestore REST API config
const FIRESTORE_PROJECT = 'ecemikouygulamakeysistemi';
const FIRESTORE_API_KEY = 'AIzaSyADHMOGXr38ltWu6NLKG0qEagN9DQ2N3JI';

// Nodemailer transporter - startup'ta bir kere olustur, her requestte yeniden kurma
const mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    pool: false,
    auth: {
        user: process.env.SMTP_USER || 'ecemikolauncher@ecemikoapp.info',
        pass: process.env.SMTP_PASS || 'qcsh nkez jijs jcyw'
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Rate Limiting could be added here for production



// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Route to verify code
app.post('/api/verify-code', async (req, res) => {
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

    try {
        // 2. Query Firestore key validation dynamically using REST API
        const keyUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/accounts/_key_${cleanCode}?key=${FIRESTORE_API_KEY}`;
        let keyDoc;
        try {
            const keyRes = await axios.get(keyUrl);
            keyDoc = keyRes.data;
        } catch (err) {
            if (err.response && err.response.status === 404) {
                return res.status(401).json({ success: false, message: 'Geçersiz kod!' });
            }
            throw err;
        }

        // 3. Check if key is already used by querying the used state document
        const usedUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/accounts/_used_${cleanCode}?key=${FIRESTORE_API_KEY}`;
        let alreadyUsed = false;
        try {
            await axios.get(usedUrl);
            alreadyUsed = true;
        } catch (err) {
            if (err.response && err.response.status === 404) {
                alreadyUsed = false;
            } else {
                throw err;
            }
        }

        if (alreadyUsed) {
            return res.status(401).json({ success: false, message: 'Bu kod daha önce kullanılmış!' });
        }

        // 4. Mark code as used dynamically by creating the _used_CODE document
        await axios.patch(usedUrl, {
            fields: {
                usedBy: { stringValue: userId },
                usedAt: { timestampValue: new Date().toISOString() }
            }
        });

        // 5. Generate Access Token (JWT)
        const packageType = keyDoc.fields?.package?.stringValue || 'premium';
        const accessToken = jwt.sign({ userId: userId, role: 'premium', package: packageType }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, token: accessToken });

    } catch (error) {
        console.error('Verify Code Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Sunucu hatası! Doğrulama şu an yapılamıyor.' });
    }
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


// Active Users Count — Firestore REST API (no persistent SDK connection)
app.get('/api/active-users', async (req, res) => {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:runAggregationQuery?key=${FIRESTORE_API_KEY}`;
        const body = {
            structuredAggregationQuery: {
                aggregations: [{ alias: 'count', count: {} }],
                structuredQuery: { from: [{ collectionId: 'accounts' }] }
            }
        };
        const response = await axios.post(url, body, { timeout: 8000 });
        const count = response.data?.[0]?.result?.aggregateFields?.count?.integerValue;
        if (count !== undefined) {
            return res.json({ success: true, count: parseInt(count) });
        }
        return res.status(500).json({ success: false, message: 'Count not found in response' });
    } catch (error) {
        console.error('Error fetching active users count:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Contact form email sending — fire-and-forget (respond immediately, mail in background)
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    console.log('[contact] Request received from:', email);

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Lutfen tum alanlari doldurun.' });
    }

    // Respond to client immediately — don't make user wait for SMTP
    res.json({ success: true, message: 'Mesajiniz alindi! En kisa surede size donecegiz.' });

    // Send mail in background
    const mailOptions = {
        from: '"Ecemiko Iletisim" <ecemikolauncher@ecemikoapp.info>',
        to: 'ecemikolly@gmail.com',
        subject: `Ecemiko Site - Iletisim: ${name}`,
        text: `Gonderen: ${name}\nE-posta: ${email}\n\nMesaj:\n${message}`,
        html: `<h3>Yeni Mesaj</h3><p><b>Gonderen:</b> ${name}</p><p><b>E-posta:</b> ${email}</p><hr><p style="white-space:pre-wrap">${message}</p>`
    };

    mailTransporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('[contact] Mail FAILED:', err.message, err.code);
        } else {
            console.log('[contact] Mail sent OK:', info.messageId);
        }
    });
});


app.listen(port, () => {
    console.log(`Ecemiko secure server running on port ${port}`);
});

// Export for Vercel Serverless
module.exports = app;
