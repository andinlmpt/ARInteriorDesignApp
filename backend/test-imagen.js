import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testImagen() {
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not found');
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`;

    const body = {
        instances: [
            { prompt: "A cozy modern living room with a blue sofa and natural light" }
        ],
        parameters: {
            sampleCount: 1,
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('Imagen Response:', JSON.stringify(data, null, 2));

        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            console.log('✅ Imagen successfully generated an image!');
        } else {
            console.log('❌ Imagen failed to generate an image.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testImagen();
