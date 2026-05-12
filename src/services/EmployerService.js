const prisma = require("../config/prisma");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const LOGO_DIR = path.join(__dirname, "../uploads/logos");
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

const _getCompany = async (userId) => {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company)
    // throw new Error("Bạn chưa có hồ sơ công ty. Vui lòng tạo hồ sơ.");
    return null;
  return company;
};

exports.getMyCompany = async (userId) => {
  const company = await prisma.company.findUnique({
    where: { userId },
    include: {
      user: {
        select: { fullName: true, email: true, phone: true, avatarUrl: true },
      },
    },
  });

  if (!company) return null;

  return {
    id: company.id,
    name: company.name,
    description: company.description,
    website: company.website,
    logoUrl: company.logoUrl,
    address: company.address,
    city: company.city,
    size: company.size,
    status: company.status,
    rejectionReason: company.rejectionReason,
    recruiter: {
      fullName: company.user?.fullName,
      email: company.user?.email,
      phone: company.user?.phone,
      avatarUrl: company.user?.avatarUrl,
    },
  };
};

exports.updateCompany = async (userId, data) => {
  console.log("Updating company for userId:", userId, "with data:", data);
  const company = await _getCompany(userId);

  const { name, description, website, address, city, size } = data;

  if (name !== undefined && !name?.trim()) {
    throw new Error("Tên công ty không được để trống.");
  }
  if (address !== undefined && !address?.trim()) {
    throw new Error("Địa chỉ công ty không được để trống.");
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined)
    updateData.description = description?.trim() || null;
  if (website !== undefined) updateData.website = website?.trim() || null;
  if (address !== undefined) updateData.address = address.trim();
  if (city !== undefined) updateData.city = city?.trim() || null;
  if (size !== undefined) updateData.size = size?.trim() || null;

  if (Object.keys(updateData).length > 0) {
    updateData.status = "pending";
    updateData.rejectionReason = null;
  }

  console.log("Prepared update data:", updateData);

  if (!company) {
    const newCompany = await prisma.company.create({
      data: { ...updateData, userId },
    });
    return newCompany;
  }

  await prisma.company.update({
    where: { id: company.id },
    data: updateData,
  });

  return await prisma.company.findUnique({ where: { id: company.id } });
};

exports.updateLogo = async (userId, fileBuffer) => {
  let newFilePath = null;

  try {
    const company = await _getCompany(userId);

    const fileName = `logo-${userId}-${Date.now()}.webp`;
    const savePath = path.join(LOGO_DIR, fileName);

    await sharp(fileBuffer)
      .resize(300, 300, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toFile(savePath);

    newFilePath = savePath;

    const dbLogoUrl = `/uploads/logos/${fileName}`;

    if (company.logoUrl?.startsWith("/uploads/")) {
      const oldPath = path.join(LOGO_DIR, path.basename(company.logoUrl));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error("Không thể xóa logo cũ:", err);
        }
      }
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { logoUrl: dbLogoUrl },
    });

    return dbLogoUrl;
  } catch (error) {
    if (newFilePath && fs.existsSync(newFilePath)) {
      fs.unlinkSync(newFilePath);
    }
    throw error;
  }
};

exports.deleteLogo = async (userId) => {
  const company = await _getCompany(userId);

  if (!company.logoUrl) {
    throw new Error("Công ty chưa có logo để xóa.");
  }

  if (company.logoUrl.startsWith("/uploads/")) {
    const oldPath = path.join(LOGO_DIR, path.basename(company.logoUrl));
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        console.error("Không thể xóa file logo:", err);
      }
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { logoUrl: null },
  });

  return true;
};
