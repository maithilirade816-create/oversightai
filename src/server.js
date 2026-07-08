// ── Load environment variables ──
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');

// ── Import Models ──
const User = require('./models/User');
const Activity = require('./models/Activity');
const Alert = require('./models/Alert');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Find the correct folder for static files ──
let staticPath = path.join(__dirname, '..');

if (!fs.existsSync(path.join(staticPath, 'index.html'))) {
    staticPath = __dirname;
    console.log('📁 Using backend folder for static files');
} else {
    console.log('📁 Using project root for static files');
}

console.log('📁 STATIC FILES PATH:', staticPath);

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Serve static files ──
app.use(express.static(staticPath));

// ── Routes for HTML files ──
app.get('/', (req, res) => {
    const filePath = path.join(staticPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('index.html not found at ' + filePath);
    }
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'dashboard.html'));
});

app.get('/support.html', (req, res) => {
    res.sendFile(path.join(staticPath, 'support.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(staticPath, 'style.css'));
});

app.get('/app.js', (req, res) => {
    res.sendFile(path.join(staticPath, 'app.js'));
});

// ── MongoDB Connection ──
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));

// ── JWT Helpers ──
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function generateApiKey() {
    return 'osk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateJWT(user) {
    return jwt.sign({ userId: user._id }, JWT_SECRET);
}

// ── AUTH ROUTES ──

// ── Signup ──
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, companyName } = req.body;

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = new User({
            email,
            password,
            companyName,
            apiKey: generateApiKey(),
        });
        await user.save();

        const token = generateJWT(user);

        res.status(201).json({
            token,
            user: {
                email: user.email,
                companyName: user.companyName,
                apiKey: user.apiKey,
            },
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Login ──
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await user.comparePassword(password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateJWT(user);

        res.json({
            token,
            user: {
                email: user.email,
                companyName: user.companyName,
                apiKey: user.apiKey,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── PROTECTED ROUTES ──

// ── Auth Middleware (JWT) ──
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// ── Dashboard ──
app.get('/api/dashboard', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;

        const totalRequests = await Activity.countDocuments({ userId });
        const leaksBlocked = await Activity.countDocuments({ userId, status: 'blocked' });
        const activeAgents = await Activity.distinct('tool', { userId });
        const alerts = await Alert.countDocuments({ userId, resolved: false });

        const recentActivity = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        res.json({
            metrics: {
                totalRequests,
                leaksBlocked,
                activeAgents: activeAgents.length,
                alerts,
            },
            activity: recentActivity.map(a => ({
                user: req.user.email,
                tool: a.tool,
                prompt: a.prompt.substring(0, 50) + (a.prompt.length > 50 ? '...' : ''),
                status: a.status,
                time: a.createdAt ? new Date(a.createdAt).toLocaleString() : 'Just now',
            })),
            apiKey: req.user.apiKey,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── MONITOR ROUTE ──
app.post('/api/monitor', async (req, res) => {
    console.log('📡 Monitor endpoint called');

    const { prompt, tool } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    let user = null;

    // ── Try API key ──
    if (token.startsWith('osk_')) {
        user = await User.findOne({ apiKey: token });
    }

    // ── Try JWT ──
    if (!user) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            user = await User.findById(decoded.userId);
        } catch (err) {}
    }

    if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // ── Scan for sensitive data ──
    const sensitivePatterns = {
        apiKey: /sk-[a-zA-Z0-9]{32,}/,
        ssn: /\d{3}-\d{2}-\d{4}/,
        creditCard: /\d{4}-\d{4}-\d{4}-\d{4}/,
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    };

    let detectedRisk = null;
    let riskType = 'none';
    for (const [type, pattern] of Object.entries(sensitivePatterns)) {
        if (pattern.test(prompt)) {
            detectedRisk = type;
            riskType = type;
            break;
        }
    }

    const activity = new Activity({
        userId: user._id,
        tool: tool || 'Unknown',
        prompt,
        status: detectedRisk ? 'blocked' : 'safe',
        riskType,
    });

    if (detectedRisk) {
        const alert = new Alert({
            userId: user._id,
            type: 'danger',
            message: `⚠️ ${detectedRisk} detected in prompt from ${user.email}`,
        });
        await alert.save();
        activity.response = 'Blocked due to sensitive data';
        await activity.save();

        return res.json({
            status: 'danger',
            message: `⚠️ ${detectedRisk} detected and blocked!`,
            risk: detectedRisk,
            alertId: alert._id,
        });
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
    });

    activity.response = completion.choices[0].message.content;
    await activity.save();

    res.json({
        status: 'safe',
        message: '✅ Prompt is safe. AI response generated.',
        response: completion.choices[0].message.content,
    });
});

// ── Get Alerts ──
app.get('/api/alerts', authenticate, async (req, res) => {
    try {
        const alerts = await Alert.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        res.json({ alerts });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Resolve Alert ──
app.put('/api/alerts/:id/resolve', authenticate, async (req, res) => {
    try {
        const alert = await Alert.findOne({ _id: req.params.id, userId: req.user._id });
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        alert.resolved = true;
        await alert.save();

        res.json({ message: 'Alert resolved' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── EXPORT FOR RENDER ──
module.exports = app;

// ── FOR LOCAL: Run the server ──
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ OversightAI backend running on http://localhost:${PORT}`);
    });
}