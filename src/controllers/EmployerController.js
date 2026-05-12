const EmployerService = require("../services/EmployerService");

// ==============================================================================
// HELPER ERROR
// ==============================================================================
const handleError = (res, error, context) => {
  console.error(`[EmployerController] ${context}:`, error.message);
  const { message } = error;

  const BAD_REQUEST = [
    "Tên công ty không được để trống.",
    "Địa chỉ công ty không được để trống.",
    "Bạn đã có hồ sơ công ty. Hãy dùng chức năng cập nhật.",
    "Công ty chưa có logo để xóa.",
  ];
  const NOT_FOUND = [
    "Bạn chưa có hồ sơ công ty. Vui lòng tạo hồ sơ.",
    "Công ty không tồn tại",
  ];

  if (BAD_REQUEST.includes(message))
    return res.status(400).json({ status: "error", message });
  if (NOT_FOUND.includes(message))
    return res.status(404).json({ status: "error", message });
  return res
    .status(500)
    .json({
      status: "error",
      message: `Lỗi server khi ${context}`,
      error: message,
    });
};

// ==============================================================================
// GET /api/employer/profile
// ==============================================================================
exports.getMyCompany = async (req, res) => {
  try {
    const data = await EmployerService.getMyCompany(req.user.id);
    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Bạn chưa có hồ sơ công ty. Vui lòng tạo hồ sơ.",
      });
    }
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleError(res, error, "lấy profile công ty");
  }
};

// ==============================================================================
// POST /api/employer/profile
// ==============================================================================
// exports.createCompany = async (req, res) => {
//     try {
//         const data = await EmployerService.createCompany(req.user.id, req.body);
//         return res.status(201).json({
//             status: 'success',
//             message: 'Tạo hồ sơ công ty thành công! Đang chờ Admin duyệt.',
//             data
//         });
//     } catch (error) {
//         return handleError(res, error, 'tạo profile công ty');
//     }
// };
// ==============================================================================
// PUT /api/employer/profile
// ==============================================================================
exports.updateCompany = async (req, res) => {
  try {
    const data = await EmployerService.updateCompany(req.user.id, req.body);
    return res.status(200).json({
      status: "success",
      message: "Cập nhật hồ sơ công ty thành công! Đang chờ Admin duyệt lại.",
      data,
    });
  } catch (error) {
    return handleError(res, error, "cập nhật profile công ty");
  }
};

// ==============================================================================
// PUT /api/employer/logo
// ==============================================================================
exports.updateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Vui lòng chọn file ảnh hợp lệ",
      });
    }
    const data = await EmployerService.updateLogo(req.user.id, req.file.buffer);
    return res.status(200).json({
      status: "success",
      message: "Cập nhật logo thành công",
      data: { logo_url: data },
    });
  } catch (error) {
    return handleError(res, error, "cập nhật logo");
  }
};

// ==============================================================================
// DELETE /api/employer/logo
// ==============================================================================
exports.deleteLogo = async (req, res) => {
  try {
    await EmployerService.deleteLogo(req.user.id);
    return res.status(200).json({
      status: "success",
      message: "Xóa logo thành công",
    });
  } catch (error) {
    return handleError(res, error, "xóa logo");
  }
};
