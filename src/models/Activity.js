const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tool: { type: String, enum: ['ChatGPT', 'Claude', 'Gemini', 'Other'], required: true },
    prompt: { type: String, required: true },
    response: { type: String },
    status: { type: String, enum: ['safe', 'danger', 'blocked'], default: 'safe' },
    riskType: { type: String, enum: ['apiKey', 'ssn', 'creditCard', 'email', 'none'], default: 'none' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Activity', ActivitySchema);