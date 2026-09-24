# Hướng dẫn soạn câu hỏi, nhập từ Excel và soạn đề

Cập nhật 2026-09-24, sau khi gộp kho câu hỏi (Phase C2). Kho câu hỏi cũ theo nghề (`/admin/questions`) không còn; link cũ tự mở đúng ngân hàng mới.

## 1. Luồng chung

1. **Câu hỏi nằm trong ngân hàng của mô-đun.** Mỗi mô-đun có đúng một ngân hàng (menu **Ngân hàng câu hỏi**). Mô-đun học chung nhiều nghề (ví dụ QTHH-AT) thì các nghề dùng chung một ngân hàng.
2. **Đề thi** (menu **Đề thi & ma trận**) gắn với một mô-đun và có ma trận: lấy bao nhiêu câu theo chủ đề và độ khó. Khi thí sinh vào thi, hệ thống bốc câu từ ngân hàng của mô-đun theo ma trận; mỗi thí sinh một bộ câu, không lặp nội dung.
3. Chỉ câu ở trạng thái **Đã phát hành** được bốc vào đề. Câu **Bản nháp**, **Chờ duyệt**, **Ngừng sử dụng** nằm trong ngân hàng nhưng không vào đề.
4. Cột **Chủ đề** của câu phải ghi đúng chữ như trong ma trận đề, vì ma trận lọc theo đúng chữ đó.
5. Đủ câu rồi thì **Kiểm định đề**, sau đó tạo **Kỳ thi** với mã truy cập.

## 2. Làm việc với câu hỏi trong ngân hàng

Vào **Ngân hàng câu hỏi**, chọn ngân hàng, mở tab **Câu hỏi**:

- **Thêm câu hỏi**: soạn từng câu, đủ 7 loại (trắc nghiệm một hoặc nhiều đáp án, kéo thả, đúng/sai nhiều phát biểu, nối đôi, tự luận, video và tự luận).
- **Sửa**: mở câu để chỉnh; nút **Xóa câu hỏi** nằm cuối form.
- **Lọc** theo từ khóa, trạng thái, loại câu. Mục **Câu có lỗi dữ liệu** liệt kê các câu thí sinh sẽ không làm được (thiếu đáp án, đáp án đúng không khớp…).
- **Chọn nhiều câu** rồi chọn thao tác: chuyển sang Đã phát hành, Chờ duyệt, Bản nháp, Ngừng sử dụng, hoặc Xóa.
- **Xuất Excel**: xuất các câu đang hiện, cùng cột với file nhập, nên có thể sửa trong Excel rồi nhập lại.

Về **Xóa**: câu đã có trong bài thi của học viên sẽ được chuyển sang **Ngừng sử dụng** thay vì xóa, để bài cũ vẫn chấm và xem lại được. Câu chưa từng vào bài thi thì bị xóa khỏi ngân hàng.

## 3. Nhập nhiều câu từ Excel hoặc ZIP

Tab **Câu hỏi** → **Nhập từ Excel/ZIP**.

1. Bấm **Tải file mẫu Excel** (hoặc **Tải file mẫu ZIP** nếu câu có ảnh). Trang **Cau_hoi** để điền câu; trang **Vi_du** có một câu mẫu cho mỗi loại và cách ghi.
2. Mỗi dòng ở trang tính đầu tiên là một câu. Hệ thống chỉ đọc trang tính đầu tiên.
3. Chọn file (.xlsx, .xls, .csv hoặc .zip). Hệ thống đọc ngay và báo:
   - **Câu sẵn sàng**: sẽ được nhập;
   - **Dòng lỗi**: kèm số dòng và lý do, không được nhập. Sửa trong file rồi chọn lại file;
   - **Dòng trùng**: câu đã có trong ngân hàng hoặc lặp lại trong file, sẽ bỏ qua.
4. Chọn trạng thái sau khi nhập: **Đã phát hành** (vào đề thi ngay) hoặc **Bản nháp** (xem lại trước).
5. Bấm **Nhập … câu vào ngân hàng**. Việc nhập là trọn gói: nếu có lỗi giữa chừng thì không câu nào được lưu, bấm nhập lại.

### Các cột

| Cột | Ghi gì | Bắt buộc |
|---|---|---|
| Nội dung câu hỏi | Nội dung câu | Có |
| Đáp án A … Đáp án J | Nội dung từng đáp án (tối đa 10) | Tùy loại |
| Đáp án đúng | Xem bảng dưới | Tùy loại |
| Loại câu hỏi | Trắc nghiệm, Nhiều đáp án, Kéo thả, Đúng/Sai, Nối đôi, Tự luận, Video tự luận | Không |
| Keys | Ý chấm của câu tự luận, hoặc cột phải của câu nối đôi | Tùy loại |
| Chủ đề | Đúng chữ như ma trận đề | Không |
| Độ khó | Dễ, Trung bình, Khó (để trống là Trung bình) | Không |
| Điểm | Số nguyên từ 1 (để trống là 2) | Không |
| Tên file ảnh | Chỉ khi nhập ZIP | Không |

Để trống **Loại câu hỏi** thì: có đáp án là Trắc nghiệm; không có đáp án mà có Keys là Tự luận.

### Cách ghi "Đáp án đúng"

| Loại | Ghi | Ví dụ |
|---|---|---|
| Trắc nghiệm | Một chữ A–J hoặc số 1–10 | `B` hoặc `2` |
| Nhiều đáp án | Các đáp án đúng, cách nhau bằng dấu chấm phẩy | `A;C` |
| Kéo thả | Thứ tự đúng của tất cả nhãn | `B;A;D;C` |
| Đúng/Sai | Một giá trị cho mỗi phát biểu A, B, C… | `Đ;S;Đ;S` hoặc `T;F;T;F` |
| Nối đôi | Cặp trái-phải; nội dung cột phải ghi ở Keys, cách nhau bằng dấu chấm phẩy | `A-1;B-2;C-3` |
| Tự luận | Để trống; Keys ghi ý chấm dạng `ý\|điểm;ý\|điểm` | `sai quy trình\|2;thiếu bảo hộ\|2` |

### Câu có ảnh (ZIP)

- Để ảnh trong thư mục `images/` cạnh file Excel, ghi tên ảnh ở cột **Tên file ảnh**, rồi nén cả hai thành một file ZIP.
- Ảnh JPG, PNG, GIF hoặc WEBP, tối đa 5 MB mỗi ảnh. Thiếu ảnh hoặc ảnh quá lớn thì dòng đó báo lỗi.
- Câu kéo thả có ảnh và đúng 4 nhãn là dạng gắn nhãn lên ảnh: 4 ô được đặt ở vị trí mặc định, mở câu sau khi nhập để kéo ô về đúng chỗ.

### Google Sheets và CSV

- Google Sheets: **Tệp → Tải xuống → Microsoft Excel (.xlsx)** rồi chọn file đó.
- CSV phải lưu dạng **CSV UTF-8** (trong Excel: Lưu thành → CSV UTF-8), nếu không sẽ mất dấu tiếng Việt; hệ thống từ chối file CSV không phải UTF-8.
