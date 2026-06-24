
const createAccount = async () => {
  try {
    console.log('Sending request to local backend to create a new account...');
    const response = await fetch('http://127.0.0.1:3000/api/v1/users/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'New Test User',
        email: 'newuser@example.com',
        password: 'password123'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Account successfully created!');
      console.log(data);
      console.log('\nYou can now log in with:');
      console.log('Email: newuser@example.com');
      console.log('Password: password123');
    } else {
      console.error('❌ Failed to create account:', data);
    }
  } catch (error) {
    console.error('❌ Network error. Is your backend server running on port 3000?', error.message);
  }
};

createAccount();
