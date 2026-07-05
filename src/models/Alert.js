const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['danger', 'warning', 'info'], required: true },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Alert', AlertSchema);