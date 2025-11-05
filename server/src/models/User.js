const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  // password is optional to support OAuth-created users (they won't have a local password)
  password: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
