const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname)); // Serviert index.html

// API-Key aus Environment Variable (in Render Dashboard setzen!)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('FEHLER: GEMINI_API_KEY nicht gesetzt!');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Stabilstes Modell für Bild-Editing (Dezember 2025)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

app.post('/api/recolor', async (req, res) => {
    try {
        const { originalImage, maskImage, targetColor } = req.body;

        const prompt = `Professionelle Retusche: Ändere ausschließlich den weißen Bereich in der Maske (zweites Bild) des Originalfotos in die Farbe ${targetColor}. 
Behalte alle Texturen, Putzstruktur, Schatten und Beleuchtung 100% realistisch bei. Nahtlos und photorealistisch.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: originalImage.split(',')[1], mimeType: 'image/jpeg' } },
            { inlineData: { data: maskImage.split(',')[1], mimeType: 'image/png' } }
        ]);

        const response = await result.response;
        const imagePart = response.candidates[0].content.parts[0].inlineData;

        if (!imagePart) throw new Error('Kein Bild generiert');

        const imageDataURL = `data:${imagePart.mimeType};base64,${imagePart.data}`;
        res.json({ imageDataURL });
    } catch (error) {
        console.error('Gemini Fehler:', error.message);
        res.status(500).json({ error: 'KI-Fehler: ' + error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MalerBedarf VisionAI läuft auf Port ${PORT}`);
});
