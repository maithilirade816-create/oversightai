const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    name: { type: String, default: '' },
    companyName: { type: String, default: '' },
    apiKey: { type: String, unique: true },
    isSocialLogin: { type: Boolean, default: false },
    googleId: { type: String, sparse: true },
    facebookId: { type: String, sparse: true },
    twitterId: { type: String, sparse: true },
    createdAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);