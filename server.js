const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const serve = require('koa-static');
const { koaBody } = require('koa-body');
const fs = require('fs');
const xlsx = require('node-xlsx');
const materialsConfig = require('./schemas/materials-mapping');

const app = new Koa();
const router = new Router();

// 中间件
app.use(cors());
app.use(serve('.'));
app.use(koaBody({
  multipart: true,
  formidable: {
    uploadDir: './uploads',
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
}));

// Excel解析路由
router.post('/api/parseExcel', async (ctx) => {
  let tempFilePath = null;
  
  try {
    console.log('\n' + '🔥'.repeat(20));
    console.log('📥 \x1b[96m[Excel解析开始]\x1b[0m');
    const file = ctx.request.files.excelFile;
    console.log('📎 文件名称: \x1b[93m' + (file ? file.originalFilename : '无文件') + '\x1b[0m');
    if (file) {
      console.log('📏 文件大小: \x1b[94m' + Math.round(file.size / 1024) + 'KB\x1b[0m');
    }
    
    if (!file) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '请上传Excel文件'
      };
      return;
    }

    // 验证文件类型
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];
    
    const isValidExcel = allowedTypes.includes(file.mimetype) || 
                        /\.(xlsx?|csv)$/i.test(file.originalFilename);
    
    if (!isValidExcel) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '请上传有效的Excel文件（.xlsx, .xls 或 .csv）'
      };
      return;
    }

    // 验证文件大小
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: `文件过大，最大支持 ${maxSize / 1024 / 1024}MB`
      };
      return;
    }

    tempFilePath = file.filepath;
    
    // 解析Excel
    console.log('⚡ \x1b[95m正在解析Excel文件...\x1b[0m');
    const workbook = xlsx.parse(fs.readFileSync(file.filepath));
    const sheet = workbook[0];
    console.log('📊 工作表数量: \x1b[92m' + workbook.length + '\x1b[0m');
    
    if (!sheet || sheet.data.length === 0) {
      console.log('❌ \x1b[91mExcel文件为空或无数据\x1b[0m');
      ctx.body = {
        success: false,
        message: 'Excel文件为空'
      };
      return;
    }

    const headers = sheet.data[0];
    const rows = sheet.data.slice(1);
    console.log('📋 表头信息: \x1b[36m[' + headers.join(', ') + ']\x1b[0m');
    console.log('📈 数据行数: \x1b[92m' + rows.length + '\x1b[0m');

    // 映射数据并进行类型转换
    const mappedData = rows.slice(0, 10).map((row, rowIndex) => {
      const rowData = {};
      
      headers.forEach((header, colIndex) => {
        const dbField = materialsConfig.fieldMapping[header];
        if (dbField) {
          const rawValue = row[colIndex];
          // 使用映射配置的转换函数
          rowData[dbField] = materialsConfig.convertValue(rawValue, dbField);
        }
      });
      
      return rowData;
    }).filter(item => {
      // 只输出purchasePrice、taxRate有值的记录
      return item.purchasePrice !== null && item.purchasePrice !== 0 &&
             item.taxRate !== null && item.taxRate !== 0;
    });

    // 清理临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.log('🎯 \x1b[96m映射完成统计:\x1b[0m');
    console.log('   原始记录: \x1b[93m' + rows.length + '\x1b[0m');
    console.log('   有效记录: \x1b[92m' + mappedData.length + '\x1b[0m');
    console.log('   过滤率: \x1b[94m' + Math.round((1 - mappedData.length / rows.length) * 100) + '%\x1b[0m');
    
    if (mappedData.length > 0) {
      console.log('✨ \x1b[92m示例数据:\x1b[0m');
      console.table(mappedData.slice(0, 3));
    }
    
    console.log('🔥'.repeat(20) + '\n');

    // 直接返回解析后的JSON数据
    ctx.body = mappedData;

  } catch (error) {
    console.log('💥 \x1b[91m[解析失败]\x1b[0m');
    console.log('❌ 错误信息: \x1b[91m' + error.message + '\x1b[0m');
    console.log('🔥'.repeat(20) + '\n');
    
    // 清理临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

// 健康检查
router.get('/health', (ctx) => {
  ctx.body = { 
    status: 'ok',
    timestamp: new Date().toISOString()
  };
});

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = 5001;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 \x1b[36mExcel解析服务已启动\x1b[0m');
  console.log('📡 服务地址: \x1b[32mhttp://localhost:' + PORT + '\x1b[0m');
  console.log('📋 测试页面: \x1b[32mhttp://localhost:' + PORT + '/test.html\x1b[0m');
  console.log('📊 支持字段: \x1b[33m产品编码, 产品名称, 采购价, 税点, 不含税采购价\x1b[0m');
  console.log('⏰ 启动时间: ' + new Date().toLocaleString());
  console.log('='.repeat(60) + '\n');
});
