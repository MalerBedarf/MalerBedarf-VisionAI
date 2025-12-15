const express = require('express');
const fetch = require('node-fetch'); // Neu: für Grok API
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

// Dein Grok API-Key aus xAI Dashboard
const GROK_API_KEY = process.env.GROK_API_KEY; // In Render als Environment Variable setzen!

if (!GROK_API_KEY) {
    console.error('FEHLER: GROK_API_KEY nicht gesetzt!');
    process.exit(1);
}

app.post('/api/recolor', async (req, res) => {
    try {
        const { originalImage, maskImage, targetColor } = req.body;

        const prompt = `Du bist ein Meister der Fassaden-Retusche. 
Ändere exakt nur den weißen Bereich in der Maske (zweites Bild) des Originalfotos in die Farbe ${targetColor}.
Behalte alle Texturen, Putz, Schatten und Licht perfekt bei – photorealistisch und nahtlos.
Ändere nichts außerhalb der Maske!`;

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "grok-2-vision-1212", // Aktuelles Vision-Modell
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: originalImage } },
                            { type: "image_url", image_url: { url: maskImage } }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Grok API Fehler');
        }

        // Grok gibt Base64-Bild zurück
        const imageBase64 = data.choices[0].message.content[0].image.base64;
        const imageDataURL = `data:image/png;base64,${imageBase64}`;

        res.json({ imageDataURL });
    } catch (error) {
        console.error('Grok Fehler:', error.message);
        res.status(500).json({ error: 'KI-Fehler: ' + error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MalerBedarf VisionAI mit Grok läuft auf Port ${PORT}`));
