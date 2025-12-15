const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();

// Wichtige Middleware
app.use(cors());                                      // Erlaubt Aufrufe von deiner WordPress-Seite
app.use(express.json({ limit: '20mb' }));             // Große Base64-Bilder erlauben
app.use(express.static(__dirname));                    // Serviert index.html, CSS, etc.

// API-Key sicher aus Environment Variable holen
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('FEHLER: GEMINI_API_KEY ist nicht als Environment Variable gesetzt!');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Aktuelles Top-Modell für Bild-Editing (Dezember 2025)
const model = genAI.getGenerativeModel({ 
    model: "gemini-3-pro-image-preview" 
});

// API-Endpunkt für Recoloring
app.post('/api/recolor', async (req, res) => {
    try {
        const { originalImage, maskImage, targetColor } = req.body;

        if (!originalImage || !maskImage || !targetColor) {
            return res.status(400).json({ error: 'Fehlende Daten: originalImage, maskImage oder targetColor' });
        }

        const prompt = `
        Du bist ein professioneller Bildbearbeiter.
        Aufgabe: Ändere AUSSCHLIESSLICH den weißen Bereich in der zweiten Maske (zweites Bild) des ersten Originalbildes in die Farbe ${targetColor}.
        Behalte 100% aller Details, Texturen, Putzstruktur, Schatten, Reflexionen und Beleuchtung bei.
        Das Ergebnis muss absolut photorealistisch und nahtlos wirken – als wäre das Foto original so aufgenommen worden.
        Ändere nichts außerhalb der maskierten Fläche!
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: originalImage.split(',')[1], mimeType: 'image/jpeg' } },
            { inlineData: { data: maskImage.split(',')[1], mimeType: 'image/png' } }
        ]);

        const response = await result.response;
        const imagePart = response.candidates[0].content.parts[0].inlineData;

        if (!imagePart) {
            throw new Error('Kein Bild in der Antwort von Gemini');
        }

        const imageDataURL = `data:${imagePart.mimeType};base64,${imagePart.data}`;

        res.json({ imageDataURL });
    } catch (error) {
        console.error('Gemini API Fehler:', error.message);
        res.status(500).json({ error: 'KI-Verarbeitung fehlgeschlagen: ' + error.message });
    }
});

// Startseite: index.html anzeigen
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Port von Render übernehmen (wichtig!)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Live unter: https://malerbedarf-visionai.onrender.com`);
});
