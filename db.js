import 'dotenv/config'; // Load environment variables from .env file
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    const mongoDBName = process.env.MONGODB_DB;

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    await mongoose.connect(mongoURI, {
      dbName: mongoDBName,
    });
    console.log(`MongoDB connected successfully to database: ${mongoDBName}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;