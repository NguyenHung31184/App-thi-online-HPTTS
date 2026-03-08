# Hướng dẫn soạn đề & Import ngân hàng câu hỏi từ Excel / Google Sheets

## 1. Cách giáo viên soạn đề thi trong app

### Luồng tổng quát

1. **Tạo đề thi** (Quản trị → Đề thi → Thêm đề thi)  
   Nhập: tiêu đề, mô tả, thời gian (phút), ngưỡng đạt (%), ma trận đề (JSON), gắn học phần TTDT nếu có.

2. **Thêm câu hỏi vào đề**  
   Vào đề thi → **Câu hỏi** → Thêm từng câu (trắc nghiệm 1 đáp án, nhiều đáp án, kéo thả, tự luận…) hoặc **Import từ Excel/Sheets** (xem mục 2).

3. **Kiểm định đề**  
   Khi đã đủ câu theo ma trận: bấm **Kiểm định đề** để tạo bản snapshot (đề “đóng băng”) dùng khi thí sinh làm bài.

4. **Tạo kỳ thi**  
   Quản trị → Kỳ thi → Thêm kỳ: chọn đề, lớp, thời gian bắt đầu/kết thúc, **mã truy cập**. Thí sinh vào thi bằng mã này.

### Tận dụng ngân hàng câu hỏi sẵn có (Excel / Google Sheets)

Nếu bạn đã có **hơn 1500 câu** trong file Excel hoặc Google Sheet:

- **Chuẩn hóa file** theo **mẫu cột** bên dưới (có thể chỉnh lại tên cột cho đúng).
- Trong app: vào **Đề thi** → chọn đề → **Câu hỏi** → **Import từ Excel** (hoặc **Import từ file**).
- Chọn file (hoặc xuất Sheet ra file Excel/CSV rồi chọn file), kiểm tra **ánh xạ cột** (cột nào là nội dung câu hỏi, đáp án A/B/C/D, đáp án đúng, chủ đề, độ khó, điểm).
- Xem **bản xem trước** (vài chục dòng đầu), bấm **Nhập vào đề này** → app sẽ thêm hàng loạt câu hỏi vào đề (chỉ loại trắc nghiệm 1 đáp án từ file; các loại khác soạn tay sau nếu cần).

Sau khi import, vẫn nên rà lại vài câu, chỉnh sửa hoặc bổ sung câu tự luận/khác trong form “Thêm câu hỏi” như bình thường.

---

## 2. Mẫu file Excel / Google Sheets để import

### 2.1. Cấu trúc cột (khuyến nghị)

| Cột (letter) | Tên gợi ý   | Nội dung                    | Bắt buộc |
|--------------|-------------|-----------------------------|----------|
| **A**        | Nội dung    | Nội dung câu hỏi (stem)     | Có       |
| **B**        | Đáp án A    | Text đáp án A               | Có       |
| **C**        | Đáp án B    | Text đáp án B               | Có       |
| **D**        | Đáp án C    | Text đáp án C               | Có       |
| **E**        | Đáp án D    | Text đáp án D               | Có       |
| **F**        | Đáp án đúng | Một trong: `A`, `B`, `C`, `D` (hoặc `1`,`2`,`3`,`4` tương ứng) | Có       |
| **G**        | Chủ đề      | Chủ đề / topic (cho ma trận) | Không    |
| **H**        | Độ khó      | `easy` / `medium` / `hard` hoặc tiếng Việt: Dễ / TB / Khó | Không    |
| **I**        | Điểm        | Số điểm (mặc định 1)        | Không    |

- **Dòng đầu**: có thể là **tiêu đề** (tên cột) hoặc **dòng dữ liệu đầu tiên**; trong bước import bạn chọn “Dòng đầu là tiêu đề” hoặc “Không có tiêu đề”.
- Các cột ngoài A–I có thể bỏ qua (ngành nghề, mã câu, v.v.) — chỉ cần **ánh xạ đúng** cột chứa nội dung câu hỏi, đáp án A/B/C/D và đáp án đúng.

### 2.2. Ví dụ vài dòng (Excel / Sheets)

| Nội dung | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng | Chủ đề | Độ khó | Điểm |
|----------|----------|----------|----------|----------|-------------|--------|--------|------|
| Câu 1: ... | ... | ... | ... | ... | A | An toàn | easy | 1 |
| Câu 2: ... | ... | ... | ... | ... | C | Vận hành | medium | 1 |

### 2.3. Nếu file của bạn khác thứ tự cột

- Trong màn **Import từ Excel** sẽ có **ánh xạ cột**: bạn chọn “Cột nội dung câu hỏi” = cột X, “Cột đáp án A” = cột Y, … “Cột đáp án đúng” = cột Z.
- Chỉ cần file có **đủ** nội dung câu hỏi, ít nhất 2 đáp án (A,B hoặc nhiều hơn), và một cột chỉ ra đáp án đúng (ký tự A/B/C/D hoặc số 1/2/3/4) là có thể import.

### 2.4. Google Sheets

- **Cách dùng:** Trong Google Sheets: **File → Tải xuống → Microsoft Excel (.xlsx)**. Mở app → Đề thi → Câu hỏi → **Import từ Excel** → chọn file vừa tải.
- Giữ đúng thứ tự cột như bảng trên (cột A = Nội dung, B = Đáp án A, …). Khi thay đổi file trên Sheets, tải lại file .xlsx và import lại (hoặc import vào đề mới).
- **Lưu ý:** App đọc file .xlsx/.xls trên máy bạn; không kết nối trực tiếp Google Sheets. Để dùng 1500+ câu từ Sheet, chỉ cần xuất một lần (hoặc khi cập nhật) rồi import vào đề.

---

## 3. Sau khi import

- Tất cả câu import được thêm vào **cùng một đề** bạn đã chọn (đề thi hiện tại).
- Loại câu hỏi import từ file: **trắc nghiệm một đáp án đúng** (single_choice). Cần câu **nhiều đáp án đúng**, **kéo thả**, **tự luận** thì soạn thêm trong form “Thêm câu hỏi” và chọn đúng loại.
- Sau khi chỉnh sửa/sắp xếp xong, nhớ **Kiểm định đề** để tạo snapshot trước khi mở kỳ thi cho thí sinh.

---

## 4. Tóm tắt

- **Soạn đề trong app**: Tạo đề → Thêm câu (từng câu hoặc **Import từ Excel**) → Kiểm định đề → Tạo kỳ thi.
- **Tận dụng 1500+ câu**: Chuẩn hóa Excel/Sheets theo mẫu cột (nội dung, A/B/C/D, đáp án đúng, chủ đề, độ khó, điểm) → Import vào đề → kiểm tra, chỉnh sửa bổ sung → Kiểm định → mở kỳ thi.
