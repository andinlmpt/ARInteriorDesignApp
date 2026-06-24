/**
 * Test Profile Update Script (Native HTTP)
 * No dependencies required.
 */

import fs from 'fs';
import http from 'http';

const PORT = 3000;
const TEST_USER = {
    email: `test_native_${Date.now()}@example.com`,
    password: 'password123',
    name: 'Native Test User'
};

function log(msg) {
    fs.appendFileSync('native_test.log', msg + '\n');
    console.log(msg);
}

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/v1' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTest() {
    fs.writeFileSync('native_test.log', '');
    log('🧪 Starting Profile Update Test (Native)...');

    try {
        // 1. Signup
        log('\n1. Creating test user...');
        let res = await request('POST', '/users/signup', TEST_USER);

        if (res.status === 409) {
            log('   User exists, logging in...');
        } else if (res.status !== 201) {
            throw new Error(`Signup failed: ${res.status} ${JSON.stringify(res.data)}`);
        }

        // 2. Login
        log('2. Logging in...');
        res = await request('POST', '/users/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        if (res.status !== 200) {
            throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
        }

        const { token, user } = res.data;
        log(`   Logged in as: ${user.name} (${user.id})`);

        // 3. Update Profile
        log('\n3. Updating profile...');
        const updates = {
            name: 'Updated Native Name',
            bio: 'Native http test bio',
            phoneNumber: '555-0199',
            preferences: { theme: 'light' }
        };

        res = await request('PUT', `/users/${user.id}`, updates, token);

        if (res.status !== 200) {
            throw new Error(`Update failed: ${res.status} ${JSON.stringify(res.data)}`);
        }

        log('   Update response: ' + JSON.stringify(res.data.user, null, 2));

        // 4. Verify
        const updatedUser = res.data.user;
        if (updatedUser.name !== updates.name) throw new Error('Name mismatch');
        if (updatedUser.bio !== updates.bio) throw new Error('Bio mismatch');

        log('\n✅ SUCCESS: Profile updated correctly!');

    } catch (error) {
        log('\n❌ TEST FAILED: ' + error.message);
    }
}

runTest();
