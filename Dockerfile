# Sử dụng image node 20 làm base
FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy các file package.json và package-lock.json
COPY package*.json ./

# Cài đặt các dependencies
RUN npm install

# Copy toàn bộ code vào container
COPY . .

# ĐÃ XÓA DÒNG GENERATE Ở ĐÂY ĐỂ TRÁNH LỖI DATABASE_URL

# Expose port mà ứng dụng chạy (thường là 3000)
EXPOSE 3000

# Lệnh khởi chạy ứng dụng
CMD ["npm", "run", "dev"]
