
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin account already exists');
      process.exit(0);
    }

    // Create admin account
    const admin = new Admin({
      username: 'admin',
      password: 'admin123', // This will be hashed automatically
      email: 'admin@shilpp.com'
    });

    await admin.save();
    console.log('Admin account created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up admin account:', error);
    process.exit(1);
  }
};

createAdmin();
