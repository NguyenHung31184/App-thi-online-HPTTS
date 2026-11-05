# Regulation

Học viên xác nhận đã đọc Quy chế đào tạo của trung tâm (Thông tư 79 Điều 47 khoản 2, phổ biến đầu khóa).

- Bảng `regulation_acknowledgements` và hai RPC `get_my_regulation_status`, `acknowledge_regulation` thuộc database
  chung; app quản lý làm chủ (migration `20261105100000` ở repo QuanlyTTDT-HPTTS). Module này chỉ gọi RPC.
- File Quy chế là dòng `public_documents` loại `quy_che_dao_tao`, nhân viên tải ở app quản lý (Nội dung Chatbot →
  Công khai). Thay file mới thì học viên xác nhận lại.
- `RegulationFirstLoginGate` (bọc các trang học viên trong `src/app/layouts/Layout.tsx`): chưa xác nhận thì hiện Quy
  chế thay nội dung trang. Không áp trong lúc làm bài (`/exam/...`); đang tải, lỗi tải hoặc chưa có file thì không chặn.
- `RegulationPage`: mục menu "Quy chế đào tạo" để đọc lại.
