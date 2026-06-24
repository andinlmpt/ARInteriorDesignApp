import dotenv from 'dotenv';
dotenv.config();
import { generateImage } from './src/services/geminiService.js';

async function verifyGeneration() {
    console.log('Testing generateImage logic...');

    const proposal = {
        title: "Mid-Century Modern Living Room",
        description: "A spacious living room with large windows, a mustard yellow sofa, and walnut wood furniture.",
        colorPalette: ["#E2B13C", "#5D4037", "#F5F5F5", "#212121"]
    };

    const preferences = {
        roomType: "Living Room",
        style: "Mid-Century Modern"
    };

    try {
        const result = await generateImage(proposal, preferences);

        if (result && result.startsWith('data:image/jpeg;base64,')) {
            console.log('✅ Success! Gemini generated a base64 image.');
            console.log('Preview length:', result.length);
        } else {
            console.error('❌ Failed. Result was null or invalid format.');
        }
    } catch (error) {
        console.error('Error during verification:', error.message);
    }
}

verifyGeneration();
