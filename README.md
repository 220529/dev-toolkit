# Dev Toolkit

开发工具集合 - 提供SSH隧道管理、API代理等多种开发辅助工具

## 功能特性

- 🔗 **SSH隧道管理** - 自动管理多个SSH端口转发
- 🌐 **API代理服务** - 本地代理服务器，转发请求到目标服务器
- 🛠️ **开发辅助** - 简化开发流程的工具集合

## 安装

```bash
pnpm install
```

## 使用方法

### SSH隧道管理

```bash
# 启动SSH隧道
pnpm ssh
```

### API代理服务

```bash
# 启动API代理服务器（默认端口7001）
pnpm api

# 指定端口启动
pnpm api 8000
```

#### API使用示例

```bash
# 发送请求到代理服务器
curl --location --request POST "http://127.0.0.1:7001/api/runFlow" \
--header 'Content-Type: application/json; charset=utf-8' \
--header 'Accept: */*' \
--header "Host: localhost" \
--header 'Connection: keep-alive' \
--data-raw '{
  "dataPath": "./data.js",
  "hostPre": "http://localhost:7098",
  "host": "localhost"
}'
```

## 项目结构

```
dev-toolkit/
├── tools/
│   ├── ssh-tunnel.js    # SSH隧道管理工具
│   └── api-runner.js    # API代理服务工具
├── data.js              # 示例数据文件
├── package.json
└── README.md
```

## 许可证

ISC 