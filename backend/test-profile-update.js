/**
 * Test Profile Update Script
 * 1. Login (Create user if needed) to get token
 * 2. Update profile
 * 3. Verify update
 */

// import fetch from 'node-fetch'; // Using global fetch
import fs from 'fs';

function log(message) {
    console.log(message);
    try {
        fs.appendFileSync('profile-update.log', (typeof message === 'object' ? JSON.stringify(message, null, 2) : message) + '\n');
    } catch (e) { }
}

const BASE_URL = 'http://localhost:3000/api/v1';

// Test user
const TEST_USER = {
    email: `test_${Date.now()}@example.com`,
    password: 'password123',
    name: 'Original Name'
};

async function testProfileUpdate() {
    fs.writeFileSync('profile-update.log', ''); // Clear log
    log('🧪 Starting Profile Update Test...');

    try {
        // 1. Signup
        log('\n1. Creating test user...');
        const signupRes = await fetch(`${BASE_URL}/users/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        if (!signupRes.ok) {
            // If user already exists, try login
            if (signupRes.status === 409) {
                log('   User exists, logging in...');
            } else {
                const err = await signupRes.text();
                throw new Error(`Signup failed: ${signupRes.status} ${err}`);
            }
        }

        // 2. Login to get token and ID
        const loginRes = await fetch(`${BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);

        const loginData = await loginRes.json();
        const { token, user } = loginData;
        log(`   Logged in as: ${user.name} (${user.id})`);

        // 3. Update Profile
        log('\n2. Updating profile...');
        const updates = {
            name: 'Updated Name',
            bio: 'This is my new bio',
            phoneNumber: '+1234567890',
            preferences: {
                theme: 'dark',
                notifications: false
            }
        };

        const updateRes = await fetch(`${BASE_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        if (!updateRes.ok) {
            const err = await updateRes.text();
            throw new Error(`Update failed: ${updateRes.status} ${err}`);
        }

        const updateData = await updateRes.json();
        log('   Update response: ' + JSON.stringify(updateData.user, null, 2));

        // 4. Verification
        log('\n3. Verifying updates...');
        const updatedUser = updateData.user;

        if (updatedUser.name !== updates.name) throw new Error('Name mismatch');
        if (updatedUser.bio !== updates.bio) throw new Error('Bio mismatch');
        if (updatedUser.phoneNumber !== updates.phoneNumber) throw new Error('Phone mismatch');
        if (updatedUser.preferences.theme !== updates.preferences.theme) throw new Error('Theme mismatch');

        log('✅ SUCCESS: Profile updated correctly!');

    } catch (error) {
        log('❌ TEST FAILED: ' + error.message);
        process.exit(1);
    }
}

testProfileUpdate();
