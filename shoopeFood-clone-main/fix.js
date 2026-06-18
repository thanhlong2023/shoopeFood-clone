const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'grab-food-monolith', 'src');

// 1. Fix orderController.js
const orderControllerPath = path.join(srcDir, 'controllers', 'orderController.js');
let orderController = fs.readFileSync(orderControllerPath, 'utf8');

const regexEmit = /try\s*\{\s*socketManager\.getIO\(\)\.emit\(?["']order:updated["']?,\s*orderData\);\s*socketManager\.getIO\(\)\.emit\(?["']order:\$\{orderData\.id\}:updated["']?,\s*orderData\);\s*\}\s*catch\s*\(error\)\s*\{\s*console\.log\("Socket not ready or err",\s*error\.message\);\s*\}/g;

orderController = orderController.replace(regexEmit, 'emitOrderUpdated("order:updated", orderData);');
fs.writeFileSync(orderControllerPath, orderController);
console.log('Fixed orderController.js');

// 2. Fix orderWorkflowService.js
const workflowServicePath = path.join(srcDir, 'services', 'orderWorkflowService.js');
let workflowService = fs.readFileSync(workflowServicePath, 'utf8');
workflowService = workflowService.replace(
  'DRIVER_ACCEPTED: ["PICKING_UP", "CANCELLED"]',
  'DRIVER_ACCEPTED: ["PICKING_UP"]'
).replace(
  'PICKING_UP: ["DELIVERING", "CANCELLED"]',
  'PICKING_UP: ["DELIVERING"]'
);
fs.writeFileSync(workflowServicePath, workflowService);
console.log('Fixed orderWorkflowService.js');

// 3. Fix orderTimeoutService.js
const timeoutServicePath = path.join(srcDir, 'services', 'orderTimeoutService.js');
let timeoutService = fs.readFileSync(timeoutServicePath, 'utf8');

// replace the query cutoff condition
const oldQuery = 'createdAt: { [Op.lt]: cutoff },';
const newQuery = '[Op.or]: [{ statusChangedAt: { [Op.lt]: cutoff } }, { statusChangedAt: null, createdAt: { [Op.lt]: cutoff } }],';
timeoutService = timeoutService.replace(oldQuery, newQuery);

// replace CANCEL_REASON with dynamic reason
const oldReasonLine = 'cancelReason: CANCEL_REASON,';
const newReasonLine = 'cancelReason: order.statusId === (assignableStatuses.find(s => s.code === "PENDING") || {}).id ? "Nha hang khong xac nhan don trong thoi gian cho" : "Khong co tai xe nhan don trong thoi gian cho",';
timeoutService = timeoutService.replace(oldReasonLine, newReasonLine);

const oldEmitLine = 'message: CANCEL_REASON,';
const newEmitLine = 'message: orderData.statusCode === "PENDING" ? "Nha hang khong xac nhan don trong thoi gian cho" : "Khong co tai xe nhan don trong thoi gian cho",';
timeoutService = timeoutService.replace(oldEmitLine, newEmitLine);

fs.writeFileSync(timeoutServicePath, timeoutService);
console.log('Fixed orderTimeoutService.js');

