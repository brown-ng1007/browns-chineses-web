# Melon Language

Ứng dụng học tiếng Trung và tiếng Anh xây dựng bằng Next.js 15, React 19 và Supabase.

## Chạy ứng dụng trên máy cá nhân

Yêu cầu: Node.js 20 trở lên và npm.

```cmd
npm install
```

Tạo file môi trường từ mẫu nếu máy chưa có `.env.local`:

```cmd
copy .env.example .env.local
```

Mở `.env.local` và điền thông tin Supabase của dự án (nếu muốn dùng dữ liệu đồng bộ). Không đưa file `.env.local` lên GitHub.

Khởi động chế độ phát triển:

```cmd
npm run dev
```

Mở http://localhost:3000 trên trình duyệt.

## Cập nhật phiên bản này vào repository Git hiện có

1. Giữ nguyên thư mục `.git` và file `.env.local` đang có trong bản dự án của bạn.
2. Giải nén bản ZIP cập nhật vào thư mục dự án hiện tại và cho phép ghi đè các file source khi được hỏi. Không xóa `.git` hoặc `.env.local`.
3. Mở CMD tại thư mục dự án và chạy:

```cmd
npm install
npm run dev
```

4. Khi đã kiểm tra ứng dụng hoạt động ổn, đưa thay đổi lên GitHub:

```cmd
git status
git add .
git commit -m "Add Melon IOE arcade games"
git push
```

Nếu đây là thư mục mới chưa có Git remote, hãy kết nối remote repository hiện tại trước khi chạy `git push`.

## Tính năng mới trong phiên bản này

- Thêm **Melon IOE Arcade** tại `/en/games/ioe`, nằm trong khu vực Tiếng Anh.
- Tích hợp 10 thử thách mini-game: ghép cặp, sút phạt, tìm chữ thừa, sắp xếp câu, khỉ đu dây, ghép cặp đại dương, leo núi điền chữ, đại bác hải tặc, bạch tuộc chèo thuyền và thử thách IOE.
- Mini-game lấy từ vựng từ kho tiếng Anh hiện có; ưu tiên các từ người dùng đã thêm vào thẻ học, tự dùng bộ từ trong lộ trình khi chưa đủ dữ liệu.
- Điểm cao nhất được lưu cục bộ trên thiết bị; kết quả luyện tập được ghi vào nhật ký hoạt động tiếng Anh.
- Làm mới trang `/en/games` để đưa IOE Arcade thành tính năng nổi bật, đồng thời giữ nguyên bốn trò chơi nhanh hiện có.

## Lệnh kiểm tra

```cmd
npm run lint
npm run build
```

Lưu ý: bản ZIP bàn giao không chứa `.git`, `.next`, `node_modules`, `.vercel` hoặc `.env.local`. Đây là các dữ liệu môi trường/build riêng của máy và không cần thiết để chia sẻ source code.
