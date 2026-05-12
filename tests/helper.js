const request = require('supertest');
const app = require('../src/config/prisma'); // We'll need to export the Express app

// Helper to get access token for testing
const getAccessToken = async (email, password) => {
    const res = await request('http://localhost:3000') // We'll use dynamic port
        .post('/api/auth/login')
        .send({ email, password });
    
    if (res.status === 200 && res.body.data?.accessToken) {
        return res.body.data.accessToken;
    }
    throw new Error('Failed to get access token: ' + JSON.stringify(res.body));
};

module.exports = { getAccessToken };
