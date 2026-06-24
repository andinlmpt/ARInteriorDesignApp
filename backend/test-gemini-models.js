import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function listAllModelsToFile() {
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not found');
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        let output = '';
        data.models.forEach(model => {
            output += `${model.name} | ${model.displayName}\n`;
        });
        fs.writeFileSync('models_list.txt', output);
        console.log('Models list written to models_list.txt');
    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listAllModelsToFile();
