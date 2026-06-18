const fs = require('fs');

const fixAuthFiles = () => {
  const files = [
    'src/pages/LoginPage.tsx',
    'src/pages/RegisterPage.tsx'
  ];

  const dict = {
    'Dang nhap khach hang': 'Ðang nh?p khách hàng',
    'Dang nhap chu quan': 'Ðang nh?p ch? quán',
    'Khong the dang nhap': 'Không th? dang nh?p',
    'Nhap mat khau cua ban': 'Nh?p m?t kh?u c?a b?n',
    'Dang dang nhap...': 'Ðang dang nh?p...',
    'Dang nhap': 'Ðang nh?p',
    'Khong the dang ky': 'Không th? dang ký',
    'Tao tai khoan de dat mon ngay. Muon lam tai xe hoac mo quan? Dang ky tai trang chu sau khi dang nhap.': 'T?o tài kho?n d? d?t món ngay. Mu?n làm tài x? ho?c m? quán? Ðang ký t?i trang ch? sau khi dang nh?p.',
    'Tao mat khau moi': 'T?o m?t kh?u m?i',
    'Xac nhan mat khau': 'Xác nh?n m?t kh?u',
    'Nhap lai mat khau tren': 'Nh?p l?i m?t kh?u trên',
    'Da co tai khoan?': 'Ðã có tài kho?n?',
    'Dang ky': 'Ðang ký',
    'Khach hang': 'Khách hàng',
    'Chu quan': 'Ch? quán',
    'Tai xe': 'Tài x?',
    'Dang nhap khac:': 'Ðang nh?p khác:',
    'Dat mon, theo doi don hang va quan ly ho so.': 'Ð?t món, theo dõi don hàng và qu?n lý h? so.',
    'Ho ten': 'H? tên',
    'So dien thoai': 'S? di?n tho?i',
    'Mat khau': 'M?t kh?u'
  };

  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Also fix the corrupted 'ang k khch hng' string if it exists
    content = content.replace(/ang k khch hng/g, 'Ðang ký khách hàng');
    
    for (const [key, value] of Object.entries(dict)) {
      content = content.split(key).join(value);
    }
    fs.writeFileSync(file, content, 'utf8');
  });
  console.log('Fixed Auth files.');
};

fixAuthFiles();
