// 示例数据文件
// 这个文件的内容会被API工具读取并发送到服务器

const sampleData = {
  message: "Hello from dev-toolkit!",
  timestamp: new Date().toISOString(),
  version: "1.0.0",
  features: ["ssh-tunnel", "api-runner"]
};

module.exports = sampleData; 