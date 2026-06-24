import fs from 'fs';
try {
    fs.writeFileSync('test.log', 'Hello world from test-simple.js');
    console.log('Wrote to test.log');
} catch (e) {
    console.error(e);
}
