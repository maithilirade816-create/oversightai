// ── OversightAI SDK ──
class OversightAI {
    constructor(client, config) {
        this.client = client;
        this.apiKey = config.apiKey;
        this.companyId = config.companyId;
        this.endpoint = config.endpoint || 'https://oversightai.onrender.com';
        this.enabled = true;
    }

    async chat(messages) {
        if (!this.enabled) {
            return this.client.chat(messages);
        }

        const prompt = messages[messages.length - 1]?.content || '';

        try {
            const response = await fetch(`${this.endpoint}/api/monitor`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt,
                    tool: 'OpenAI',
                    companyId: this.companyId
                })
            });

            const result = await response.json();

            if (result.status === 'danger') {
                const error = new Error(result.message);
                error.risk = result.risk;
                error.status = 'blocked';
                throw error;
            }

            return this.client.chat(messages);

        } catch (error) {
            if (error.status === 'blocked') throw error;
            throw new Error(`OversightAI: ${error.message}`);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

function watch(client, config) {
    if (!config || !config.apiKey) {
        throw new Error('OversightAI: API key is required');
    }
    return new OversightAI(client, config);
}

module.exports = { watch };