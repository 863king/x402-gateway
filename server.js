/**
 * x402 中间商服务 - 友好版
 * 首页返回 HTML 而不是 JSON
 */

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==================== 配置 ====================

const RECEIVER_ADDRESS = '0x8B6E03d1Db3f7F773a49124f4b721E7A8b182f83';

// API 价格（USDC）
const API_PRICES = {
    '/api/weather': 10000,    // $0.01 = 10000 微USDC
    '/api/crypto': 10000,     // $0.01
    '/api/exchange': 5000,    // $0.005
    '/api/news': 20000,       // $0.02
};

// ==================== x402 中间件 ====================

function x402Middleware(req, res, next) {
    const path = req.path;
    const price = API_PRICES[path];
    
    if (!price) {
        return next();
    }
    
    const paymentSignature = req.headers['x-payment'];
    
    if (!paymentSignature) {
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
        
        return res.status(402).json({
            error: 'Payment Required',
            payment_required: Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
            message: `This API costs $${price / 1000000} USDC`
        });
    }
    
    next();
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
            paid: true,
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
            paid: true,
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
            paid: true,
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
            paid: true,
            data: articles,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 首页 HTML ====================

app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>x402 API Gateway</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            margin-bottom: 20px;
        }
        .api-list {
            list-style: none;
        }
        .api-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            margin: 10px 0;
            background: #f8f9fa;
            border-radius: 12px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .api-item:hover {
            transform: translateX(10px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .api-path {
            font-family: monospace;
            font-size: 1.1em;
            color: #333;
        }
        .api-price {
            font-weight: bold;
            color: #667eea;
            font-size: 1.2em;
        }
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .info-box code {
            background: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 0.9em;
        }
        .footer a { color: #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <span class="badge">x402 Payment Standard</span>
        <h1>🚀 x402 API Gateway</h1>
        <p class="subtitle">AI Agent 支付标准 API 服务 - 无需注册，直接支付使用</p>
        
        <div class="info-box">
            <strong>💡 使用方式：</strong><br><br>
            <strong>方式1：AI Agent 自动支付</strong><br>
            支持 x402 标准的 AI Agent 会自动处理支付流程<br><br>
            <strong>方式2：手动测试</strong><br>
            1. 打开 API 端点，如 <code>/api/weather?city=Shanghai</code><br>
            2. 页面返回支付信息（JSON格式）<br>
            3. 用钱包转账 USDC 到收款地址<br>
            4. 联系我们获取数据（测试期间免费体验）<br><br>
            <strong>🎯 测试期间免费！</strong>直接联系 @king151 体验
        </div>
        
        <h2 style="margin: 20px 0 10px; color: #333;">📡 可用 API</h2>
        <ul class="api-list">
            <li class="api-item">
                <span class="api-path">/api/weather?city=Shanghai</span>
                <span class="api-price">$0.01</span>
            </li>
            <li class="api-item">
                <span class="api-path">/api/crypto?ids=bitcoin</span>
                <span class="api-price">$0.01</span>
            </li>
            <li class="api-item">
                <span class="api-path">/api/exchange?base=USD</span>
                <span class="api-price">$0.005</span>
            </li>
            <li class="api-item">
                <span class="api-path">/api/news</span>
                <span class="api-price">$0.02</span>
            </li>
        </ul>
        
        <h2 style="margin: 30px 0 10px; color: #333;">💰 支付信息</h2>
        <div class="info-box">
            <strong>收款地址：</strong><br>
            <code style="word-break: break-all;">${RECEIVER_ADDRESS}</code><br><br>
            <strong>网络：</strong> Polygon (MATIC)<br>
            <strong>代币：</strong> USDC<br>
            <strong>手续费：</strong> 零手续费
        </div>
        
        <div class="footer">
            <p>基于 <a href="https://x402.org" target="_blank">x402 开放标准</a> | 
               Powered by <a href="https://openclaw.ai" target="_blank">OpenClaw</a></p>
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
