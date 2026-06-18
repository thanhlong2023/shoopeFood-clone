const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'grab-food-monolith', 'src', 'controllers', 'orderController.js');
let text = fs.readFileSync(p, 'utf8');
const search =     try {
      socketManager.getIO().emit("order:updated", orderData);
      socketManager.getIO().emit(\order:\:updated\, orderData);
    } catch (error) {
      console.log("Socket not ready or err", error.message);
    };
const repl =     emitOrderUpdated("order:updated", orderData);;

text = text.split(search).join(repl);
fs.writeFileSync(p, text);
