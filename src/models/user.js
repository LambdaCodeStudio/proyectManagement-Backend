const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
 email: { type: String, required: true, unique: true },
 password: { type: String, required: true },
 role: { 
  type: String, 
  enum: ['admin', 'cliente'], 
  default: 'cliente',
  required: true 
 },
 name: { type: String, trim: true },
 phone: { type: String, trim: true },
 active: { type: Boolean, default: true },
 lastLogin: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
 if (!this.isModified('password')) return next();
 this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', userSchema);