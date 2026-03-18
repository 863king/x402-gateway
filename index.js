/**
 * x402 中间商服务
 * 功能：整合免费API，用x402保护收费
 * 作者：9527
 * 日期：2026-03-18
 */

const express = require('express');
const axios = require('axios');
const { paymentMiddleware, X402PaymentRequiredError } = require('@x402/express');

const app = express();
app.use(express.json());

// ==================== 配置 ====================

// 收款钱包地址（你的Polygon钱包）
const RECEIVER_ADDRESS = '0x8B6E03d1Db3f7F773a49124f4b721E7A8b182f83';

// 价格配置（单位：USDC）
const PRICES = {
    '/api/weather': 0.01,      // 天气查询 $0.01
    '/api/crypto': 0.01,       // 加密货币行情 $0.01
    '/api/news': 0.02,         // 新闻聚合 $0.02
    '/api/exchange': 0.005,     // 汇率查询 $0.005
};

// x402 中间件配置
app.use(paymentMiddleware({
    '/api/weather': {
        accepts: ['USDC'],
        description: 'Get current weather data',
    },
    '/api/crypto': {
        accepts: ['USDC'],
        description: 'Get cryptocurrency prices',
    },
    '/api/news': {
        accepts: ['USDC'],
        description: 'Get latest news',
    },
    '/api/exchange': {
        accepts: ['USDC'],
        description: 'Get exchange rates',
    },
}));

// ==================== 免费 API 代理 ====================

// 1. 天气查询 (使用 wttr.in 免费API)
app.get('/api/weather', async (req, res) => {
    try {
        const city = req.query.city || 'Shanghai';
        const response = await axios.get(`https://wttr.in/${city}?format=j1`);
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

// 2. 加密货币行情 (使用 CoinGecko 免费API)
app.get('/api/crypto', async (req, res) => {
    try {
        const ids = req.query.ids || 'bitcoin,ethereum,solana';
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: ids,
                vs_currencies: 'usd',
                include_24hr_change: true
            }
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

// 3. 汇率查询 (使用 exchangerate-api 免费API)
app.get('/api/exchange', async (req, res) => {
    try {
        const base = req.query.base || 'USD';
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`);
        
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

// 4. 新闻聚合 (使用 CryptoCompare 免费API)
app.get('/api/news', async (req, res) => {
    try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
            params: { lang: 'EN' }
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

// ==================== 首页 ====================

app.get('/', (req, res) => {
    res.json({
        name: 'x402 API Service',
        version: '1.0.0',
        receiver: RECEIVER_ADDRESS,
        endpoints: Object.keys(PRICES).map(path => ({
            path,
            price: PRICES[path],
            currency: 'USDC'
        })),
        description: 'Paid API service with x402 payment'
    });
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║       x402 中间商服务已启动                   ║
╠═══════════════════════════════════════════════╣
║  收款地址: ${RECEIVER_ADDRESS.slice(0, 20)}...║
║  端口: ${PORT}                                  ║
╠═══════════════════════════════════════════════╣
║  可用接口:                                     ║
║  • GET /api/weather?city=Shanghai - $0.01     ║
║  • GET /api/crypto?ids=bitcoin - $0.01       ║
║  • GET /api/exchange?base=USD - $0.005       ║
║  • GET /api/news - $0.02                      ║
╚═══════════════════════════════════════════════╝
    `);
});

module.exports = app;
