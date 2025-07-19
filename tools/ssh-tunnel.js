/**
 * SSH 隧道管理工具
 * 
 * 功能说明：
 * 1. 自动检查并释放被占用的端口
 * 2. 启动多个 SSH 隧道进行端口转发
 * 3. 验证隧道建立状态
 * 
 * 支持的平台：
 * - Windows (使用 netstat 和 taskkill)
 * - macOS/Linux (使用 lsof 和 kill)
 * 
 * 使用方法：
 * - 直接运行: node tools/ssh-tunnel.js
 * - 通过 npm: npm run ssh
 * - 通过 pnpm: pnpm ssh
 * 
 * 配置说明：
 * - ports: 需要转发的端口列表
 * - host: 远程服务器地址
 * - user: SSH 用户名
 * - sshPort: SSH 连接端口
 * 
 */

const { spawn, exec } = require('child_process');
const os = require('os');

/**
 * 检查指定端口是否被占用
 * @param {number} port - 要检查的端口号
 * @returns {Promise<boolean>} - 返回 true 表示端口被占用，false 表示端口空闲
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const platform = os.platform();
    let command, args;
    
    // 根据操作系统选择不同的命令
    if (platform === 'win32') {
      // Windows 系统使用 netstat 命令
      command = 'netstat';
      args = ['-ano'];
    } else {
      // Unix/Linux/macOS 系统使用 lsof 命令
      command = 'lsof';
      args = ['-i', `:${port}`];
    }
    
    // 执行命令检查端口占用情况
    exec(`${command} ${args.join(' ')}`, (error, stdout) => {
      if (error) {
        // 如果命令执行失败，假设端口未被占用
        resolve(false);
        return;
      }
      
      // 检查输出中是否包含目标端口
      const isOccupied = stdout.includes(`:${port}`);
      resolve(isOccupied);
    });
  });
}

/**
 * 终止占用指定端口的进程
 * @param {number} port - 要释放的端口号
 * @returns {Promise<void>}
 */
async function killPortProcess(port) {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows 系统：使用 netstat 查找进程，然后用 taskkill 终止
    return new Promise((resolve) => {
      // 查找监听指定端口的进程
      exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (error, stdout) => {
        if (stdout) {
          const lines = stdout.split('\n');
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const pid = parts[4]; // 第5列是进程ID
              // 强制终止进程
              exec(`taskkill /PID ${pid} /F`, (killError) => {
                if (!killError) {
                  console.log(`终止占用端口 ${port} 的进程 (PID: ${pid})`);
                }
              });
            }
          });
        }
        resolve();
      });
    });
  } else {
    // Unix/Linux/macOS 系统：使用 lsof 查找进程，然后用 kill 终止
    return new Promise((resolve) => {
      exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
        if (!error) {
          console.log(`终止占用端口 ${port} 的进程`);
        }
        resolve();
      });
    });
  }
}

/**
 * 启动 SSH 隧道
 * @param {number} localPort - 本地监听端口
 * @param {number} remotePort - 远程端口
 * @param {string} host - 远程主机地址
 * @param {string} user - SSH 用户名
 * @param {string} sshPort - SSH 连接端口
 */
function startSSHTunnel(localPort, remotePort, host, user, sshPort) {
  // SSH 命令参数说明：
  // -l: 指定用户名
  // -N: 不执行远程命令（仅用于端口转发）
  // -L: 本地端口转发（localPort:localhost:remotePort）
  // -p: 指定 SSH 连接端口
  const args = [
    '-l', user,
    '-NL', `${localPort}:localhost:${remotePort}`,
    '-p', sshPort,
    host
  ];
  
  // 启动 SSH 进程
  const sshProcess = spawn('ssh', args, {
    detached: true,  // 使进程独立运行，不依赖于父进程
    stdio: 'ignore'  // 忽略标准输入输出，避免阻塞
  });
  
  // 解除对子进程的引用，允许父进程退出时子进程继续运行
  sshProcess.unref();
  console.log(`启动 SSH 隧道: 本地端口 ${localPort} -> 远程端口 ${remotePort}`);
}

/**
 * 主函数：管理 SSH 隧道
 * 1. 检查并释放被占用的端口
 * 2. 启动多个 SSH 隧道
 * 3. 验证隧道状态
 */
async function main() {
  // SSH 隧道配置
  const ports = [53748, 59284, 57236];  // 需要转发的端口列表
  const host = 'test-tx-01.tintan.net'; // 远程服务器地址
  const user = 'lkx';                   // SSH 用户名
  const sshPort = '58274';              // SSH 连接端口
  
  console.log('检查并终止占用端口的进程...');
  
  // 第一步：检查并终止占用端口的进程
  for (const port of ports) {
    const isOccupied = await checkPort(port);
    if (isOccupied) {
      await killPortProcess(port);
    }
  }
  
  console.log('启动 SSH 隧道...');
  
  // 第二步：启动所有 SSH 隧道
  for (const port of ports) {
    startSSHTunnel(port, port, host, user, sshPort);
  }
  
  // 第三步：等待隧道初始化并检查状态
  setTimeout(async () => {
    console.log('\nSSH 隧道状态：');
    
    for (const port of ports) {
      const isOccupied = await checkPort(port);
      if (isOccupied) {
        console.log(`[成功] 端口 ${port} 转发已建立`);
      } else {
        console.log(`[失败] 端口 ${port} 转发未建立`);
      }
    }
  }, 1000); // 等待1秒让隧道完全建立
}

// 启动程序并处理错误
main().catch(console.error); 