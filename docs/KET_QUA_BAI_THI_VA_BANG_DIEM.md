# Kết quả bài thi và bảng điểm

## 1. Kết quả bài thi đổ vào đâu?

### Trong App Thi Online (Supabase project app thi)

| Bảng / Nơi | Mô tả |
|------------|--------|
| **attempts** | Mỗi lần học viên "Vào thi" tạo 1 bản ghi. Sau khi nộp bài: `status = 'completed'`, `raw_score`, `score` (0–1), `completed_at`, `synced_to_ttdt_at` (nếu đã gửi TTDT). |
| **exam_sync_log** | Log mỗi lần gửi điểm sang TTDT (payload, status success/failed, response). |

### Trong App Quản lý TTDT (khi đồng bộ điểm)

| Bảng / Nơi | Mô tả |
|------------|--------|
| **grade_details** | Edge Function `receive-exam-results` ghi/upsert theo `(enrollment_id, module_id)`: cập nhật `final_exam_score`, `passed`, `final_module_score`. Giữ nguyên `regular_score`, `midterm_score` nếu đã có. |
| **Công thức** | Nếu đã có điểm quá trình: `final_module_score = (điểm quá trình 40% + final_exam_score 60%)`; không thì `final_module_score = final_exam_score`. |

Hiện tại mọi bài thi nộp từ app thi đều được TTDT ghi vào cột **final_exam_score** (điểm kết thúc mô-đun) trong `grade_details`. Phân loại theo loại bài (thường xuyên / định kỳ / kết thúc mô-đun) có thể thực hiện theo thời gian làm bài (xem mục 2).

---

## 2. Phân biệt loại điểm theo thời gian làm bài

App quản lý có các loại điểm: **thường xuyên**, **định kỳ**, **kết thúc mô-đun**. Có thể phân biệt theo thời gian làm bài:

| Loại | Thời gian làm bài | Gợi ý cột trong TTDT |
|------|--------------------|------------------------|
| **Thường xuyên** | Dưới 15 phút | `regular_score` (hoặc cột tương đương) |
| **Định kỳ** | Dưới 15 phút | `midterm_score` (hoặc cột tương đương) |
| **Kết thúc mô-đun** | Từ 30 phút trở lên | `final_exam_score` |

Trong App Thi, mỗi đề có **duration_minutes** (phút). Có thể dùng quy ước:

- **duration_minutes &lt; 15** → bài thường xuyên hoặc định kỳ (tùy cấu hình từng kỳ thi).
- **duration_minutes ≥ 30** → bài kết thúc mô-đun.

Để TTDT ghi đúng cột (`regular_score` / `midterm_score` / `final_exam_score`), cần:

1. Trong App Thi: khi tạo đề/kỳ thi, gán loại bài (ví dụ: `exam_type`: `regular` | `midterm` | `final`) hoặc dựa vào `duration_minutes` khi gửi sync.
2. Trong Edge Function `receive-exam-results`: nhận thêm trường loại bài (hoặc suy ra từ thời gian), rồi upsert đúng cột tương ứng trong `grade_details`.

Hiện tại **chưa** có trường loại bài trong payload sync; mọi điểm đều ghi vào `final_exam_score`. Nếu cần phân loại, có thể bổ sung `exam_type` hoặc `duration_minutes` vào payload và sửa logic trong `receive-exam-results`.

---

## 3. Xác nhận nộp bài (App Thi)

Khi học viên bấm **Nộp bài**, app hiển thị hộp xác nhận:

- Nội dung: *"Bạn đã làm được **X** / **Y** câu. Bạn có chắc chắn muốn nộp bài? Sau khi nộp bạn không thể sửa lại."*
- Nút **Hủy** → đóng hộp, tiếp tục làm bài.
- Nút **Có, nộp bài** → gọi chấm bài (RPC `grade_attempt`), đồng bộ TTDT (nếu cấu hình), rồi chuyển sang trang kết quả.

Khi hết giờ, bài được tự động nộp không qua hộp xác nhận.
