import groqService from './src/services/groqService.js';

async function testGroq() {
  console.log('Testing Groq Integration...\n');

  console.log('1. Testing generateDesignTitle');
  const title = await groqService.generateDesignTitle({ roomType: 'Living Room', designStyle: 'Modern' });
  console.log('Title:', title, '\n');

  console.log('2. Testing suggestColorPalette');
  const palette = await groqService.suggestColorPalette('Modern');
  console.log('Palette:', palette, '\n');

  console.log('3. Testing generateDesignIdeas');
  const ideas = await groqService.generateDesignIdeas({
    roomType: 'Living Room',
    designStyle: 'Modern',
    dimensions: { width: 5, length: 4, height: 3 },
    budget: 'medium'
  });
  console.log('Ideas:', JSON.stringify(ideas, null, 2), '\n');

  console.log('All tests completed.');
}

testGroq();
