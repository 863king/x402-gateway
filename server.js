/**
 * x402 中间商服务 - 支持API密钥
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ==================== 配置 ====================

const RECEIVER_ADDRESS = '0x8B6E03d1Db3f7F773a49124f4b721E7A8b182f83';
const API_KEYS_FILE = path.join(__dirname, 'api_keys.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'king151';
const ADMIN_SESSIONS = new Map(); // sessionToken -> expiry

// API 价格（USDC）
const API_PRICES = {
    '/api/weather': 10000,    // $0.01 = 10000 微USDC
    '/api/crypto': 10000,     // $0.01
    '/api/exchange': 5000,    // $0.005
    '/api/news': 20000,       // $0.02
};

// ==================== API 密钥管理 ====================

function loadApiKeys() {
    try {
        const data = fs.readFileSync(API_KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { keys: [] };
    }
}

function saveApiKeys(data) {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(data, null, 2));
}

function validateApiKey(key) {
    const data = loadApiKeys();
    const keyObj = data.keys.find(k => k.key === key && k.active);
    if (!keyObj) return false;
    if (keyObj.limit > 0 && keyObj.calls >= keyObj.limit) return false;
    return true;
}

function incrementKeyUsage(key) {
    const data = loadApiKeys();
    const keyObj = data.keys.find(k => k.key === key);
    if (keyObj) {
        keyObj.calls = (keyObj.calls || 0) + 1;
        saveApiKeys(data);
    }
}

function generateApiKey(name, limit = 0) {
    const key = 'x402_' + require('crypto').randomBytes(16).toString('hex');
    const data = loadApiKeys();
    data.keys.push({
        key,
        name,
        created: new Date().toISOString().split('T')[0],
        calls: 0,
        limit,
        active: true
    });
    saveApiKeys(data);
    return key;
}

// ==================== x402 中间件 ====================

function x402Middleware(req, res, next) {
    const path = req.path;
    const price = API_PRICES[path];
    
    if (!price) {
        return next();
    }
    
    // 检查 API 密钥
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey && validateApiKey(apiKey)) {
        incrementKeyUsage(apiKey);
        return next();
    }
    
    // 检查支付签名
    const paymentSignature = req.headers['x-payment'];
    if (paymentSignature) {
        return next();
    }
    
    // 需要支付
    const paymentRequired = {
        version: '1.0',
        schemes: ['exact'],
        network: 'polygon',
        asset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        price: price.toString(),
        receiver: RECEIVER_ADDRESS,
        description: `Payment required for ${path}`,
        expires: Math.floor(Date.now() / 1000) + 3600,
    };
    
    const acceptHeader = req.headers.accept || '';
    const isBrowser = acceptHeader.includes('text/html');
    
    if (isBrowser) {
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Required - x402 API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 650px;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.4);
        }
        .icon { font-size: 60px; text-align: center; margin-bottom: 15px; }
        h1 { color: #333; text-align: center; margin-bottom: 20px; }
        .price { 
            font-size: 2em; 
            color: #667eea; 
            font-weight: bold; 
            text-align: center;
            margin: 15px 0;
        }
        .tabs {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 2px solid #eee;
        }
        .tab {
            flex: 1;
            padding: 12px;
            text-align: center;
            cursor: pointer;
            color: #666;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
        }
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: bold;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .steps {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            margin: 15px 0;
        }
        .steps ol { padding-left: 20px; }
        .steps li { margin: 8px 0; color: #555; }
        .code-box {
            background: #2d3748;
            color: #68d391;
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.85em;
            margin: 10px 0;
            word-break: break-all;
        }
        .input-box {
            background: #f8f9fa;
            border: 2px solid #e2e8f0;
            padding: 12px 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.9em;
            margin: 10px 0;
            width: 100%;
        }
        .free-badge {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-top: 15px;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 15px;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
        .example {
            background: #edf2f7;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .example code {
            font-family: monospace;
            color: #667eea;
        }
    </style>
    <script>
        function showTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('.tab.' + tab).classList.add('active');
            document.getElementById(tab).classList.add('active');
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="icon">💳</div>
        <h1>Payment Required</h1>
        <div class="price">$${(price / 1000000).toFixed(price === 5000 ? 3 : 2)} USDC</div>
        
        <div class="tabs">
            <div class="tab active" onclick="showTab('apikey')">🔑 API Key</div>
            <div class="tab" onclick="showTab('crypto')">💰 Crypto Pay</div>
        </div>
        
        <div id="apikey" class="tab-content active">
            <div class="steps">
                <strong>🎁 Free Trial:</strong>
                <p style="margin: 10px 0; color: #666;">
                    Get a free API key for testing! DM @king151 on Telegram.
                </p>
                <div class="input-box">X-API-Key: your_api_key_here</div>
            </div>
            <div class="example">
                <strong>Example:</strong><br>
                <code>curl -H "X-API-Key: YOUR_KEY" http://x402.ai2091.com${path}?city=Tokyo</code>
            </div>
            <a href="https://t.me/king151" target="_blank" class="btn">Get Free API Key</a>
        </div>
        
        <div id="crypto" class="tab-content">
            <div class="steps">
                <ol>
                    <li>Open your crypto wallet (MetaMask, Phantom)</li>
                    <li>Switch to <strong>Polygon</strong> network</li>
                    <li>Send USDC to:</li>
                </ol>
                <div class="code-box">${RECEIVER_ADDRESS}</div>
                <ol start="4">
                    <li>Amount: <strong>$${(price / 1000000).toFixed(price === 5000 ? 3 : 2)} USDC</strong></li>
                    <li>DM @king151 with tx hash for API key</li>
                </ol>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
            <span class="free-badge">🎁 100 free calls with API key</span>
        </div>
    </div>
</body>
</html>`;
        return res.status(402).send(html);
    }
    
    return res.status(402).json({
        error: 'Payment Required',
        payment_required: Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
        message: `This API costs $${price / 1000000} USDC`,
        docs: 'http://x402.ai2091.com/',
        contact: '@king151',
        hint: 'Add X-API-Key header or api_key query param'
    });
}

app.use(x402Middleware);

// ==================== API 接口 ====================

app.get('/api/weather', async (req, res) => {
    try {
        const city = req.query.city || 'Shanghai';
        const response = await axios.get(`https://wttr.in/${city}?format=j1`, { timeout: 10000 });
        const data = response.data;
        
        res.json({
            success: true,
            data: {
                location: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
                temperature: data.current_condition?.[0]?.temp_C,
                condition: data.current_condition?.[0]?.weatherDesc?.[0]?.value,
                humidity: data.current_condition?.[0]?.humidity,
                wind: data.current_condition?.[0]?.windspeedKmph,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/crypto', async (req, res) => {
    try {
        const ids = req.query.ids || 'bitcoin,ethereum,solana';
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: ids,
                vs_currencies: 'usd',
                include_24hr_change: true
            },
            timeout: 10000
        });
        
        res.json({
            success: true,
            data: response.data,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/exchange', async (req, res) => {
    try {
        const base = req.query.base || 'USD';
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`, { timeout: 10000 });
        
        res.json({
            success: true,
            base: base,
            rates: response.data.rates,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/news', async (req, res) => {
    try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
            params: { lang: 'EN' },
            timeout: 10000
        });
        
        const articles = response.data.Data.slice(0, 10).map(item => ({
            title: item.title,
            source: item.source_info?.name || item.source,
            url: item.url,
            published: item.published_on * 1000
        }));
        
        res.json({
            success: true,
            data: articles,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 管理接口 ====================

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'x402_admin_2026';

// 验证 session
app.get('/admin/verify', (req, res) => {
    const { token } = req.query;
    if (validateSession(token)) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

// 创建新密钥
app.post('/admin/keys', (req, res) => {
    const { token, name, limit } = req.body;
    if (!validateSession(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const key = generateApiKey(name || 'Unnamed', limit || 100);
    res.json({ success: true, key });
});

// 列出所有密钥
app.get('/admin/keys', (req, res) => {
    const { token } = req.query;
    if (!validateSession(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const data = loadApiKeys();
    res.json({ success: true, keys: data.keys });
});

// 禁用密钥
app.delete('/admin/keys/:key', (req, res) => {
    const { token } = req.query;
    if (!validateSession(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const data = loadApiKeys();
    const keyObj = data.keys.find(k => k.key === req.params.key);
    if (keyObj) {
        keyObj.active = false;
        saveApiKeys(data);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Key not found' });
    }
});

// ==================== 管理后台 ====================

// 生成 session token
function generateSessionToken() {
    return require('crypto').randomBytes(32).toString('hex');
}

// 验证 session
function validateSession(token) {
    if (!token) return false;
    const expiry = ADMIN_SESSIONS.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) {
        ADMIN_SESSIONS.delete(token);
        return false;
    }
    return true;
}

// 登录接口
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = generateSessionToken();
        ADMIN_SESSIONS.set(token, Date.now() + 24 * 60 * 60 * 1000); // 24小时有效
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, error: '密码错误' });
    }
});

// 登录页面
app.get('/admin/login', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>x402 管理后台 - 登录</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-box {
            background: #16213e;
            padding: 40px;
            border-radius: 16px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        h1 {
            color: #fff;
            text-align: center;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #a0a0a0;
            margin-bottom: 8px;
        }
        input {
            width: 100%;
            padding: 15px;
            background: #1a1a2e;
            border: 2px solid #2d3748;
            border-radius: 8px;
            color: #fff;
            font-size: 1em;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.9; }
        .error {
            color: #fc8181;
            text-align: center;
            margin-top: 15px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>🎛️ 管理后台</h1>
        <div class="form-group">
            <label>管理员密码</label>
            <input type="password" id="password" placeholder="请输入密码" onkeypress="if(event.key==='Enter')login()">
        </div>
        <button class="btn" onclick="login()">登 录</button>
        <div class="error" id="error">密码错误</div>
    </div>
    <script>
        async function login() {
            const password = document.getElementById('password').value;
            const error = document.getElementById('error');
            try {
                const res = await fetch('/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('adminToken', data.token);
                    window.location = '/admin';
                } else {
                    error.style.display = 'block';
                }
            } catch (e) {
                error.style.display = 'block';
            }
        }
    </script>
</body>
</html>`;
    res.send(html);
});

// 管理后台主页
app.get('/admin', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>x402 管理后台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 20px;
            color: white;
        }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .card {
            background: #16213e;
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
        }
        .card h2 {
            color: #fff;
            margin-bottom: 20px;
            font-size: 1.3em;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            color: #a0a0a0;
            margin-bottom: 8px;
            font-size: 0.9em;
        }
        .form-group input {
            width: 100%;
            padding: 12px 15px;
            background: #1a1a2e;
            border: 2px solid #2d3748;
            border-radius: 8px;
            color: #fff;
            font-size: 1em;
            transition: border-color 0.2s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
        }
        .btn:hover { transform: translateY(-2px); opacity: 0.95; }
        .btn-danger {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        }
        .btn-small {
            padding: 8px 16px;
            font-size: 0.85em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #2d3748;
        }
        th { color: #a0a0a0; font-weight: normal; font-size: 0.85em; }
        td { color: #fff; }
        .key-code {
            font-family: monospace;
            background: #1a1a2e;
            padding: 4px 8px;
            border-radius: 4px;
            color: #68d391;
            font-size: 0.85em;
        }
        .status-active {
            color: #48bb78;
            font-weight: bold;
        }
        .status-inactive {
            color: #fc8181;
        }
        .usage-bar {
            background: #2d3748;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            width: 100px;
        }
        .usage-fill {
            background: linear-gradient(90deg, #48bb78, #68d391);
            height: 100%;
            transition: width 0.3s;
        }
        .usage-fill.warning {
            background: linear-gradient(90deg, #ed8936, #f6ad55);
        }
        .usage-fill.danger {
            background: linear-gradient(90deg, #fc8181, #feb2b2);
        }
        .new-key-box {
            background: #1a1a2e;
            border: 2px solid #48bb78;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
            display: none;
        }
        .new-key-box.show { display: block; }
        .new-key-box h3 {
            color: #48bb78;
            margin-bottom: 15px;
        }
        .copy-btn {
            background: #48bb78;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 10px;
        }
        .login-form {
            max-width: 400px;
            margin: 100px auto;
        }
        .error-msg {
            color: #fc8181;
            margin-top: 10px;
            font-size: 0.9em;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #1a1a2e;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            color: #667eea;
            font-weight: bold;
        }
        .stat-label {
            color: #a0a0a0;
            font-size: 0.85em;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎛️ x402 管理后台</h1>
            <p>API Key 管理与统计</p>
        </div>
        
        <div class="card">
            <h2>📊 统计概览</h2>
            <div class="stats-grid" id="stats">
                <div class="stat-card">
                    <div class="stat-value" id="totalKeys">-</div>
                    <div class="stat-label">总密钥数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="activeKeys">-</div>
                    <div class="stat-label">活跃密钥</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="totalCalls">-</div>
                    <div class="stat-label">总调用次数</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>🔑 创建新密钥</h2>
            <div class="form-group">
                <label>用户名称</label>
                <input type="text" id="keyName" placeholder="例如：张三">
            </div>
            <div class="form-group">
                <label>调用次数限制 (0 = 无限制)</label>
                <input type="number" id="keyLimit" value="100" min="0">
            </div>
            <button class="btn" onclick="createKey()">生成密钥</button>
            
            <div class="new-key-box" id="newKeyBox">
                <h3>✅ 密钥已创建！</h3>
                <p style="color: #a0a0a0; margin-bottom: 10px;">复制下面的密钥发送给用户：</p>
                <div style="display: flex; align-items: center;">
                    <code class="key-code" id="newKey" style="font-size: 1.1em; padding: 10px 15px;"></code>
                    <button class="copy-btn" onclick="copyKey()">📋 复制</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>📋 密钥列表</h2>
            <table>
                <thead>
                    <tr>
                        <th>密钥</th>
                        <th>用户</th>
                        <th>使用量</th>
                        <th>状态</th>
                        <th>创建日期</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="keysTable">
                    <tr><td colspan="6" style="text-align: center; color: #a0a0a0;">加载中...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        // 检查登录状态
        const token = localStorage.getItem('adminToken');
        if (!token) {
            window.location = '/admin/login';
        }
        
        // 验证 token
        fetch('/admin/verify?token=' + token)
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    localStorage.removeItem('adminToken');
                    window.location = '/admin/login';
                }
            })
            .catch(() => {
                localStorage.removeItem('adminToken');
                window.location = '/admin/login';
            });
        
        async function loadKeys() {
            try {
                const res = await fetch('/admin/keys?token=' + token);
                const data = await res.json();
                if (data.error === 'Unauthorized') {
                    localStorage.removeItem('adminToken');
                    window.location = '/admin/login';
                    return;
                }
                if (data.success) {
                    renderKeys(data.keys);
                    updateStats(data.keys);
                }
            } catch (e) {
                console.error(e);
            }
        }
        
        function updateStats(keys) {
            document.getElementById('totalKeys').textContent = keys.length;
            document.getElementById('activeKeys').textContent = keys.filter(k => k.active).length;
            document.getElementById('totalCalls').textContent = keys.reduce((sum, k) => sum + (k.calls || 0), 0);
        }
        
        function renderKeys(keys) {
            const tbody = document.getElementById('keysTable');
            if (keys.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #a0a0a0;">暂无密钥</td></tr>';
                return;
            }
            
            tbody.innerHTML = keys.map(k => {
                const usage = k.limit > 0 ? Math.round((k.calls || 0) / k.limit * 100) : 0;
                const usageClass = usage > 80 ? 'danger' : usage > 50 ? 'warning' : '';
                return '<tr>' +
                    '<td><code class="key-code">' + k.key + '</code></td>' +
                    '<td>' + (k.name || '-') + '</td>' +
                    '<td>' +
                        '<div style="display: flex; align-items: center; gap: 10px;">' +
                            '<div class="usage-bar"><div class="usage-fill ' + usageClass + '" style="width: ' + Math.min(usage, 100) + '%"></div></div>' +
                            '<span style="font-size: 0.85em;">' + (k.calls || 0) + '/' + (k.limit || '∞') + '</span>' +
                        '</div>' +
                    '</td>' +
                    '<td><span class="' + (k.active ? 'status-active' : 'status-inactive') + '">' + (k.active ? '活跃' : '已禁用') + '</span></td>' +
                    '<td>' + k.created + '</td>' +
                    '<td>' +
                        (k.active ? '<button class="btn btn-danger btn-small" onclick="disableKey(\\'' + k.key + '\\')">禁用</button>' : '') +
                    '</td>' +
                '</tr>';
            }).join('');
        }
        
        async function createKey() {
            const name = document.getElementById('keyName').value || 'Unnamed';
            const limit = parseInt(document.getElementById('keyLimit').value) || 100;
            
            try {
                const res = await fetch('/admin/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, name, limit })
                });
                const data = await res.json();
                if (data.error === 'Unauthorized') {
                    localStorage.removeItem('adminToken');
                    window.location = '/admin/login';
                    return;
                }
                if (data.success) {
                    document.getElementById('newKey').textContent = data.key;
                    document.getElementById('newKeyBox').classList.add('show');
                    document.getElementById('keyName').value = '';
                    loadKeys();
                }
            } catch (e) {
                alert('创建失败');
            }
        }
        
        async function disableKey(key) {
            if (!confirm('确定要禁用这个密钥吗？')) return;
            
            try {
                const res = await fetch('/admin/keys/' + key + '?token=' + token, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.error === 'Unauthorized') {
                    localStorage.removeItem('adminToken');
                    window.location = '/admin/login';
                    return;
                }
                if (data.success) {
                    loadKeys();
                }
            } catch (e) {
                alert('禁用失败');
            }
        }
        
        function copyKey() {
            const key = document.getElementById('newKey').textContent;
            navigator.clipboard.writeText(key);
            alert('已复制！');
        }
        
        // 初始加载
        loadKeys();
        // 每30秒刷新
        setInterval(loadKeys, 30000);
    </script>
</body>
</html>`;
    res.send(html);
});

// ==================== 首页 ====================

app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>x402 API Gateway - AI Agent 支付标准</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 50px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-bottom: 15px;
        }
        h1 {
            font-size: 2.8em;
            margin-bottom: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #666;
            font-size: 1.2em;
        }
        .free-banner {
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 40px;
        }
        .free-banner h2 { font-size: 1.5em; margin-bottom: 8px; }
        .free-banner p { opacity: 0.95; }
        .section {
            margin: 35px 0;
        }
        .section h2 {
            color: #333;
            font-size: 1.5em;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
        }
        .steps {
            counter-reset: step;
        }
        .step {
            display: flex;
            align-items: flex-start;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .step-num {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2em;
            margin-right: 20px;
            flex-shrink: 0;
        }
        .step-content h3 { color: #333; margin-bottom: 8px; }
        .step-content p { color: #666; line-height: 1.6; }
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
        }
        .api-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .api-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .api-card .path {
            font-family: monospace;
            color: #667eea;
            font-size: 0.95em;
            margin-bottom: 10px;
        }
        .api-card .desc { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .api-card .price {
            font-weight: bold;
            color: #333;
            font-size: 1.2em;
        }
        .code-block {
            background: #2d3748;
            color: #68d391;
            padding: 15px 20px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 0.9em;
            margin: 15px 0;
            overflow-x: auto;
            line-height: 1.5;
        }
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
        }
        .info-box h3 { color: #1976d2; margin-bottom: 10px; }
        .info-box p { color: #555; line-height: 1.6; }
        .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
        }
        .address-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            word-break: break-all;
            margin: 10px 0;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            font-size: 1.1em;
            margin-top: 20px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        .footer {
            margin-top: 50px;
            padding-top: 30px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
        }
        .footer a { color: #667eea; text-decoration: none; }
        .faq { margin-top: 20px; }
        .faq-item {
            margin: 15px 0;
            padding: 15px 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .faq-item q { font-weight: bold; color: #333; display: block; margin-bottom: 8px; }
        .faq-item a { color: #666; line-height: 1.6; }
        @media (max-width: 600px) {
            .container { padding: 30px 20px; }
            h1 { font-size: 2em; }
            .step { flex-direction: column; }
            .step-num { margin-bottom: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="badge">x402 Payment Standard</span>
            <h1>🚀 x402 API Gateway</h1>
            <p class="subtitle">AI Agent 支付标准 API 服务 - 无需注册，按次付费</p>
        </div>
        
        <div class="free-banner">
            <h2>🎁 免费试用！</h2>
            <p>联系 @king151 获取免费 API Key，100 次免费调用，无需付费</p>
        </div>
        
        <div class="section">
            <h2>📖 使用流程</h2>
            <div class="steps">
                <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <h3>获取 API Key</h3>
                        <p>联系 <strong>@king151</strong> (Telegram) 免费获取 API Key，立即开始测试，100 次免费调用。</p>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <h3>调用 API</h3>
                        <p>在请求中添加 <code>X-API-Key</code> Header 或 <code>api_key</code> 参数即可使用。</p>
                        <div class="code-block">curl -H "X-API-Key: YOUR_KEY" http://x402.ai2091.com/api/weather?city=Tokyo</div>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <h3>获取数据</h3>
                        <p>API 返回 JSON 格式数据，直接使用。无需复杂认证，简单高效。</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>📡 可用 API</h2>
            <div class="api-grid">
                <div class="api-card">
                    <div class="path">/api/weather?city=Shanghai</div>
                    <div class="desc">获取指定城市的实时天气信息（温度、湿度、风速等）</div>
                    <div class="price">$0.01 / 次</div>
                </div>
                <div class="api-card">
                    <div class="path">/api/crypto?ids=bitcoin,ethereum</div>
                    <div class="desc">获取加密货币实时价格和24小时涨跌幅</div>
                    <div class="price">$0.01 / 次</div>
                </div>
                <div class="api-card">
                    <div class="path">/api/exchange?base=USD</div>
                    <div class="desc">获取指定货币的汇率信息</div>
                    <div class="price">$0.005 / 次</div>
                </div>
                <div class="api-card">
                    <div class="path">/api/news</div>
                    <div class="desc">获取最新加密货币新闻资讯</div>
                    <div class="price">$0.02 / 次</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🔑 使用方式</h2>
            <div class="info-box">
                <h3>方式一：Header（推荐）</h3>
                <div class="code-block">curl -H "X-API-Key: YOUR_KEY" http://x402.ai2091.com/api/weather?city=Tokyo</div>
            </div>
            <div class="info-box">
                <h3>方式二：URL 参数</h3>
                <div class="code-block">curl "http://x402.ai2091.com/api/weather?city=Tokyo&api_key=YOUR_KEY"</div>
            </div>
        </div>
        
        <div class="section">
            <h2>💰 付费方式（可选）</h2>
            <p style="color: #666; margin-bottom: 15px;">如果您不想使用 API Key，也可以直接支付 USDC 获取数据：</p>
            <div class="warning-box">
                <strong>⚠️ 支付流程：</strong>
                <ol style="margin: 10px 0 0 20px; color: #856404;">
                    <li>调用 API（无 Key）会返回支付信息</li>
                    <li>向收款地址转账 USDC（Polygon 网络）</li>
                    <li>联系 @king151 提供交易哈希</li>
                    <li>获取数据或 API Key</li>
                </ol>
            </div>
            <div class="info-box">
                <strong>收款地址：</strong>
                <div class="address-box">${RECEIVER_ADDRESS}</div>
                <strong>网络：</strong> Polygon (MATIC) &nbsp;|&nbsp; <strong>代币：</strong> USDC
            </div>
        </div>
        
        <div class="section">
            <h2>❓ 常见问题</h2>
            <div class="faq">
                <div class="faq-item">
                    <q>API Key 有使用限制吗？</q>
                    <a>免费 Key 默认 100 次调用。用完后可付费购买更多次数，或申请新 Key。</a>
                </div>
                <div class="faq-item">
                    <q>API Key 可以分享给别人吗？</q>
                    <a>可以，但调用次数会共享。建议每人单独申请一个 Key。</a>
                </div>
                <div class="faq-item">
                    <q>支付后多久能使用？</q>
                    <a>支付确认后立即生效。Polygon 网络确认通常只需几秒钟。</a>
                </div>
                <div class="faq-item">
                    <q>支持哪些 AI Agent？</q>
                    <a>支持 x402 标准的 AI Agent 可自动处理支付。目前推荐使用 API Key 方式。</a>
                </div>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
            <a href="https://t.me/king151" target="_blank" class="btn">📱 获取免费 API Key</a>
        </div>
        
        <div class="footer">
            <p>基于 <a href="https://x402.org" target="_blank">x402 开放标准</a> | Powered by <a href="https://openclaw.ai" target="_blank">OpenClaw</a></p>
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 3456;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`x402 API 服务运行在端口 ${PORT}`);
});

module.exports = app;
