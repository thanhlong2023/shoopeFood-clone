const { User, Role, UserRole } = require("../models");
const { createAuthToken } = require("../utils/authToken");

const SUPPORTED_ROLES = new Set(["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"]);
const PHONE_REGEX = /^0\d{9,14}$/;

// In-memory OTP storage for forgot password
const otpCache = new Map();

const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const normalizeAuthUser = (user, selectedRole) => {
  const assignedRoles = (user.roles || []).map((role) => role.name);
  const role = selectedRole && assignedRoles.includes(selectedRole)
    ? selectedRole
    : assignedRoles[0] || selectedRole || "CUSTOMER";

  return {
    id: user.id,
    fullName: user.fullName || "",
    phone: user.phone || "",
    ratingAvg: Number(user.ratingAvg || 0),
    roles: [role],
    role,
    createdAt: user.createdAt,
  };
};

const findUserByPhone = (phone) =>
  User.findOne({
    where: { phone },
    include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
  });

exports.login = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const requestedRole = normalizeRole(req.body.role);

    if (!phone || !password || !SUPPORTED_ROLES.has(requestedRole)) {
      return res.status(400).json({ message: "phone, password and valid role are required" });
    }

    const user = await findUserByPhone(phone);
    if (!user || String(user.password) !== password) {
      return res.status(401).json({ message: "Sai tai khoan hoac mat khau" });
    }

    const roleNames = (user.roles || []).map((role) => role.name);
    const accountRole = roleNames[0];

    if (!accountRole) {
      return res.status(403).json({ message: "User has no role assigned" });
    }

    if (requestedRole !== accountRole) {
      return res.status(401).json({
        message: "Sai tai khoan hoac mat khau",
      });
    }

    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: accountRole,
      roles: [accountRole],
    });

    return res.json({
      message: "Logged in",
      data: {
        token,
        user: normalizeAuthUser(user, accountRole),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");

    if (!fullName || !phone || !password) {
      return res.status(400).json({ message: "fullName, phone and password are required" });
    }

    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ message: "fullName must be between 2 and 100 characters" });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "phone must be a valid Vietnamese phone number" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    if (password.length > 72) {
      return res.status(400).json({ message: "password must not exceed 72 characters" });
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ message: "password must include letters and numbers" });
    }

    const existing = await User.findOne({ where: { phone } });
    if (existing) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const customerRole = await Role.findOne({ where: { name: "CUSTOMER" } });
    if (!customerRole) {
      return res.status(500).json({ message: "CUSTOMER role is not configured" });
    }

    const newUser = await User.create({
      fullName,
      phone,
      password,
      ratingAvg: 5.0,
    });

    await UserRole.create({ userId: newUser.id, roleId: customerRole.id });

    const user = await findUserByPhone(phone);
    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: "CUSTOMER",
      roles: ["CUSTOMER"],
    });

    return res.status(201).json({
      message: "Registered",
      data: {
        token,
        user: normalizeAuthUser(user, "CUSTOMER"),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const trimmedName = String(fullName || "").trim();
    const trimmedPhone = String(phone || "").trim();

    if (!trimmedName || !trimmedPhone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (trimmedPhone !== user.phone) {
      const existing = await User.findOne({ where: { phone: trimmedPhone } });
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ message: "Phone number already exists" });
      }
    }

    await user.update({
      fullName: trimmedName,
      phone: trimmedPhone,
    });

    return res.json({
      message: "Profile updated",
      data: normalizeAuthUser(user, req.user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ message: "newPassword must be between 6 and 72 characters" });
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ message: "newPassword must include letters and numbers" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "newPassword must be different from currentPassword" });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (String(user.password) !== currentPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    await user.update({ password: newPassword });
    return res.json({ message: "Password changed" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      data: normalizeAuthUser(user, req.user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.activateRole = async (req, res) => {
  try {
    const requestedRole = normalizeRole(req.body.role);

    if (!SUPPORTED_ROLES.has(requestedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const roleNames = (user.roles || []).map((role) => role.name);
    const accountRole = roleNames[0];

    if (!accountRole) {
      return res.status(403).json({ message: "User has no role assigned" });
    }

    if (requestedRole !== accountRole) {
      return res.status(403).json({
        message: `Tai khoan hien tai chi co role ${accountRole}`,
      });
    }

    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: accountRole,
      roles: [accountRole],
    });

    return res.json({
      message: "Role synced",
      data: {
        token,
        user: normalizeAuthUser(user, accountRole),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();

    if (!phone || !PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
    }

    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản với số điện thoại này" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes expiration

    otpCache.set(phone, { otp, expiresAt });

    // Simulate sending SMS
    console.log(`\n================================`);
    console.log(`[MOCK SMS] Yêu cầu khôi phục mật khẩu`);
    console.log(`Gửi đến số điện thoại: ${phone}`);
    console.log(`Mã OTP của bạn là: ${otp}`);
    console.log(`================================\n`);

    return res.json({ message: "Mã OTP đã được gửi" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin" });
    }

    const cachedOtp = otpCache.get(phone);

    if (!cachedOtp) {
      return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (cachedOtp.expiresAt < Date.now()) {
      otpCache.delete(phone);
      return res.status(400).json({ message: "Mã OTP đã hết hạn" });
    }

    if (cachedOtp.otp !== otp) {
      return res.status(400).json({ message: "Mã OTP không chính xác" });
    }

    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ message: "newPassword must be between 6 and 72 characters" });
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ message: "newPassword must include letters and numbers" });
    }

    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    await user.update({ password: newPassword });
    otpCache.delete(phone); // Xóa OTP sau khi sử dụng thành công

    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
