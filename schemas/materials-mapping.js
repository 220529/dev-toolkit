/**
 * Materials表字段映射配置
 * 简单直接的映射关系定义
 */

module.exports = {
  // 表基本信息
  tableName: 'materials',
  displayName: '材料表',
  
  // Excel列名到数据库字段的映射
  fieldMapping: {
    '产品编码': 'number',
    '产品名称': 'name',
    '采购价': 'purchasePrice',
    '税点': 'taxRate',
    '不含税采购价': 'untaxedPurchasePrice',
  },

  // 数据类型转换规则
  typeConversion: {
    // 整数类型字段
    intFields: ['taxRate'],
    
    // 浮点数类型字段  
    doubleFields: ['purchasePrice', 'untaxedPurchasePrice']
  },

  // 数据转换函数
  convertValue(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const { intFields, doubleFields } = this.typeConversion;
    
    if (intFields.includes(fieldName)) {
      const num = parseInt(value);
      return isNaN(num) ? null : num;
    }
    
    if (doubleFields.includes(fieldName)) {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    
    // 默认返回字符串
    return String(value);
  }
};
