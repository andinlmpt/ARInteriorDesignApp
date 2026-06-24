const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/v1/users/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('RESPONSE BODY:', data);
  });
});

req.on('error', (e) => {
  console.error(`PROBLEM WITH REQUEST: ${e.message}`);
});

// Try to login with the mock user we know about
req.write(JSON.stringify({
  email: 'john@example.com',
  password: 'password123'
}));

req.end();
