/**
 * API 运行工具
 * 
 * 功能说明：
 * 1. 启动本地HTTP服务器监听端口7001
 * 2. 接收POST请求，读取指定文件内容
 * 3. 将文件内容与请求数据一起转发到目标服务器
 * 
 * 使用方法：
 * - 直接运行: node tools/api-runner.js
 * - 通过 npm: npm run api
 * - 通过 pnpm: pnpm api
 * 
 * 请求格式：
 * POST http://127.0.0.1:7001/api/runFlow
 * Content-Type: application/json
 * {
 *   "dataPath": "./data.js",
 *   "hostPre": "http://localhost:7098",
 *   "host": "localhost",
 *   ...其他参数
 * }
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * 发送HTTP请求到目标服务器
 * @param {string} url - 目标URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} - 响应数据
 */
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          resolve({ rawData: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
  });
}

/**
 * 启动Express服务器
 * @param {number} port - 监听端口
 */
function startServer(port = 7001) {
  const app = express();
  
  // 中间件配置
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // CORS中间件
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Host, Connection');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  
  // API路由
  app.post('/api/runFlow', async (req, res) => {
    try {
      const { dataPath, hostPre, host, ...otherData } = req.body;
      
      // 检查必需参数
      if (!dataPath) {
        return res.status(400).json({ 
          error: 'Missing dataPath parameter',
          message: '请在请求体中包含dataPath字段'
        });
      }
      
      if (!hostPre) {
        return res.status(400).json({ 
          error: 'Missing hostPre parameter',
          message: '请在请求体中包含hostPre字段'
        });
      }
      
      if (!host) {
        return res.status(400).json({ 
          error: 'Missing host parameter',
          message: '请在请求体中包含host字段'
        });
      }
      
      // 验证文件路径
      const fullPath = path.resolve(dataPath);
      if (!fs.existsSync(fullPath)) {
        return res.status(400).json({ 
          error: 'File not found',
          message: `文件不存在: ${dataPath}`,
          path: fullPath
        });
      }
      
      // 读取文件内容
      const jsData = fs.readFileSync(fullPath, 'utf8');
      console.log(`收到请求 - 读取文件: ${dataPath} (${jsData.length} 字符)`);
      
      // 构建转发数据
      const forwardData = {
        ...otherData,
        dataPath,
        host,
        data: jsData
      };
      
      // 构建目标URL
      const targetUrl = `${hostPre}/api/open/runFlow`;
      console.log(`转发到: ${targetUrl}`);
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Host': host,
        'Connection': 'keep-alive'
      };
      
      // 发送请求到目标服务器
      const response = await makeRequest(targetUrl, {
        method: 'POST',
        headers: headers,
        data: forwardData
      });
      
      console.log(`转发成功 - 响应状态: ${response.code || 'unknown'}`);
      
      // 返回目标服务器的响应
      res.json(response);
      
    } catch (error) {
      console.error('处理请求时出错:', error.message);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
      });
    }
  });
  
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      port: port
    });
  });
  
  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: 'Not Found',
      message: `路径 ${req.originalUrl} 不存在`
    });
  });
  
  // 错误处理中间件
  app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  });
  
  // 启动服务器
  const server = app.listen(port, () => {
    console.log(`🚀 代理服务器已启动，监听端口: ${port}`);
    console.log(`📡 API端点: http://127.0.0.1:${port}/api/runFlow`);
    console.log(`💚 健康检查: http://127.0.0.1:${port}/health`);
    console.log(`⏹️  按 Ctrl+C 停止服务器`);
  });
  
  // 处理服务器错误
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${port} 已被占用，请尝试其他端口`);
    } else {
      console.error('❌ 服务器错误:', error.message);
    }
    process.exit(1);
  });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.close(() => {
      console.log('✅ 服务器已关闭');
      process.exit(0);
    });
  });
  
  return server;
}

/**
 * 主函数：启动API服务器
 */
function main() {
  // 从命令行参数获取端口（可选）
  const args = process.argv.slice(2);
  const port = args[0] ? parseInt(args[0]) : 7001;
  
  // 启动服务器
  startServer(port);
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

module.exports = { startServer }; 