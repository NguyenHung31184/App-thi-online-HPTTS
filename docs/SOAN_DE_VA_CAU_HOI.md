# Soạn đề thi, ngân hàng câu hỏi, xác thực CCCD và các loại câu hỏi

## 1. Soạn câu hỏi — tách riêng, theo nghề đào tạo

**Soạn câu hỏi** trong app được tách riêng, **không phụ thuộc** vào việc tạo đề thi.

- Câu hỏi được tạo **theo nghề đào tạo** (ví dụ: Vận hành xe nâng hàng container, Vận hành xe nâng hàng Forklift), **không** theo khóa học hay lớp.
- Mỗi nghề có một **ngân hàng câu hỏi** riêng. Giáo viên vào **Soạn câu hỏi** → chọn nghề → thêm/sửa câu hỏi hoặc import từ Excel vào ngân hàng đó.
- **Tạo đề thi** là bước khác: tạo “khung” đề (tiêu đề, thời gian, ma trận…). Sau này có thể bổ sung chức năng “lấy câu từ ngân hàng theo nghề” khi tạo đề.

**Luồng hiện tại:**

1. **Soạn câu hỏi** (menu Quản trị): Chọn **nghề đào tạo** → vào ngân hàng câu hỏi của nghề đó → **Thêm câu hỏi** (từng câu) hoặc **Import từ Excel**.
2. **Đề thi** (menu Quản trị): Tạo/sửa đề thi (metadata, ma trận). Phần gắn câu hỏi vào đề (từ ngân hàng) sẽ được bổ sung sau nếu cần.

**Cơ sở dữ liệu:**

- Bảng `occupations`: danh sách nghề đào tạo (seed 2 nghề mặc định trong migration 008).
- Bảng `question_bank`: câu hỏi thuộc từng nghề (`occupation_id`). Cấu trúc tương tự bảng `questions` (trắc nghiệm, tự luận, v.v.).

Chạy migration `008_occupations_and_question_bank.sql` để tạo bảng và 2 nghề mặc định.

---

## 2. Xác thực CCCD — rà soát đúng lớp để cho vào thi

**Mục đích:** Rà soát học viên theo CCCD: kiểm tra số CCCD có **đúng lớp** được phép thi hay không. Chỉ học viên **đúng lớp** mới được cho vào thi.

- Học viên chụp/tải ảnh CCCD (mặt trước) → hệ thống đọc thông tin (OCR) → gửi số CCCD lên TTDT (verify-cccd-for-exam).
- TTDT kiểm tra: số CCCD có thuộc lớp được phép thi kỳ thi đó không. Nếu đúng lớp → trả danh sách ca thi được phép (`allowed_windows`) và thông tin học viên.
- App chỉ cho phép vào thi khi TTDT xác nhận đúng lớp (và có ca thi hợp lệ).

---

## 3. Các loại câu hỏi giáo viên có thể soạn và cách soạn

Giáo viên có thể soạn **5 loại** câu hỏi trong ngân hàng (và trong form câu hỏi gắn đề, nếu dùng):

| Loại | Tên hiển thị | Cách soạn |
|------|----------------|-----------|
| **single_choice** | Trắc nghiệm một đáp án đúng | Nhập nội dung câu hỏi, các đáp án A/B/C/D (E tùy chọn), chọn **một** đáp án đúng (radio). Có thể thêm Chủ đề, Độ khó, Điểm, ảnh minh họa. |
| **multiple_choice** | Nhiều đáp án đúng | Giống trên nhưng chọn **nhiều** đáp án đúng (checkbox). Lưu dạng JSON mảng id đáp án đúng. |
| **drag_drop** | Sắp thứ tự (kéo thả) | Nhập các mục; **thứ tự hiển thị trong form = thứ tự đúng**. Thí sinh sẽ sắp xếp lại khi làm bài. Có nút ↑/↓ để đổi thứ tự khi soạn. |
| **video_paragraph** | Clip + Tự luận | Nhập nội dung câu hỏi, **URL video** (clip cho thí sinh xem), và **Rubric / gợi ý chấm** (cho giáo viên chấm tay). Không có đáp án A/B/C; chấm tự luận. |
| **main_idea** | Phân tích ý chính | Tương tự tự luận: nội dung câu hỏi, có thể có media/rubric; chấm tay theo rubric. |

**Cách soạn chung:**

1. Vào **Soạn câu hỏi** → chọn **nghề đào tạo** → **Thêm câu hỏi**.
2. Chọn **Loại câu hỏi** (dropdown).
3. Điền **Nội dung câu hỏi** (bắt buộc).
4. Với trắc nghiệm / sắp thứ tự: nhập **Đáp án** hoặc **Các mục**, đánh dấu đáp án đúng (hoặc thứ tự đúng với drag_drop).
5. Với Clip + Tự luận / Phân tích ý chính: nhập **URL video** (nếu có), **Rubric / gợi ý chấm**.
6. Điền **Chủ đề**, **Độ khó** (Dễ / Trung bình / Khó), **Điểm**. Có thể đính kèm **Ảnh minh họa**.
7. **Lưu** — câu hỏi nằm trong ngân hàng của nghề đã chọn.

**Import hàng loạt (Excel/CSV):** Chỉ áp dụng cho câu hỏi **trắc nghiệm một đáp án** (single_choice). File cần các cột: Nội dung câu hỏi, Đáp án A, B, C, D, Đáp án đúng (A/B/C/D hoặc 1–4), Chủ đề, Độ khó, Điểm. Dùng nút **Import từ Excel** trong màn ngân hàng câu hỏi của nghề.

---

## 4. Ma trận đề (khi tạo đề thi)

Khi tạo/sửa **đề thi**, ô **Ma trận đề** vẫn nhập **tay** dạng JSON. Mỗi phần tử: `topic`, `difficulty`, `count` — dùng để **kiểm định** số câu theo từng nhóm (chủ đề + độ khó) khi gắn câu hỏi vào đề (và khi “lấy từ ngân hàng” sau này). Chi tiết xem hướng dẫn trên form Thêm/Sửa đề thi.
