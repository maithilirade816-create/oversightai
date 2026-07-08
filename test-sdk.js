// ── test-sdk.js ──
const { watch } = require('./sdk/index.js');

// ── Simulated OpenAI client ──
class MockOpenAI {
    async chat(messages) {
        console.log('📨 Mock OpenAI received:', messages);
        return { choices: [{ message: { content: 'Mock response from OpenAI' } }] };
    }
}

// ── Your API key (from your dashboard) ──
const API_KEY = 'osk_hog7dsdi28o0v7s9x8j6mi';  // REPLACE WITH YOUR FULL API KEY

// ── Wrap the client ──
const openai = watch(new MockOpenAI(), {
    apiKey: API_KEY,
    companyId: 'test_company',
    endpoint: 'https://oversightai.onrender.com',
});

// ── Test call ──
async function test() {
    try {
        console.log('📡 Sending test prompt...');
        const response = await openai.chat([
            { role: 'user', content: 'Hello, world!' }
        ]);
        console.log('✅ Response:', response);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

test();