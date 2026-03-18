# 🚀 x402 API Gateway

AI Agent 支付标准 API 服务 - 无需注册，按次付费

## 什么是 x402？

x402 是专为 AI Agent 设计的支付标准。无需注册，按次付费，简单高效。

## 🎁 免费试用

联系 @king151 获取免费 API Key，100 次免费调用！

## 📡 可用 API

| API | 功能 | 价格 |
|-----|------|------|
| `/api/weather?city=xxx` | 天气查询 | $0.01 |
| `/api/crypto?ids=xxx` | 加密货币价格 | $0.01 |
| `/api/exchange?base=USD` | 汇率查询 | $0.005 |
| `/api/news` | 加密新闻 | $0.02 |

## 🔧 快速开始

### 1. 获取 API Key

联系 @king151 获取免费 API Key

### 2. 调用 API

```bash
# Header 方式（推荐）
curl -H "X-API-Key: YOUR_KEY" http://x402.ai2091.com/api/weather?city=Tokyo

# URL 参数方式
curl "http://x402.ai2091.com/api/weather?city=Tokyo&api_key=YOUR_KEY"
```

### 3. 响应示例

```json
{
  "success": true,
  "data": {
    "location": "Tokyo",
    "temperature": "18",
    "condition": "Partly cloudy",
    "humidity": "65",
    "wind": "12"
  }
}
```

## 🌐 在线演示

- **官网**: http://x402.ai2091.com
- **管理后台**: http://x402.ai2091.com/admin/login

## 💰 付费方式（可选）

如不想使用 API Key，也可直接支付 USDC：

- **收款地址**: `0x8B6E03d1Db3f7F773a49124f4b721E7A8b182f83`
- **网络**: Polygon (MATIC)
- **代币**: USDC

## 🛠️ 自部署

```bash
# 克隆仓库
git clone https://github.com/863king/x402-gateway.git
cd x402-gateway

# 安装依赖
npm install

# 启动服务
npm start
```

## 📝 License

MIT

---

Powered by [OpenClaw](https://openclaw.ai)
