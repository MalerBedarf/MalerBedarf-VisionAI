const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

// API-Key sicher aus Render Environment Variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('FEHLER: GEMINI_API_KEY nicht gesetzt! Bitte in Render Environment Variables hinzufügen.');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Stabilstes verfügbares Modell für Bildbearbeitung (Dezember 2025)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

app.post('/api/recolor', async (req, res) => {
    try {
        const { originalImage, maskImage, targetColor } = req.body;

        const prompt = `Du bist ein professioneller Fassaden- und Wand-Retuscheur.
Ändere AUSSCHLIESSLICH den weißen Bereich in der Maske (zweites Bild) des Originalfotos (erstes Bild) in die Farbe ${targetColor}.
Behalte 100% aller Details, Putzstruktur, Texturen, Schatten, Reflexionen und natürliche Beleuchtung bei.
Das Ergebnis muss absolut photorealistisch und nahtlos wirken – als wäre das Foto original so aufgenommen worden.
Ändere nichts außerhalb der maskierten Fläche!`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: originalImage.split(',')[1], mimeType: 'image/jpeg' } },
            { inlineData: { data: maskImage.split(',')[1], mimeType: 'image/png' } }
        ]);

        const response = await result.response;
        const imagePart = response.candidates[0].content.parts[0].inlineData;

        if (!imagePart) {
            throw new Error('Kein Bild von Gemini erhalten');
        }

        const imageDataURL = `data:${imagePart.mimeType};base64,${imagePart.data}`;
        res.json({ imageDataURL });
    } catch (error) {
        console.error('Gemini API Fehler:', error.message);
        res.status(500).json({ error: 'KI-Verarbeitung fehlgeschlagen: ' + error.message });
    }
});

// Startseite – MalerBedarf VisionAI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MalerBedarf VisionAI Server läuft auf Port ${PORT}`);
    console.log(`Live unter: https://malerbedarf-visionai.onrender.com`);
});
