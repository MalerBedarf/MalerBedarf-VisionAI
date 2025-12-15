const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware: Erlaubt CORS und erhöht das JSON-Limit für Base64-Bilder
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Erhöht auf 50MB für hochauflösende Bilder
app.use(express.static(path.join(__dirname, 'public'))); // Stellt statische Dateien bereit (wenn public-Ordner vorhanden)

// API-Key aus Environment Variable (in Render Dashboard setzen!)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('FEHLER: GEMINI_API_KEY nicht gesetzt!');
    // In einer Produktionsumgebung sollte hier ein Graceful Exit erfolgen
    // Stattdessen loggen wir und verwenden einen Platzhalter für die KI-Initialisierung,
    // falls dies nur zum Testen in einer Umgebung ohne API Key läuft.
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'DUMMY_API_KEY');

// Aktualisiertes Gemini-Modell für Multimodal-Aufgaben mit Bild-Ausgabe (Image Editing)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

// System Instruction, um die Rolle der KI präzise zu definieren
const systemInstruction = `You are a professional image recoloring and retouching AI. Your sole task is to modify the provided original image based on the mask and the target color. The output must be a seamless, photorealistic image. Maintain all original textures, lighting, and shadows perfectly. Only recolor the area indicated by the white mask.`;

/**
 * Konvertiert ein Data URL-Segment in ein GoogleGenerativeAI Part Objekt.
 * @param {string} dataUrl Das vollständige Data URL string.
 * @returns {{inlineData: {data: string, mimeType: string}}}
 */
function dataUrlToGenerativePart(dataUrl) {
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)[1];
    return {
        inlineData: {
            data: base64Data,
            mimeType
        }
    };
}

app.post('/api/recolor', async (req, res) => {
    try {
        const { originalImage, maskImage, targetColor } = req.body;

        if (!originalImage || !maskImage || !targetColor) {
             return res.status(400).json({ error: 'Fehlende Bilddaten oder Zielfarbe.' });
        }

        // Der Prompt bleibt in Deutsch, um die Detailgenauigkeit zu erhalten
        const userPrompt = `Professionelle Retusche: Ändere ausschließlich den weißen Bereich in der Maske (zweites Bild) des Originalfotos in die Farbe ${targetColor}.
Behalte alle Texturen, Putzstruktur, Schatten und Beleuchtung 100% realistisch bei. Nahtlos und photorealistisch.`;

        console.log(`Anfrage erhalten: Färbe Fläche in ${targetColor}...`);

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [
                    { text: userPrompt },
                    dataUrlToGenerativePart(originalImage),
                    dataUrlToGenerativePart(maskImage)
                ]}
            ],
            config: {
                systemInstruction: systemInstruction,
                // Fügt generationConfig hinzu, um die Ausgabe eines Bildes zu erzwingen
                generationConfig: {
                    responseModalities: ['IMAGE'] 
                }
            }
        });

        const response = result.response;
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!imagePart) {
            console.error('KI hat kein Bild generiert:', response.text);
            throw new Error('Keine Bildausgabe von der KI erhalten.');
        }

        const imageDataURL = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        res.json({ imageDataURL });
    } catch (error) {
        // Verbessertes Logging
        console.error('Gemini Fehler beim Neufärben:', error.message);
        res.status(500).json({ error: 'KI-Fehler: Die Verarbeitung ist fehlgeschlagen.' });
    }
});

// Stellt die index.html bereit
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MalerBedarf VisionAI Server läuft auf Port ${PORT}`);
    console.log(`Verwendetes KI-Modell: ${model.model}`);
});
