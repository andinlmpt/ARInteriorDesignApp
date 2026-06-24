import groqService from './src/services/groqService.js';

async function testHuggingFace() {
  console.log('Testing Hugging Face Image Generation...\n');

  const proposal = {
    title: 'Minimalist Reading Nook',
    description: 'A cozy reading corner with a comfortable armchair, a floor lamp, and a small bookshelf.',
    colorPalette: ['#ffffff', '#e0e0e0', '#5a5a5a']
  };

  const preferences = {
    roomType: 'Living Room',
    style: 'Minimalist'
  };

  console.log('Calling generateImage...');
  const result = await groqService.generateImage(proposal, preferences);

  if (result && result.type === 'generated') {
    console.log('\n✅ Success! Received base64 image data.');
    console.log('Image data length:', result.data.length);
    console.log('Prompt used:', result.prompt);
  } else {
    console.log('\n❌ Failed or skipped. Result:', result);
  }
}

testHuggingFace();
