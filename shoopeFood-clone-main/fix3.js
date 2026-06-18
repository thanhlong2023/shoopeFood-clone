const fs = require('fs');
const p = require('path').join(process.cwd(), 'grab-food-monolith', 'src', 'controllers', 'orderController.js');
let t = fs.readFileSync(p, 'utf8');

const s1 = 'socketManager.getIO().emit("order:updated", orderData);';
const s2 = 'socketManager.getIO().emit(order::updated, orderData);';

t = t.replace(s1, 'emitOrderUpdated("order:updated", orderData);');
t = t.replace(s1, 'emitOrderUpdated("order:updated", orderData);');

t = t.replace(s2, '');
t = t.replace(s2, '');

fs.writeFileSync(p, t);
