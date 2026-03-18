# x402 API Gateway

🚀 AI Agent 支付标准 API 服务

## 简介

基于 [x402](https://x402.org) 开放标准的 API 网关，让 AI Agent 可以用 USDC 支付使用数据服务。

## 特点

- ✅ **无需注册** - AI Agent 直接调用
- ✅ **零手续费** - 只有网络 Gas 费
- ✅ **即时到账** - Polygon 网络
- ✅ **开放标准** - 基于 Coinbase x402 协议

## 可用 API

| 端点 | 价格 | 功能 |
|------|------|------|
| `/api/weather?city=Shanghai` | $0.01 USDC | 天气查询 |
| `/api/crypto?ids=bitcoin` | $0.01 USDC | 加密货币行情 |
| `/api/exchange?base=USD` | $0.005 USDC | 汇率查询 |
| `/api/news` | $0.02 USDC | 新闻聚合 |

## 使用方式

### 方式1：AI Agent 自动支付

支持 x402 标准的 AI Agent 会自动处理支付：

```javascript
const response = await fetch('http://your-server:3456/api/weather?city=Shanghai');
// AI Agent 自动支付，返回数据
```

### 方式2：手动测试

```bash
# 1. 发送请求
curl http://your-server:3456/api/weather?city=Shanghai

# 2. 收到 402 响应
{
  "error": "Payment Required",
  "payment_required": "...",
  "message": "This API costs $0.01 USDC"
}

# 3. 支付 USDC 到指定地址

# 4. 带签名重新请求
curl -H "X-Payment: <signature>" http://your-server:3456/api/weather?city=Shanghai
```

## 部署

```bash
# 克隆仓库
git clone https://github.com/your-username/x402-api-gateway.git
cd x402-api-gateway

# 安装依赖
npm install

# 启动
npm start

# 或用 pm2 托管
pm2 start server.js --name x402-api
```

## 配置

修改 `server.js` 中的收款地址：

```javascript
const RECEIVER_ADDRESS = '0xYourWalletAddress';
```

## 数据源

- 天气: [wttr.in](https://wttr.in) (免费)
- 加密货币: [CoinGecko](https://coingecko.com) (免费)
- 汇率: [ExchangeRate-API](https://exchangerate-api.com) (免费)
- 新闻: [CryptoCompare](https://cryptocompare.com) (免费)

## 收益模式

1. 免费整合公开数据源
2. 用 x402 收费提供服务
3. 100% 利润（无中间商）

## 许可证

MIT

## 相关链接

- [x402 官网](https://x402.org)
- [Coinbase x402 GitHub](https://github.com/coinbase/x402)
- [OpenClaw](https://openclaw.ai)

---

**Made with ❤️ by [9527Craft](https://openclaw.ai)**
