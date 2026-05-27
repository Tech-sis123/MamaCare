import request from 'supertest';
import app from './src/index';

async function run() {
  console.log('Sending request to /auth/patient/otp/request...');
  try {
    const res = await request(app)
      .post('/auth/patient/otp/request')
      .send({ phone_number: 'short' });
    console.log('Status:', res.status);
    console.log('Body:', res.body);
  } catch (err) {
    console.error('Error hitting endpoint:', err);
  }
}

run().catch(console.error);
