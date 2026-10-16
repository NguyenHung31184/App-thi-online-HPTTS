# Nhật Ký Phát Triển — App Thi Online HPTTS

> Mỗi buổi làm việc thêm 1 mục mới ở **đầu file** (mới nhất lên trên).
> Format: ngày | đã làm | vấn đề gặp | kế hoạch tiếp theo

---

## 2026-10-16 | Học viên thi thử không vào được kỳ thi thật: sai mã truy cập; nút mở khóa ở màn giám sát (migration CHƯA áp)

**Hiện tượng**: kỳ thi thật 14:15–14:45 của NBN-GN3.4 và NBN-GN4.5, năm học viên đã thi thử 14–15/10 không vào được.
**Nguyên nhân**: cả năm nhập sai mã truy cập (mã thi thật khác mã thi thử), bốn người bị khóa sau 5 lần. Bản đang chạy
còn lỗi ghi ở mục 15/10 dưới đây (sai mã không báo gì, vào `/exam/null` rồi lỗi), nên học viên không biết mình sai mã.
Người bị khóa chưa có lượt làm bài nên không hiện trên màn giám sát.
**Đã làm**:
- Lúc 14:3x, chủ dự án cho phép: xóa bộ đếm sai mã của 5 tài khoản ở hai cửa sổ thi; một người vào được ngay.
- Commit `5125f0d` (bản sửa của mục 15/10) và push.
- Migration `20261016110000_exam_access_unlock.sql`: `get_exam_access_failures()`, `unlock_exam_access(window, user)`,
  bảng `exam_access_unlocks` (ai mở khóa, lúc nào). Quyền như màn giám sát (admin, teacher, proctor). Mức khóa giữ nguyên.
- Màn Giám sát trực tiếp: khối `ui/AccessLockAlert.tsx` liệt kê học viên đang nhập sai mã ở kỳ thi đang mở, nút "Mở khóa".
- Màn vào thi: mã lỗi máy chủ đổi thành câu tiếng Việt (`domain/start-attempt-errors.ts`); trước đó học viên bị khóa
  thấy nguyên chữ `access_code_rate_limited`, và lỗi Supabase chỉ hiện "Lỗi tạo bài làm."
- Kiểm tra: 325 test, `tsc`, ranh giới, build đạt; chạy thử migration trên production tự hoàn tác (TEST-TH, hv100286) đúng.
  Chưa bấm thử giao diện đã đăng nhập.

---

## 2026-10-15 | Sửa lỗi "Không tải được trạng thái giám sát" khi nhập sai mã truy cập

**Hiện tượng**: nhiều học viên thi trên điện thoại thấy màn hình trắng chỉ có dòng đỏ "Không tải được trạng thái giám
sát. Kiểm tra kết nối rồi tải lại trang." Ban đầu nghi do quyền camera — không phải.

**Nguyên nhân**: `start_exam_attempt` trả `NULL` khi sai mã truy cập. Hàm trả kiểu bản ghi `attempts`, nên PostgREST
gửi về một object có mọi cột `null` chứ không phải `null`. `startTheoryAttempt` chỉ kiểm tra `!data` nên lọt, trang
chuyển tới `/exam/null`; vòng hỏi `get_browser_proctoring_state` 5 giây/lần nhận lỗi 22P02 (uuid sai) và hiện câu trên.
Log 24 giờ: 135 lệnh lỗi 400 từ 8 tài khoản, cả 8 đều có bản ghi nhập sai mã trong `exam_access_failures`.

**Đã sửa**: `data/exam-attempt-repository.ts` kiểm tra `attempt?.id`; sai mã giờ báo "Mã truy cập không đúng." ngay
tại trang chọn kỳ thi. `tsc` đạt. Chưa commit/deploy.

---

## 2026-10-15 | E-learning giai đoạn 3 (quiz cuối bài) và 4 (báo cáo tiến độ): code xong, migration CHƯA áp

**Chủ dự án yêu cầu**: làm nốt phần dang dở của giai đoạn 1–2, rồi giai đoạn 3 và 4.

**Đã làm ở App thi**
- Khối "Bài kiểm tra" soạn được: điểm đạt (mặc định 80%), số lượt (mặc định 3), chọn câu từ ngân hàng câu hỏi của
  mô-đun (chỉ câu đã duyệt, ba dạng một đáp án, nhiều đáp án, Đúng/Sai từng ý). Khung `ui/authoring/QuizQuestionPicker`.
  Xuất bản bị chặn khi quiz chưa có câu hoặc có câu đã bị xóa khỏi ngân hàng.
- Học viên làm bài ở `ui/QuizBlock`: nộp, máy chủ chấm, hiện số câu đúng, điểm, đạt hay chưa, lượt còn lại. Câu bỏ trống
  phải bấm nộp lần hai. Đạt thì khối tính hoàn thành và bài sau (nếu học tuần tự) mở.
- `domain/quiz.ts` (10 test), sửa `domain/lesson-authoring.ts` (quiz soạn được, so bản nháp với phiên bản có tính câu
  hỏi, số lượt, điểm đạt). 33 test của module, `tsc -b`, lint, ranh giới module đạt.

**Máy chủ** (migration ở repo app quản lý): phiên bản lưu câu hỏi không kèm đáp án; đáp án chụp sang bảng riêng chỉ hàm
chấm đọc được. Chạy thử trong khối tự hoàn tác 12 trường hợp đạt, gồm: không xuất bản được câu dạng nối; phiên bản không
lộ đáp án; sai hai lần thì hết lượt; đúng hết thì đạt 100% và khối hoàn thành; đã đạt thì không nộp lại; học viên không
đọc được bảng đáp án, không tự ghi lượt làm, không xem được báo cáo.

**Đã áp và thử (15/10/2026, sau khi chủ dự án cho phép)**: migration áp lên production. Thử trên lớp thử riêng
`TEST-EL` (2 học viên thử, tạo cho buổi này): thêm khối kiểm tra 3 câu vào bài thử 13/10, xuất bản phiên bản 4 (phiên
bản không có đáp án, bảng đáp án đủ 3 dòng), giao cho lớp. Học viên thử: nộp trống bị hỏi lại; lượt 1 đúng 2/3 = 66,7%
"Chưa đạt, còn 2 lượt"; lượt 2 đúng 3/3 = 100% đạt, khối hoàn thành, nút nộp ẩn; tải lại vẫn thấy 2 lượt, điểm cao
nhất 100%; trang không chứa đáp án. Báo cáo tiến độ ở app quản lý khớp, Excel đúng. Chưa push.

Lưu ý khi tạo học viên thử: tài khoản thi chỉ vào được trang học khi `profiles.student_id` đã gắn (bình thường do bước
xác minh CCCD ghi). Học viên thử không có CCCD nên gắn bằng SQL, đúng điều kiện email trùng `exam_account_email`.

---

## 2026-10-14 | Phiếu in kết quả: họ tên thật của học viên, bố cục mới

**Báo của chủ dự án**: phiếu in ghi tên tài khoản thay cho tên học viên; bố cục phiếu chưa hợp mắt.

**Nguyên nhân tên tài khoản**: `profiles.name` của tài khoản thi là chính địa chỉ đăng nhập (`hv100238@hptts.vn`).
Tên thật nằm ở `students`, bảng này chỉ nhân viên đọc được. Trang kết quả lấy tên từ lần xác thực CCCD lưu trong
`sessionStorage` của tab; mở tab mới hoặc mở lại trình duyệt thì mất, và trang lùi về tên tài khoản. Ngày sinh và
CCCD mất theo cùng lý do.

**Đã làm**
- Migration `20261014090000_my_exam_student_identity.sql` (**ĐÃ áp production** rạng sáng 14/10/2026, chủ dự án duyệt): hàm `get_my_exam_student()` trả
  đúng một dòng học viên gắn với tài khoản đang đăng nhập (họ tên, ngày sinh, CCCD). `profiles.student_id` đã được
  trigger `guard_profile_privileged_columns` chặn tự đổi sang học viên khác.
- `domain/result-identity.ts`: thứ tự lấy thông tin là dòng học viên, rồi phiên CCCD của tab. Tên có dấu `@` không
  bao giờ được hiện làm tên người; không có tên thật thì hiện "—". Frontend chạy được khi hàm chưa có (lúc đó vẫn
  dựa vào phiên CCCD).
- `ResultPrintSheet.tsx` dựng lại: đầu phiếu có logo, tên công ty và mã lượt thi; băng tiêu đề nền `brand-50`; khối
  thông tin học viên kèm ảnh; khối kết quả có điểm lớn, thanh điểm với vạch ngưỡng đạt và nhãn Đạt / Chưa đạt; ô chữ
  ký; chân trang liên hệ nằm sát cuối trang. Mọi màu mang nghĩa đều là chữ hoặc viền nên in không nền vẫn đọc được.
- Kiểm tra: 305 test, typecheck, lint, ranh giới module, build đạt. In thử PDF A4 bằng Edge không giao diện, hai
  biến thể (có và không có ảnh, chữ ký, màu nền): một trang.

**Chưa làm / chưa kiểm**
- Đã gọi thử hàm trên production với danh tính tài khoản `hv100238` trong một giao dịch hoàn tác: trả đúng một dòng
  (Đinh Quốc Huy, 1988-08-18, có CCCD); `anon` không gọi được. Chưa thử qua giao diện thật, chưa in từ điện thoại thật.
- Lịch sử migration: file nằm ở repo này, lệnh `migration repair` phải chạy từ repo app quản lý (nơi CLI đã link) với
  một bản sao tạm của file.
- Rollback: `DROP FUNCTION public.get_my_exam_student();` và hoàn tác commit.

**Sửa câu hỏi (cùng ngày)**
- Màn sửa câu Đúng/Sai nhiều phát biểu: ô nhập phát biểu bị bóp còn vài pixel. Ô chọn Đúng/Sai mang cả `w-full` (từ
  `fieldClass`) lẫn `w-28`; thứ tự trong stylesheet cho `w-full` thắng nên ô chọn chiếm hết hàng. Thêm
  `sizedFieldClass` (không có `w-full`) cho ô tự đặt độ rộng, áp cho ô Đúng/Sai và ô tọa độ của câu kéo thả.
  Đã chụp màn hình bản dựng thử ở 1000 px: phát biểu chiếm phần lớn hàng, ô Đúng/Sai rộng cố định.
- Nhập đề từ Word: dòng đếm nhóm kiểu "Bậc 3-4: 13" (hoặc "Bậc 5: 7 câu") giữa hai câu bị nối vào cuối phương án
  cuối của câu trước, kèm ghi chú "Cần xem lại". Nay dòng này kết thúc câu trước và bị bỏ qua. Test mới trong
  `word-questions.test.ts`. Câu đã nhập trước đó vẫn phải xóa tay đoạn thừa.

**Chụp ảnh khuôn mặt lúc vào thi (cùng ngày, chiều)**
- Báo: học viên Vũ Thị Thu Hiền (Samsung Android) kẹt ở bước chụp mặt với lỗi "Không phân tích được hình ảnh
  (BlazeFace)". Nhật ký lượt thi: tạo lượt 15:08:36, chụp bàn làm việc hai lần, không có `photo_taken`; đồng hồ thi
  đã tự chạy sau 5 phút chuẩn bị. Thẻ trên màn giám sát hiện "0/50 câu, 7 phút 50 giây" vì thời gian tính từ lúc tạo
  lượt (đề xuất sửa màn giám sát, chưa làm).
- Nguyên nhân: bước chụp mặt chỉ dùng BlazeFace (TensorFlow.js, WebGL); lỗi bất kỳ của bộ này thành "model_error",
  không có dự phòng và không ghi lại lỗi gì.
- Đã làm: `application/start-portrait.ts` thử lần lượt BlazeFace, MediaPipe (WebAssembly), BlazeFace trên CPU; bộ
  nào chạy được thì giữ cho lần bấm sau. Mỗi lần mọi bộ đều hỏng ghi `face_check_error` (chi tiết lỗi từng bộ, user
  agent). Sau 2 lần như vậy hiện nút "Chụp ảnh không kiểm tra tự động" (chủ dự án chọn): ảnh cắt giữa khung, ghi
  `face_check_skipped` và `photo_taken` có `face_check: 'skipped'`; trang kết quả của giám thị ghi dưới ảnh "Chưa qua
  kiểm tra khuôn mặt tự động, cần xem lại". Ảnh đạt kiểm tra ghi `face_check: 'passed'` kèm tên bộ nhận diện.
- Kiểm tra: 311 test (5 test mới giả lập từng bộ hỏng), typecheck, lint, ranh giới module, build đạt. Edge không giao
  diện với camera giả: bình thường dùng BlazeFace như cũ; tắt hẳn WebGL thì BlazeFace vẫn chạy (TensorFlow.js tự
  chuyển sang CPU), nên máy của học viên nhiều khả năng có WebGL nhưng hỏng giữa chừng; trường hợp này chưa giả lập
  được trên trình duyệt. Chưa thử trên máy Samsung của học viên.

---

## 2026-10-13 | Giám sát AI: một vi phạm kéo dài không bị ghi thành hai lỗi

**Câu hỏi của chủ dự án**: người thứ hai nhìn vào điện thoại mà không rời đi thì có tính là một lỗi không; không thấy
mặt cũng vậy? Đọc code: đúng là một lỗi (bộ đếm khóa sau khi ghi, chỉ mở khi đủ số lần quét sạch), nhưng có ba
trường hợp vẫn thành hai lỗi. Chủ dự án duyệt sửa cả ba.

**Đã làm** (chỉ frontend, không có migration)
- Nhận diện chập chờn: `recoveryScans` của nhiều mặt và không thấy mặt 3 → 5 (`domain/proctoring-policy.ts`).
  Người thứ hai phải khuất khoảng 5 giây liên tục mới tính là đã rời đi. Đánh đổi: vi phạm lặp lại trong khoảng đó
  gộp vào lỗi trước. Bản đầu đặt nhiều mặt là 10; chủ dự án chọn 5 để người ngó vào, lùi ra 5–10 giây rồi ngó lại
  bị tính lỗi mới.
- Che camera: luật che ống kính dùng chung khóa với luật không thấy mặt. Luật nào ghi lỗi trước thì khóa cả hai; luật
  che ống kính im cho tới khi thấy lại mặt đủ 5 lần quét. Trước đây hai luật đếm riêng và chỉ dựa vào khoảng chặn
  trùng 5 giây, nên máy quét chậm ghi hai lỗi.
- Tải lại trang: loại lỗi đang khóa được lưu vào `sessionStorage` (khóa `exam_ai_locks_<attemptId>`) và khôi phục khi
  bộ quét khởi tạo (`data/detection-lock-storage.ts`, `application/detection-locks.ts`).
- Khi không có tín hiệu mặt nào (bộ quét mặt hỏng, không bật nhận diện vật thể), tín hiệu che ống kính đẩy cửa sổ
  không thấy mặt, để khóa vẫn mở lại được.
- Người thứ hai đứng lì: lỗi nhiều mặt được ghi lại mỗi 30 giây khi vi phạm còn tiếp diễn (`repeatAfterMs` trong
  luật, chủ dự án duyệt chu kỳ). Dòng ghi lặp có `detection.stillPresent = true`. Ở chế độ nghiêm ngặt với ngưỡng 6
  điểm, đứng khoảng 63 giây là đủ 3 lỗi và bài tự nộp. Không áp dụng cho không thấy mặt, điện thoại, vật cấm.
- Màn giám sát trực tuyến: ô "Tín hiệu giám sát" trước đây chỉ có tổng số và tên tín hiệu mới nhất. Nay mỗi nhóm
  tín hiệu là một ô nhỏ gồm biểu tượng và số lần (nhiều người, điện thoại, vật cấm, không thấy mặt, rời trang thi;
  ba sự kiện trình duyệt gộp thành "rời trang thi"). Ô của tín hiệu mới nhất tô nền đậm khi tín hiệu xảy ra trong 45
  giây gần đây. Chú thích biểu tượng một dòng cho cả lớp, thẻ học viên không cao thêm. Không có migration: màn giám
  sát đọc thêm `attempt_audit_logs` của các lượt thi có tín hiệu (`fetchSignalEvents`); đọc lỗi thì hiện như cũ.
  Nhãn "Mất focus" ở màn này đổi thành "Rời cửa sổ thi"; các màn báo cáo vẫn dùng chữ cũ.
- Trang kết quả một lượt thi (`exam-reporting/ui/attempt-result`), theo ba báo của chủ dự án:
  - Nút "In kết quả": trang in được dựng thành một khối HTML gắn vào cuối trang rồi chụp thành PDF bằng html2pdf; lỗi
    giữa chừng thì khối đó nằm lại trên màn hình và không có thông báo. Nay khối HTML không gắn vào trang nữa
    (html2pdf tự dựng bản sao ẩn), lỗi thì hiện thông báo. Chưa tìm ra vì sao lần của chủ dự án không ra file.
  - Câu tự luận: đáp án hiện từng ý một dòng kèm điểm thay cho chuỗi JSON; trạng thái "Tự luận: giáo viên chấm" thay
    cho "Sai".
  - Câu nối: đáp án và bài làm hiện từng cặp "vế trái ↔ nội dung vế phải". Sửa luôn lỗi so đáp án: bài nối đúng hết
    trước đây vẫn hiện "Sai" ở trang này vì so cả khóa lưu `{right, map}` (điểm do `grade_attempt` chấm, không đổi).
  - Câu đúng/sai nhiều ý hiện "phát biểu: Đúng/Sai" từng dòng; câu nhiều lựa chọn hiện tên từng lựa chọn.
  - File PDF dùng chung cách hiển thị trên và thoát ký tự HTML cho mọi giá trị lấy từ database.
  - Sau khi đẩy `86a8052`, chủ dự án báo lỗi `Attempting to parse an unsupported color function "oklch"` và màn hình
    không bấm được gì. Nguyên nhân: html2canvas 1.4.1 không đọc được màu `oklch()` của Tailwind 4 nên dừng; khi dừng,
    html2pdf để lại lớp phủ vô hình toàn màn hình (`.html2pdf__overlay`) chặn mọi cú bấm. Đây cũng là lý do nút in
    không ra file từ trước. Sửa: bỏ hết stylesheet khỏi bản sao tài liệu mà html2canvas vẽ (`onclone`; trang in chỉ
    dùng style nội tuyến) và luôn gỡ lớp phủ trong `finally`. Lần thử đầu của tôi không bắt được lỗi vì trang thử
    không nạp `index.css`; thử lại có nạp thì tái hiện đúng lỗi, sau khi sửa thì ra file và đã mở file xem bố cục.
- Chữ ký học viên trên màn hình (chủ dự án chọn: ký sau khi nộp bài, bắt buộc). Màn kết quả của học viên hiện ô
  ký bằng ngón tay (`ui/student-result/SignaturePad.tsx`); chưa ký thì chưa có nút "In kết quả" và "Về trang chủ".
  Ảnh chữ ký đi qua Edge `upload-exam-file` với `kind = signature`, nằm cùng thư mục với ảnh lúc vào thi
  (`proctoring/<user>/<attempt>/signature_<ts>.jpg`); không có migration, không đổi Edge Function. Trang biết đã ký
  hay chưa bằng cách liệt kê thư mục đó (học viên đọc được thư mục của mình, giám thị đọc được mọi thư mục theo
  policy sẵn có); thêm dòng nhật ký `signature_taken` để có giờ ký. Trang kết quả của giám thị và file PDF hiện
  chữ ký, chưa ký thì để ô trống cho ký tay. Lưu ý: lượt thi cũ mở lại trang kết quả cũng sẽ được yêu cầu ký; ảnh
  chữ ký bị dọn cùng ảnh giám sát theo script `storage:cleanup:exam-photos` (tốt nghiệp + 365 ngày).
  Đã thử ô ký trên Edge giả lập điện thoại 390 px có chạm: ký được, trang không cuộn khi ký, nét ngắn không cho xác
  nhận, lưu lỗi thì báo và giữ nét ký. **Chưa thử** phần tải ảnh lên và đọc lại với lượt thi thật.
- Phiếu in kết quả của học viên theo nhận diện HPTTS (`ui/student-result/ResultPrintSheet.tsx`, chỉ hiện khi in,
  thay cho bố cục màn hình). Đối chiếu `DESIGN.md` mục 1 của app quản lý: logo nguyên bản trên nền trắng cạnh tên
  công ty in hoa đậm `brand-500` ngắt đúng hai dòng; tiêu đề phiếu in hoa `brand-500`; cyan chỉ làm nền nhãn "kỳ thi
  thử" với chữ `brand-900`; chân trang là thông tin liên hệ chính thức (mục 1.8). Không vẽ dải "Tín – Tâm – Trí" vì
  chưa có file vector gốc (mục 1.7 cấm vẽ phỏng). Phiếu gồm thông tin học viên, ảnh lúc vào thi, khung điểm / ngưỡng
  đạt / kết quả, chữ ký.
  Sửa kèm hai lỗi in của cả app: khung menu và đầu trang bị in theo (`AppLayout` thêm `print:hidden`), và nội dung bị
  cắt theo chiều cao màn hình vì khung app cao đúng một màn hình và cuộn bên trong (`index.css` thêm khối
  `@media print`). Hai sửa này áp cho mọi trang in bằng lệnh in của trình duyệt.
  Đã in thử ra PDF A4 từ khung nhìn điện thoại 390 px bằng Edge không giao diện: một trang, không có menu, có và
  không bật in màu nền đều đọc được. Chưa in thử từ điện thoại thật (Safari, Chrome Android).
- Kiểm tra: 301 test, typecheck, lint ba thư mục `exam-taking`, `exam-monitoring`, `exam-reporting`, ranh giới module
  đạt. Chạy thử tạo PDF bằng Edge không giao diện với dữ liệu mẫu (câu nối, câu tự luận): tạo xong, không để lại gì
  trên trang. Chưa xem trang kết quả thật và chưa mở file PDF để xem bố cục.

**Chưa làm / chưa kiểm**
- Chưa chạy trên trình duyệt với camera thật: chưa thử người thứ hai đứng lâu, che ống kính, tải lại trang giữa lúc
  vi phạm.
- Chưa commit, chưa triển khai.
- Rollback: hoàn tác các file trên; không có thay đổi database.

---

## 2026-10-13 | Thi thử trên iPhone 12 (Safari): lag đầu bài, đồng hồ, lối vào bỏ qua thể lệ

**Báo của chủ dự án** sau khi thi thử bằng Safari: 2–3 phút đầu lag; thời gian trên điện thoại và trên màn giám sát
"không đồng bộ"; phần học trực tuyến hơi lag và sơ sài.

**Đối chiếu nhật ký lượt thi `5d7ad45f`**
- Lượt thi được tạo 14:51:21 (lúc còn mở trong Zalo), ảnh bàn làm việc 15:10:28, ảnh khuôn mặt 15:10:51. Hạn nộp tính
  từ lúc tạo lượt (`started_at` + thời lượng), nên khi câu hỏi hiện ra chỉ còn khoảng 10 phút trên 30. Hai đồng hồ
  khớp nhau (điện thoại đếm ngược, màn giám sát đếm xuôi từ cùng một mốc); cái sai là mốc.
- Không có dòng `rules_accepted`: lượt thi được tạo từ nút "Vào thi" ở Bảng điều khiển, nút này gọi thẳng
  `start_exam_attempt`, bỏ qua thể lệ, ô đồng ý và màn chặn Zalo. Đây là thiếu sót của bản thể lệ `b9def29`.
- Bản production bật nhận diện vật thể (COCO-SSD, TensorFlow.js, chạy trên luồng giao diện). Bộ này chỉ bắt đầu tải
  khi câu hỏi đã hiện; lúc tải có một lần suy luận đầu. Đây là nguyên nhân nghi ngờ của đoạn lag, chưa đo trên máy.

**Đã làm** (chỉ frontend)
- Bảng điều khiển: bỏ ô mã và nút vào thi riêng, thay bằng liên kết sang danh sách kỳ thi (nơi có thể lệ).
- `application/object-detector.ts`: một bộ nhận diện vật thể cho cả trang; màn thể lệ gọi `preloadProctoring()` để tải
  trước bộ này và file mẫu khuôn mặt, khi chưa có lượt thi nào.
- Dòng nhật ký `proctoring_timing` cho mỗi lượt thi sau 15 lần quét: thời gian tải, thời gian quét đầu, trung bình, lớn
  nhất, chế độ quét mặt. Không tính là vi phạm (màn giám sát và báo cáo lọc theo tên sự kiện).
- Trang thi: bỏ chữ "mất focus", "fullscreen"; trình duyệt không có toàn màn hình thì không nhắc tới.
- Trang học của học viên: bỏ dòng "Chưa có bài học nào cho lớp của bạn" hiện ngay dưới bài đã giao.
- Kiểm tra: 292 test, lint, ranh giới module, `arch:score`, build đạt. Edge (camera giả, cổng 9334): Bảng điều khiển
  không còn ô mã; ở màn thể lệ 7 file mẫu tải xong sau 11 giây, `start_exam_attempt` = 0.

**Chưa làm / chưa kiểm**
- Chưa chạy trọn bài thi sau bản sửa (camera giả không qua được bước kiểm tra khuôn mặt), chưa đo trên iPhone.
- Mốc tính giờ: chủ dự án duyệt phương án (tính từ lúc chụp xong ảnh khuôn mặt, chuẩn bị tối đa 5 phút). Đã viết
  migration `20261013100000_exam_clock_starts_after_preparation.sql` và nối trang thi gọi `begin_exam_clock`; sửa
  câu thể lệ. Chạy thử trong khối tự hoàn tác đạt 5 trường hợp. Chủ dự án duyệt lần hai; **đã áp production** chiều 13/10/2026.
  Rollback: `docs/rollback/2026-10-13-exam-clock-after-preparation.md`.
- Rollback: `git revert` commit này; không có thay đổi database.

---

## 2026-10-13 | iPhone mở app trong Zalo: camera không chụp được, thêm hướng dẫn mở bằng Safari

**Báo lỗi của chủ dự án** (iPhone, quét mã QR bằng Zalo, 14:57): bước "Chụp ảnh bàn làm việc" báo "Camera chưa phát hình"
dù khung xem trước có hình; camera bật ra toàn màn hình với hai dải đen. Android không bị.

**Nguyên nhân, suy ra từ ảnh chụp màn hình, chưa kiểm chứng trên máy thật**: trình duyệt nhúng trong Zalo trên iPhone
không cho phát video ngay trong trang. Hình camera bị đẩy sang trình phát toàn màn hình của hệ thống; khi học viên
thoát ra thì video dừng. Trang chỉ còn một khung hình đứng, nên bước kiểm tra "video đang phát" báo lỗi sau 15 giây và
nút chụp từ chối. Trang web không tự bật lại được chế độ phát trong trang; đó là cấu hình của app Zalo.

**Đã làm** (chỉ frontend)
- `platform/browser/in-app-browser.ts` (+ test): nhận ra trình duyệt nhúng của Zalo, Facebook, Messenger, Instagram,
  TikTok, Line qua user agent; riêng Zalo trên iPhone được đánh dấu là không dùng được camera.
- `shared/ui/InAppBrowserNotice`: nút "Mở bằng Safari" (địa chỉ `x-safari-https://`, iOS 17 trở lên), nút chép địa chỉ,
  và hướng dẫn mở bằng dấu ⋯.
- Trên iPhone trong trình duyệt nhúng: băng nhắc ở đầu mọi trang. Trong Zalo trên iPhone: bấm "Vào thi" thì hiện màn
  hướng dẫn thay cho thể lệ, không tạo lượt thi; hai bước chụp ảnh cũng hiện lời nhắc.
- Kiểm tra: 292 test, lint, ranh giới module, `arch:score` đạt. Edge giả lập user agent của Zalo trên iPhone: có băng
  nhắc, có màn chặn, không gọi `start_exam_attempt`; trình duyệt thường không bị ảnh hưởng.

**Chưa làm**: chưa thử trên iPhone thật (cả việc nút "Mở bằng Safari" có mở được từ trong Zalo hay không); chưa push.

---

## 2026-10-13 | Đổi tên hiển thị của ba app

Chủ dự án chốt ngày 13/10/2026, vì app thi nay có cả phần học:

| Tên cũ | Tên mới |
|---|---|
| App Thi Online | HPTTS Learn & Exam |
| Quản lý TTDT-HPTTS (app quản lý) | HPTTS Training Manager |
| Sổ chuyên cần | HPTTS Class Log |

Chỉ đổi chữ người dùng nhìn thấy: tiêu đề tab, trang đăng nhập, khung menu, và các câu nhắc tới app khác. Giữ nguyên
địa chỉ web, tên repo, tên gói, tên bảng và cột trong database, chú thích trong mã và tài liệu cũ. Ở app này: 12 file, 14 dòng. Test, lint, build đạt; tên trên menu quản trị nằm gọn một dòng.

---

## 2026-10-13 | Migration rút bài đã áp; nút "Rút bài" chạy trên production

Chủ dự án duyệt. `20261013090000_elearning_archive_assignment.sql` (repo app quản lý) đã áp production cùng migration
Thùng rác `20261012090000`. Thử trên Edge, production, tài khoản admin: rút bài thử khỏi lớp `TEST-TH` (dòng bản giao
ghi người rút và thời điểm), rồi giao lại phiên bản 3 để bài vẫn còn cho lần thử trên điện thoại.

---

## 2026-10-13 | Push e-learning giai đoạn 1 và 2 cùng bản ổn định iOS

**Bối cảnh**: chủ dự án báo phiên làm phần iOS đã xong và yêu cầu kiểm tra lại rồi push.

**Đã làm**
- Chạy lại trên toàn bộ bản làm việc: kiểm tra kiểu, lint, 287 test, ranh giới module, build đều đạt. `arch:score`
  trượt: `App.tsx` mới dùng `lazy(() => import(...))`, công cụ đo chỉ đọc `import` tĩnh nên chỉ nhận 3/48 route, CI
  sẽ đỏ. Sửa `scripts/architecture-score.mjs` cho đọc cả kiểu khai báo này (`bd493b4`): 48/48, 10/10.
- Commit phần iOS thành một commit riêng (`a6bd241`), kiểm tra trên bản tách riêng trước khi commit. Phần quét CCCD
  (`.env.example`, `api/scan-id-card.ts`, `api/_lib/`, `ocr-proxy.ts`, `ocr-image.ts`) vẫn để ngoài.
- Push `0ac2751`, `27e21b1`, `bd493b4`, `a6bd241`. CI và Vercel đạt.
- Edge trên production: 12 trang quản trị (có "Bài học") tải được, không lỗi mạng; học viên thử đăng nhập, thấy màn thể
  lệ, thấy bài được giao trong "Học trực tuyến".

**Chưa làm**
- Phần thi có camera (ảnh vào thi, giám sát, toàn màn hình) của bản iOS chưa được thử trên thiết bị thật, kể cả máy
  tính: Edge ở đây không có camera. Checklist ở `docs/implementation/2026-10-13-ios-reliability.md`.
- Migration `20261013090000_elearning_archive_assignment.sql` chưa áp: nút "Rút bài" báo "Máy chủ chưa có chức năng này".

**Quay lui nhanh nếu thi thử lỗi**: Vercel > Deployments > bản của commit `b9def29` > Promote to Production.

---

## 2026-10-13 | E-learning giai đoạn 1 và 2: soạn bài và giao bài trong App thi

**Đã làm**
- Menu quản trị có nhóm "Học trực tuyến" với mục "Bài học" (`/admin/lessons`, `/admin/lessons/:lessonId`).
- Soạn bài theo mô-đun: thêm, sửa, sắp xếp, xóa khối video, PDF, bài viết; xem trước; xuất bản thành phiên bản cố định.
- Giao phiên bản mới nhất cho lớp thuộc khóa có mô-đun: ngày mở, hạn học, thứ tự, bắt buộc, học tuần tự. Dòng của
  từng lớp hiện phiên bản đang học và số học viên đã bắt đầu, đã học xong.
- Video có đo thời gian phải dài từ 15 giây: trình phát tính theo giây tròn và mất giây lẻ cuối, clip ngắn hơn không
  bao giờ đủ 90%.
- Tài liệu: `docs/implementation/2026-10-13-elearning-authoring-and-assignment.md` và file rollback cùng tên.

**Thử trên Edge, bản ở máy, dữ liệu production, lớp `TEST-TH`**
- Admin: tạo bài "[THỬ] Bài học thử 13/10", ba khối, xuất bản ba phiên bản, giao và giao lại cho lớp. Các lỗi nhập
  (tên trống, thiếu đường dẫn, thiếu độ dài, video 5 giây) đều bị từ chối kèm thông báo.
- Học viên thử, cửa sổ cỡ điện thoại: thấy bài trong "Học trực tuyến"; đánh dấu bài viết thì lên 1/3; tua video tới
  cuối rồi phát thì không gửi gì lên máy chủ; xem thật thì máy chủ ghi đúng khoảng đã xem.

**Chưa làm**
- Chưa push. Migration `20261013090000_elearning_archive_assignment.sql` (repo app quản lý) đã chạy thử, chưa áp; trước
  khi áp thì nút "Rút bài" báo "Máy chủ chưa có chức năng này".
- Chưa thử trên điện thoại thật; chưa xem trọn video 30 giây tới lúc hoàn thành (file mẫu tải quá chậm).
- App quản lý: mục "Quản lý E-Learning" chưa đổi thành nút mở sang App thi.
- Trang học viên còn hiện dòng "Chưa có bài học nào cho lớp của bạn" của danh sách cũ ngay dưới bài được giao.

**Lưu ý**: trong lúc làm, một phiên khác đang sửa `exam-taking` và `platform/media` (độ ổn định trên iOS). `npx tsc -b`
và lint trên bản làm việc đang báo lỗi ở các file đó; commit này được kiểm tra trên bản tách riêng, không kèm các file
ấy.

---

## 2026-10-13 | Kế hoạch e-learning: soạn và học đều ở App thi

**Bối cảnh**: chủ dự án đưa mã Frappe Learning (`D:\Data\New folder (2)\lms`) để tham khảo và chốt: app quản lý chỉ
theo dõi, giám sát, báo cáo; App thi là nơi soạn. Hiện chỉ admin soạn, sau này mở cho giáo viên và giáo vụ.

**Đã làm**: viết `docs/PLAN_ELEARNING.md` (7 giai đoạn). Kế hoạch 04–05/10 bên app quản lý đặt phần soạn bài ở app
quản lý; phần bố trí đó nay được thay.

**Ghi nhận**: production có 2 bài học, 0 khối nội dung, 0 bài được giao. Không chép mã Frappe (khác nền tảng, giấy
phép AGPL-3.0).

**Chưa làm**: chưa bắt đầu giai đoạn nào; chờ chủ dự án quyết bốn điểm ở mục 5 của kế hoạch.

---

## 2026-10-12 | Màn thể lệ thi hiện trước khi tính giờ

**Hiện trạng cũ**: bấm "Vào thi" là tạo lượt thi ngay (đồng hồ chạy, mất một lượt), sau đó mới hiện trang quy định kèm
ô tích. Trang đó viết chung chung, không có số liệu của kỳ thi.

**Đã làm**
- `ExamRules` (`ui/intro/`): thể lệ gồm số câu, thời gian, điểm đạt, số lượt thi, ba nhóm quy định, ô cam kết. Nút
  "Đồng ý và vào thi" khóa cho tới khi tích. Nội dung nằm ở `domain/exam-rules.ts`, có test.
- `AvailableTheoryExamsPage`: bấm "Vào thi" hiện thể lệ; chỉ khi đồng ý mới gọi `start_exam_attempt`, rồi vào thẳng
  trang làm bài. Lỗi mã truy cập hiện ngay trên màn thể lệ.
- Sau khi tạo lượt thi, ghi một dòng `rules_accepted` vào `attempt_audit_logs`.
- `/exam/:id/intro` giữ lại cho lượt thi đã tồn tại, dùng chung `ExamRules`.
- Kỳ thi quay ngẫu nhiên nhiều đề: chưa biết đề nào trước khi tạo lượt, nên không hiện số câu, thời gian, điểm đạt.
- Kiểm tra: 250 test, lint, `check:boundaries`, build đạt. Edge cỡ 390px trên trang xem thử tạm: không tràn ngang, nút
  khóa khi chưa tích.

**Chưa làm**: thử cả luồng bằng tài khoản học viên (đăng nhập bằng mật khẩu trong file Excel bị từ chối).

---

## 2026-10-12 | Thi thử trên điện thoại; giám sát AI nhận "không thấy khuôn mặt" nhanh hơn, thêm nhận camera bị che

**Thi thử** (kỳ thi thử, lớp TEST-TH, một lượt, 3 phút 19 giây): điểm, số vi phạm rời trang (2), ảnh giám sát, trang chi
tiết bài làm và báo cáo khớp với database; không ghi điểm sang TTDT. Lỗi còn lại: câu nối cặp hiện sai phần "Đáp án
đúng" ở trang chi tiết bài làm (`[object Object]`).

**Phản hồi của người thi**: khoảng 15 giây mới báo "không thấy khuôn mặt"; lấy tay hoặc chuột che camera thì không báo
hoặc báo rất chậm.

**Nguyên nhân**: luật cũ cần 6 lần quét liên tiếp không thấy mặt, mỗi lần cách 2,5 giây. Che hờ làm thỉnh thoảng một lần
quét vẫn thấy mặt, bộ đếm quay về 0. Không có kiểm tra khung hình đen.

**Đã làm** (chỉ frontend, không đổi database)
- Khuôn mặt quét mỗi giây (`FACE_SCAN_INTERVAL_MS`); điện thoại và vật cấm vẫn quét mỗi 2,5 giây vì model nặng hơn.
- Không thấy mặt: 4 trong 5 lần quét (khoảng 5 giây). Nhiều mặt: 3 lần liên tiếp (khoảng 3 giây).
- Camera bị che: khung hình gần đen hoặc gần một màu trong 3 lần quét liên tiếp (khoảng 3 giây), ghi là `ai_no_face`
  kèm `detection.cameraCovered`. Phòng quá tối cũng rơi vào trường hợp này.
- Kiểm tra: 246 test, lint, `check:boundaries`, build đạt.

**Chưa làm**: thử lại trên điện thoại thật sau khi deploy; theo dõi tỉ lệ nhận nhầm ở kỳ thi thử kế tiếp.

---

## 2026-10-12 | Form tạo kỳ thi báo lỗi ngay cạnh nút lưu

**Vấn đề**: bấm "Tạo kỳ thi" khi chưa nhập mã truy cập thì trang không hiện gì ngoài bong bóng của trình duyệt; các lỗi
khác của form chỉ hiện ở đầu trang, người đang ở cuối form không thấy. Mã toàn dấu cách vẫn lưu được.

**Đã làm**
- `windowFormError` kiểm tra thêm thời gian bắt đầu, kết thúc và mã truy cập (bỏ dấu cách hai đầu).
- Form tắt kiểm tra của trình duyệt (`noValidate`), hiện câu lỗi tiếng Việt ở đầu form và ngay trên nút lưu.
- Mã truy cập được cắt dấu cách hai đầu khi lưu.
- Kiểm tra: 243 test, lint, `check:boundaries`, build, `arch:score` đạt. Edge bản local: ba trường hợp thiếu thời gian,
  thiếu mã, mã toàn dấu cách đều báo lỗi và không gửi yêu cầu tạo kỳ thi.

**Chưa làm**: push.

---

## 2026-10-12 | Rà và commit khối thay đổi 06/10 (hoàn thiện kiến trúc, 6 lỗi rà soát)

**Bối cảnh**: khối hoàn thiện modular monolith và 6 bản sửa sau rà soát làm ngày 06/10 vẫn nằm trên máy, chưa commit.

**Đã làm**
- Chạy lại trên bản làm việc: 243 test, lint, `check:boundaries`, build đều đạt; `arch:score` 98,3% · 46/46 · 10/10.
- Chạy thử `20261006151544_exam_audit_fixes.sql` trên production trong giao dịch tự hủy: tạo đủ 6 hàm, 2 trigger, không
  lỗi; sau đó production không đổi.
- Edge trên bản local (tài khoản admin, chỉ xem): 10 trang quản trị tải được, không lỗi mạng. Trang "Chi tiết bài làm"
  báo "Lỗi tải dữ liệu" vì gọi `get_attempt_review_questions`, hàm chỉ có sau migration.
- Commit thành ba bước ở máy: migration và test database; mã nguồn; tài liệu. Viết thêm tài liệu rollback.
- Phần quét CCCD (`.env.example`, `api/scan-id-card.ts`, `api/_lib/`, `ocr-proxy.ts`, `ocr-image.ts`) để nguyên, chưa
  commit.

**Đã lên production (chủ dự án duyệt 12/10)**: kiểm tra không có ai đang thi và không có kỳ thi đang mở; áp migration
`20261006151544`, push 4 commit ngay sau đó; Vercel và CI đạt. Trên production: 5 trang quản trị tải được, trang "Chi
tiết bài làm" hiện đủ điểm, kết quả và từng câu (trước migration báo lỗi tải).

**Thấy khi thử**: trong "Chi tiết bài làm", đáp án đúng của câu nối cặp hiện thô ("right ↔ …", "map ↔ [object Object]").
Chưa sửa, chưa biết có từ trước hay mới.

**Chưa làm**: thử luồng học viên làm bài, giám sát AI, e-learning bằng tài khoản thật.

**Lưu ý**: production có 335 lượt thi đang ở trạng thái "đang làm", chưa kiểm tra nguyên nhân.

---

## 2026-10-06 | Thùng rác giữ lại kết quả thi của lớp thật (Plan 79)

**Đã làm**
- Migration `20261006090000_exam_trash_keep_real_results.sql`: `exam_trash_hard_delete` từ chối mục có kết quả của lớp
  thật; `exam_trash_list` trả thêm cột `real_results`. Kết quả thi thử (kỳ thi `is_trial`, lớp mã bắt đầu bằng TEST)
  vẫn xóa được. 3 test database mới, tổng 42 đạt.
- Chạy thử trên production trong giao dịch tự hủy: 9/10 đề trong thùng rác sẽ bị chặn (176 kết quả thật).

**Đã áp lên production (chủ dự án duyệt 06/10)**: gọi thử bằng tài khoản nhân viên trong khối tự hủy, xóa vĩnh viễn một
đề có 56 kết quả thật bị từ chối; số bài làm 946 trước và sau.

**Tiếp theo**: thi thực hành RTG K43 ngày 09/10; Plan 79 giai đoạn 1 từ 12/10 (`QuanltTTDT-HPTTS/docs/PLAN_79.md`).

---

## 2026-10-05 | Đồ thi online vào Thùng rác của app quản lý

**Đã làm**
- Kỳ thi lý thuyết chuyển sang xóa mềm (trước xóa hẳn, mất luôn bài làm). Học viên, màn giám sát, trang tổng quan bỏ
  qua kỳ thi đã xóa: vá `start_exam_attempt`, `get_available_exam_windows`, `get_live_exam_monitor` bằng một phép thay
  có kiểm tra trong migration.
- Hàm `exam_trash_list`, `exam_trash_restore`, `exam_trash_hard_delete` (chỉ nhân viên) cho Thùng rác của app quản lý:
  đề thi, kỳ thi lý thuyết, mẫu đánh giá, ca chấm. Xóa vĩnh viễn được cả khi có điểm (quyết định của người vận hành);
  điểm đã sang bảng điểm và ảnh trong `exam-uploads` giữ nguyên.
- Test database 40/40. Chạy thử trên production rồi áp dụng `20261005090000`, `20261005091000` lúc không ai đang thi.

## 2026-10-04 | Admin tạo kỳ thi thực hành, Sổ chuyên cần chỉ chấm

**Đã làm**
- Quyết định của người vận hành: mẫu, tiêu chí và kỳ thi thực hành đều do admin tạo trên App thi; Sổ chuyên cần chấm
  theo đó; App quản lý theo dõi. Bản ẩn nút "Thêm kỳ thi" (chưa push) được thay bằng hướng này.
- Form "Thêm kỳ thi" tạo kỳ thi chấm tại sân (`teacher_grading`), bỏ ô mã truy cập (tự sinh). Tạo trùng lớp và mẫu bị
  từ chối bằng câu dễ hiểu.
- Sổ chuyên cần (repo riêng) hiện danh sách kỳ thi thay cho hai ô chọn lớp và đề.
- Edge trên bản local: tạo trùng bị từ chối; tạo kỳ thi lớp thử với mẫu xe nâng container thì hiện ngay trên Sổ chuyên
  cần (kiểm luôn migration kỳ chấm chưa xóa); đã xóa mềm kỳ thi thử đó.
- Xóa mềm kỳ chấm lớp RTG Khóa 44 theo mẫu Khóa 43 (thử nghiệm, người vận hành yêu cầu xóa).

- Mục "Chấm thực hành" (luồng cũ: học viên nộp ảnh, giáo viên kéo thanh trượt, bấm đồng bộ tay) thay bằng "Kết quả thực
  hành", chỉ xem, tự cập nhật mỗi 10 giây như giám sát lý thuyết: tổng quan ca thi, từng học viên với trạng thái, điểm
  /100 và /10, đạt hay không, đã gửi TTDT chưa; trang chi tiết có điểm từng tiêu chí kèm lỗi đã trừ, thời gian chu kỳ,
  bảo hộ, lỗi loại, ảnh (URL ký), giám khảo. Bỏ trang chấm bằng thanh trượt vì lưu ở đó ghi đè kết quả đã khóa tại sân.
- Edge trên bản local với lớp thử: 3/3 xong, 1 đạt, 1 loại thi, 1 thiếu bảo hộ; chi tiết Học viên thử 1 đúng 94/100.

- Gỡ luồng "học viên tự chụp ảnh nộp bài" theo yêu cầu: màn `PracticalTakePage`, route `/practical/:attemptId`, khối
  "Thi thực hành đang mở" ở trang chủ học viên, `application/attempts.ts`, `data/attempt-repository.ts`, các hook và hàm
  domain chỉ luồng này dùng, `platform/storage/exam-uploads.ts`. RPC và test database giữ nguyên. `arch:score` 73,4%,
  38/46 route.

**Tiếp theo**: sửa ngày thi kỳ RTG Khóa 43 thành 09/10; thử phiếu chấm Word thật; diễn tập 08/10; thi 09/10.

## 2026-10-03 | Khung app theo bản mẫu, nhập mẫu đánh giá từ file

**Đã làm**
- Khung app theo bản mẫu chấm thi, giữ nhận diện HPTTS: nhóm menu viết thường tiếng Việt, mục đang chọn có vạch cyan,
  đầu trang có đường dẫn và chip thật (mạng, số điểm chờ gửi TTDT). Bỏ nhãn in hoa dãn chữ. Đăng xuất chỉ trên máy này.
- Nhập mẫu đánh giá từ Excel theo mẫu (4 sheet, tải trên trang nhập) hoặc Word phiếu chấm của trung tâm (bảng, khung
  thời gian, mục "Các lỗi vi phạm", bước đề xuất). Xem bản nháp và cảnh báo trước khi tạo.
- Đã push (`6b0a349`), CI đạt; Edge trên production: nút "Nhập từ file" và trang nhập có.
- Xóa mềm 3 kỳ chấm thực hành thừa do lỗi Sổ chuyên cần ngày 02/10 tạo ra.
- Nút Sửa, Xóa, Chấm bài ở Mẫu đánh giá, Kỳ thi thực hành và Tiêu chí thành icon như trang Đề thi lý thuyết
  (`src/shared/ui/IconAction.tsx`). Đã push (`5056c86`), Edge trên production: đủ nút, hộp xác nhận xóa vẫn mở.
- Bước thao tác trong trang soạn mẫu: bỏ, lên, xuống thành icon (`474dc28`).
- Chấm thử theo yêu cầu: tạo mẫu "THI THỬ – RTG (xóa sau)" từ file Excel mẫu, chấm Học viên thử 1 của lớp thử trên Sổ
  chuyên cần production (96/100, TTDT nhận 9,6), rồi xóa mềm kỳ chấm và mẫu.
- Migration `20261003120000_practical_session_unique_live` (`5065ee1`): kỳ chấm đã xóa mềm không chặn kỳ mới cùng lớp
  và mẫu. Chạy thử trên production, người vận hành đồng ý, đã áp dụng.

**Vấn đề gặp**: luật ranh giới không cho domain import `src/shared`, nên bộ đọc Word xuất qua `question-bank/public.ts`.
Danh sách lỗi đánh số bằng kiểu "List Number" của Word không mang số trong đoạn văn: đọc mọi đoạn của mục lỗi.

**Tiếp theo**: người vận hành thử phiếu chấm Word thật; giáo viên RTG xem lỗi trừ nhanh; diễn tập 08/10; thi 09/10.

## 2026-10-02 (tối) | Điểm TTDT tháng 3–4, nhật ký đồng bộ, thi thực hành chấm tại sân

**Đã làm**
- Bỏ nút "Dọn lỗi cũ (30 ngày)" (không có quyền xóa nên chưa từng xóa được). Gửi lại 66 bài tháng 3–4 TTDT đang trống
  điểm (6 bài TTDT có điểm khác giữ nguyên theo người vận hành); TTDT có đủ 66.
- Phát hiện và sửa `exam_sync_log.module_id` kiểu uuid: từ 29/09 mọi lần gửi lý thuyết ghi nhật ký lỗi và bị gửi lại
  liên tục. Migration `20261002160000` đã áp dụng; hàng đợi về thành công. Lịch `exam-maintenance` đang chạy mỗi phút.
- Thực hành chấm tại sân (Sổ chuyên cần): `practical_attempts.student_id`, trạng thái `not_eligible`, điểm đạt; tổng
  /100 gửi TTDT /10 (`20261003090000`). Mẫu đề có cấu hình chấm tại sân, mô-đun TTDT, xóa mềm (`20261003100000`).
  Đã tạo đề RTG Khóa 43 theo phiếu chấm. Đã push (`c103b7d`), CI đạt.
- Thử trọn luồng với lớp thử trong TTDT: 94/100 → 9,4; loại thi → 0 và phải thi lại; thiếu bảo hộ → không gửi.

**Vấn đề gặp**: chép phiên production sang app local làm mất phiên production (xoay refresh token). Sổ chuyên cần tự
đăng xuất toàn cục khi tải hồ sơ chậm (đã sửa bên Sổ chuyên cần).

**Tiếp theo**: giáo viên RTG xem lại lỗi trừ nhanh; diễn tập 08/10; xóa mềm lớp thử sau diễn tập. Ghi nhận: bucket
`exam-uploads` đang công khai và policy cho mọi tài khoản đọc toàn bộ; xử lý sau ngày thi.

## 2026-10-02 (chiều) | Modular monolith: file theo dõi tiến độ, giai đoạn 2

### Đã làm
- Push 1a, 1b (`ca8f136..4871f6d`, CI đạt) và file theo dõi `docs/MODULAR_MONOLITH_TIEN_DO.md` (`ce48a3d`): bảng
  giai đoạn, commit, lệnh rollback, việc còn mở.
- Giai đoạn 2, module `exam-reporting` (`e32affd` … bước 5): Dashboard admin, Báo cáo lý thuyết, trang kết quả một
  lượt thi; xóa `reportService`, `dashboardService`. Luật thuần vào `domain/` kèm 27 test (tổng 175).
- Kết quả: 54.3% mã nghiệp vụ trong module, 25/46 route, 5/10 tiêu chí.
- Kiểm tra trên Edge (bản local so với production, chỉ xem): dashboard giống hệt; 6 đề có số bài và số tín hiệu khớp;
  2 file Excel đúng tên sheet và cột; link bằng chứng AI mở được (ký mới); trang kết quả một lượt thi khớp điểm, 50 câu,
  ảnh lúc vào thi hiện.

### Vấn đề gặp
- Phiên đăng nhập production trong Edge hết hạn; người dùng đăng nhập lại.
- Lỗi có sẵn: tab "Tín hiệu giám sát" không lọc theo đề/kỳ thi và dừng ở 1.000 dòng (production cũng vậy). Đã sửa
  bằng `attempts!inner` và đọc theo trang; số trên Edge khớp đếm trực tiếp trong database (QC 170, đề lớn 2.276).

- Push giai đoạn 2 và bản sửa lọc tín hiệu (`2259f3f`, `e062e20`, CI đạt).
- Giai đoạn 3, module `practical-exams` (`c13ab5e` … bước 4): 3 service, 7 trang, adapter tải ảnh
  `src/platform/storage/`. 62.6% mã nghiệp vụ trong module, 34/46 route. Edge: các trang có dữ liệu giống production.
  Form thêm mẫu không còn mất con trỏ sau ký tự đầu.
- Cửa sổ Edge kiểm thử (cổng 9333) bị đóng; mở lại bằng hồ sơ cũ trong scratchpad, vẫn còn đăng nhập.

- Push giai đoạn 3 (`c040039`, CI đạt). Giai đoạn 4 (e-learning) hoãn theo quyết định của người dùng: stash
  E-LEARNING sửa đúng các file đó.
- Giai đoạn 5 (`b3e7341` … bước 5): `identity-access` (đăng nhập, vai trò, chặn quyền có test, CCCD) và `integrations`
  (đồng bộ TTDT, nhật ký, OCR). 72% mã nghiệp vụ trong module, 38/46 route, còn 3 service cũ. Edge: chặn quyền, F5,
  /start, /login, /verify-cccd, Nhật ký đồng bộ giống production.

### Kế hoạch tiếp theo
- Hỏi người dùng trước khi push giai đoạn 5 (ngoài giờ thi; đụng đăng nhập mọi người).
- Thử đăng nhập giáo viên và học viên thật sau khi push.
- Thử luồng thi thực hành trên dữ liệu thật khi người dùng đồng ý.
- Giai đoạn 6 (`exam-taking`) chỉ sau một buổi thi thử có giám sát AI ổn định.

---

## 2026-10-02 | Modular monolith: giai đoạn 0, 1a, 1b

### Đã làm
- Giai đoạn 0 (đã push `ca8f136`): luật ranh giới tầng, allowlist, điểm kiến trúc trong CI. Mốc 25.3%, 4/10 tiêu chí.
- 1a (`c8c9682`): bỏ trang thêm/sửa/nhập câu hỏi theo đề; chi tiết đề đếm câu trong ngân hàng của mô-đun.
- 1b (`5578bd7` … `ad99cd0`): module `exam-management` (data, application, queries, 6 trang ui), module `integrations`
  (danh bạ TTDT), `shared/ui`; xóa 4 service trung gian. Quy tắc thuần vào `domain/` kèm test (148 test).
- Kết quả: 43.6% mã nghiệp vụ trong module, 22/46 route do module sở hữu, 5/10 tiêu chí.
- Kiểm tra trên Edge (bản local, chỉ xem): danh sách đề, chi tiết, kiểm tra ngân hàng, sửa đề, danh sách kỳ thi,
  form sửa kỳ thi (nạp đúng dữ liệu), form tạo kỳ thi; không có lỗi trang.

### Vấn đề gặp
- Xóa kỳ thi và "Xóa báo cáo thi thử" vẫn là xóa cứng; giữ nguyên khi chuyển code, chờ quyết định.

### Kế hoạch tiếp theo
- Hỏi người dùng trước khi push các commit 1a, 1b.
- Bảng giám sát: ưu tiên lượt đang làm (phần giám sát AI đã commit ở `0267b37`).
- Giai đoạn 2 theo kế hoạch.

---

## 2026-10-01 | Thi thử trên production, sửa lỗi vào lại tạo lượt mới

### Đã làm
- Thi thử (30/09) với học viên thử `hv100228`, lớp FL-K103, đề QC (đã khóa theo đồng ý của người dùng), kỳ thi thử TD30.
  Luồng: đăng nhập → xác thực CCCD nhập tay → vào thi → chụp bàn làm việc, khuôn mặt (người dùng trước webcam).
- Worker `exam-maintenance` tự chốt lượt quá giờ trên production (lần chạy 23:05:00, `finalized: 1`); thi thử không tạo
  việc đồng bộ.
- Bảng giám sát hiện đúng thẻ học viên (đã hủy bài, lần thi, vi phạm).
- Sửa: vào lại kỳ thi bằng mã giờ làm tiếp lượt đang mở (`8b32bfb`, migration `20260930160000` đã áp dụng sau chạy thử);
  thử lại 01/10 với kỳ thi thử TD01: hai lần vào cùng lượt `2a50b880…`, chỉ 1 lượt.
- Dọn: xóa mềm học viên thử và ghi danh, đóng kỳ thi thử TD01 (TD30 đã hết giờ), xóa file mật khẩu tạm.

### Vấn đề gặp
- Camera laptop bị tắt quyền riêng tư (hình ổ khóa) → không thấy mặt; bật lại thì chạy.
- Bản đang chạy hủy bài sau 16 lần "không thấy mặt" trong 35 giây; người dùng đang sửa chính sách giám sát AI (chưa commit).
- Tài khoản thi `hv100228` vẫn còn (học viên đã xóa mềm, file mật khẩu đã xóa).

### Kế hoạch tiếp theo
- Người dùng hoàn thiện giám sát AI; sau đó bảng giám sát ưu tiên lượt đang làm khi một học viên có nhiều lượt.
- Thi thử lại khi giám sát AI mới đã lên production.

---

## 2026-09-28 | Bỏ 2 biểu đồ, giữ thứ tự phương án, nhập đề từ Word

### Đã làm
- Bỏ "Phân phối điểm số" và "Top đề thi" ở dashboard (`8fa4af0`).
- Câu có phương án kiểu "Đáp án a, b đúng", "Tất cả các ý trên" không còn bị đảo; mọi phương án trắc nghiệm hiện chữ
  a), b), c) (`cadcb58`). 105/1.194 câu trong ngân hàng được giữ thứ tự.
- Nhập đề từ Word .docx ngay trên trình duyệt (`b8437de`): đáp án theo chữ đỏ / tô nền / in đậm / gạch chân (chọn theo
  file, máy đề xuất), dòng "Đáp án:", bảng đáp án cuối file; ảnh tách khỏi file và gắn đúng câu, có ảnh thu nhỏ khi xem
  trước; câu nghi ngờ lưu ở Bản nháp kèm ghi chú. Thử trên production với file ĐẾ (134 câu, 13 câu có ảnh) rồi xóa mềm.

### Vấn đề gặp
- File của trung tâm trình bày nhiều kiểu: cả câu trong một đoạn có xuống dòng mềm, "Câu 46" dính cuối phương án của
  câu 45, gõ nhầm "Cây 13.", cùng câu hỏi khác đáp án (ĐẾ câu 28/40/76, 32/62). Bộ đọc báo lỗi hoặc đánh dấu xem lại.
- Một số file không có đáp án (Forklift, NH Cont, Lái xe ô tô 3–4); 24 file .doc cũ phải lưu lại thành .docx.

### Kế hoạch tiếp theo
- Tạo thư viện cho cần trục chân đế và các nghề còn thiếu rồi nhập thật; sửa các câu lỗi trong file Word.
- Tổng duyệt thi thử (còn dở từ trước), báo cáo thi thực hành, PDF/ảnh chụp sau.

---

## 2026-09-28 | Thứ tự việc mới, bỏ màn chấm tự luận

### Đã làm
- Người dùng chốt: giám sát thi trực tuyến làm tiếp (thay "Bài làm gần đây" ở dashboard, nhóm theo lớp, 5–10
  học viên/lớp, người cần chú ý lên đầu, tín hiệu kết nối 20 giây, làm mới 15 giây); nhập đề Word và báo cáo thực hành
  để sau.
- Bỏ menu, route và trang "Chấm tự luận": `grade_attempt` đã chấm câu tự luận theo key.
- Giám sát thi trực tuyến: migration `20260928120000` (cột `last_seen_at`, `touch_attempt`, `get_live_exam_monitor`)
  chạy thử trên production đạt; trang làm bài gửi tín hiệu 20 giây; module `exam-monitoring` (nhóm theo lớp, 8 học
  viên đầu, người cần chú ý lên đầu, tự làm mới 15 giây) thay "Bài làm gần đây" ở dashboard. Người dùng duyệt:
  chạy migration rồi push.
- Bảng giám sát đổi sang thẻ theo ảnh mẫu người dùng gửi (tab theo lớp, lưới 3 cột, 6 thẻ/tab, bỏ "Nhận xét"); migration
  `20260928150000` trả thêm điểm và lần thi (chạy thử rồi chạy thật). 45 test đạt.
- Kết nối Supabase MCP mất giữa buổi; dùng `npx supabase db query --linked` thay thế.

---

## 2026-09-26 | Nghiệm thu C2 và push

### Đã làm
- Bốc đề thử trên dữ liệu production trong khối lệnh tự hủy: khóa cả 7 đề, mỗi đề một kỳ thi thử, một tài khoản học
  viên gọi `start_exam_attempt` và `get_questions_for_attempt`. Cả 7 đề: 50 câu, 50 nội dung khác nhau, không câu
  `retired`/đã xóa, đúng mô-đun và một ngân hàng; học viên tải đủ 50 câu. Sau đó 0 đề khóa, 0 kỳ thi thử, 0 bài.
- `check:boundaries` và `npm run build` đạt. Push 12 commit (Phase C, sửa khung admin, sửa bốc đề, C2, `exam_role`).

### Vấn đề gặp
- Không đề nào đang khóa; hàm bốc đề từ chối đề chưa khóa (từ P0). Nút "Khóa đề thi" đếm câu ở bảng cũ `questions`:
  6 đề khóa được, đề QC có 0 câu ở bảng cũ nên không khóa được. Ghi ở mục Open issues của `IMPLEMENTATION_LEDGER.md`.

- Người dùng đồng ý sửa: nút "Khóa đề thi" giờ kiểm tra ngân hàng câu hỏi của mô-đun theo đúng quy tắc hàm bốc đề
  (`docs/implementation/2026-09-26-lock-exam-checks-question-bank.md`). 21 tình huống mẫu đạt; SQL chỉ đọc cho thấy
  cả 7 đề (kể cả QC) sẽ khóa được. `e638b88`, đã push (người dùng: "Push đi, tôi sẽ khóa đề").

### Kế hoạch tiếp theo
- Người dùng tự khóa từng đề trước kỳ thi (đề nào chưa khóa thì học viên không vào được).

### Việc nhỏ (người dùng: "làm các việc nhỏ trước đi")
- Thêm Vitest 4.1.11 (`npm test`) và CI GitHub (ranh giới, lint, test, build). Test đầu tiên: 21 tình huống của hàm
  kiểm tra khi khóa đề, 11/11 đạt. `docs/implementation/2026-09-26-vitest-and-ci.md`.
- Chặn route giáo viên: `/admin` chỉ khớp chính nó, không còn là tiền tố mở mọi trang admin (`src/utils/adminAccess.ts`,
  24 test đường dẫn). Chưa thử trên trình duyệt vì chưa có tài khoản giáo viên.
- Điểm QTHH-AT cũ: 2 học viên phía trượt đã thi lại và đạt trong ngày (app quản lý lưu điểm đạt); tính lại chỉ đổi 1
  kết quả đạt. Người dùng chọn giữ nguyên điểm, đóng mục này trong ledger.
- Push `d502acc`, `5305972` (người dùng: "Push ngay").

### Giao diện theo nhận diện HPTTS (người dùng: "Toàn app, trước tổng duyệt")
- Theo `QuanltTTDT-HPTTS/DESIGN.md`: `indigo-*` trỏ sang dải `brand` theo vai trò (như app quản lý), `slate-*` sang `gray`,
  font Arial; logo chuẩn ở trang đăng nhập và đầu thanh bên; thanh bên `brand-900` phẳng; bỏ 22 gradient, bóng phát
  sáng, chấm nhấp nháy; nhãn trên dải màu đầu thẻ dời vào thân thẻ; nút cảnh báo vi phạm đủ tương phản.
- Thiếu file từ đơn vị thiết kế: favicon, logo âm bản, dải Tín – Tâm – Trí, font chính.

---

## 2026-09-23 | Phase C: tách giao diện ngân hàng câu hỏi

### Đã làm
- Cất tạm thay đổi menu E-LEARNING chưa commit (`git stash`, ghi đầy đủ nội dung trong `docs/IMPLEMENTATION_LEDGER.md` mục "Parked changes"), pull 8 commit P0/P1/Phase B.
- Tách `QuestionLibraryDashboardPage` thành các route riêng: danh sách ngân hàng, cây kiến thức, câu hỏi (mới, có lọc theo trạng thái, mục cây, từ khóa), nhập tài liệu, rà soát bản nháp. Link cũ `?library=` tự chuyển hướng.
- Khôi phục dấu tiếng Việt cho các chuỗi bị mất dấu; mỗi màn có trạng thái đang tải, trống, lỗi.
- Tài liệu: `docs/implementation/2026-09-23-phase-c-question-bank-routes.md`, `docs/rollback/2026-09-23-phase-c-question-bank-routes.md`.
- 2026-09-24: rà UI theo antislop (bỏ câu chữ hứa tính năng chưa có, nút Tải lại khi lỗi, vùng bấm 44 px, số câu theo trạng thái bấm được).
- 2026-09-24: ranh giới dữ liệu ngân hàng câu hỏi (`docs/implementation/2026-09-24-question-bank-data-boundary.md`): đọc nghề và mô-đun chuyển vào `data/` của module; `check:boundaries` chặn module import `services/` cũ và chặn tầng ngoài `data/` import Supabase client. Đi chung một commit với Phase C.
- Sửa lỗi lint duy nhất của repo (`no-useless-escape` ở `src/services/questionImportService.ts`).
- 2026-09-24: click-through Admin trên Edge (điều khiển qua CDP, profile riêng). Phase C đạt. Phát hiện và sửa 3 lỗi có từ trước ở khung admin (`docs/implementation/2026-09-24-admin-shell-fixes.md`): F5 bị đẩy về `/login`, tiêu đề luôn "Dashboard", Tab lọt vào sidebar đang ẩn. Tách commit riêng sau Phase C.

- 2026-09-24: phát hiện hàm bốc đề cho câu lặp ở mô-đun QTHH-AT (4 nghề dùng chung, mỗi nghề một bản sao của cùng 150 câu): 326/326 bài có câu lặp. Đã soạn migration `20260924094701_draw_exclude_duplicate_content.sql` (loại trùng theo lời dẫn + phương án), kiểm chứng bằng giả lập 300 lượt bốc và kiểm tra 7 đề không thiếu câu; đã chạy trên production (phiên bản `20260924094701`), nội dung hàm khớp file, quyền giữ nguyên. Lập báo cáo chỉ đọc cho 203 bài đã nộp (file Excel ngoài repo vì có tên học viên).

- 2026-09-24: commit Phase C (`178dbb5`), admin shell fixes (`9b5ea6b`), bản sửa bốc đề (`b4f65a1`), chưa push. Bắt đầu Phase C2 "một kho câu hỏi": migration `20260924111343` đã chạy trên production. 7 ngân hàng theo mô-đun, 2.798 dòng đã gắn ngân hàng, QTHH-AT gộp 4 bản sao thành 150 câu dùng chung (450 bản sao chuyển `retired`, không xóa), trigger tự gắn câu mới vào ngân hàng của mô-đun.

- 2026-09-24: C2 bước 2 lát 1, editor soạn câu trong module ngân hàng (7 kiểu câu). Không chép 3 hành vi của form cũ vốn làm đổi câu khi chỉ mở rồi lưu (ép kéo thả 4 ô, chia lại điểm ý tự luận khi mở, ghi vị trí ô cho mọi câu 4 nhãn). Mở rồi lưu 6 câu thật trên Edge: md5 nội dung không đổi.

- 2026-09-24: C2 bước 2 lát 2, nhập Excel/CSV/ZIP ngay trong ngân hàng (`/admin/question-libraries/<id>/questions/import`), dùng được cho cả ngân hàng dùng chung QTHH-AT. Mỗi dòng đi qua đúng hàm dựng câu của editor. Dòng đọc không được thì báo lỗi kèm số dòng thay vì tự điền đáp án mặc định như bộ nhập cũ. Dòng trùng (theo khóa của hàm bốc đề) bị bỏ qua. Ảnh tải lên trước, câu lưu trong một lần ghi: hoặc đủ cả, hoặc không câu nào. Sửa lỗi cũ: CSV UTF-8 không có BOM bị mất dấu tiếng Việt; "Đ;S" bị đọc thành toàn Sai. Thử trên Edge với 6 câu `[TEST]` ở trạng thái nháp, kiểm tra DB, rồi xóa mềm.

- 2026-09-24: C2 bước 3, bỏ kho câu hỏi cũ. Trước khi bỏ, chuyển vào tab Câu hỏi của ngân hàng những gì chỉ màn cũ có: lọc theo loại câu, lọc câu lỗi dữ liệu kèm cảnh báo, chọn nhiều để đổi trạng thái hoặc xóa, xóa từng câu trong editor, xuất Excel (cùng cột với file nhập). Khi xóa, câu đã có trong bài thi của học viên được chuyển sang "Ngừng sử dụng" thay vì xóa, vì `grade_attempt` bỏ qua câu đã xóa. URL cũ `/admin/questions/...` tự chuyển tới ngân hàng tương ứng; 4 trang cũ đã xóa. Viết lại hướng dẫn nhập câu hỏi (`docs/HUONG_DAN_SOAN_DE_VA_IMPORT_CAU_HOI.md`). Kiểm tra 7 ngân hàng thật: 1.100 câu đang dùng, 0 câu lỗi.

### Vấn đề gặp
- `node_modules` trên máy thiếu `@tanstack/react-query` sau khi pull; đã `npm install` (lockfile giữ nguyên).
- Chưa click thử khi đăng nhập admin và giáo viên.
- Phát hiện route guard của giáo viên cho mở mọi URL `/admin/...` (lỗi có từ trước, ghi ở mục "Open issues" trong ledger, chưa sửa).

### Kế hoạch tiếp theo
- Nghiệm thu C2: click thử bằng tài khoản giáo viên; thử bốc đề trên một đề thử đã kiểm định.
- Sau C2: nhập tài liệu Word (cần file mẫu của trung tâm), rồi giám sát trực tuyến.

---

## 2026-06-12 — Hoàn thiện tracking video (3 lỗ hổng)

### Đã làm (`LessonPlayerPage.tsx` + `elearningStudyService.ts`)
1. **Resume vị trí xem dở**: `onLoadedMetadata` → `video.currentTime = watched_seconds` (chỉ khi đã xem >5s, chưa sát cuối, block chưa hoàn thành) + toast "Tiếp tục từ phút X"
2. **Drive MP4 track được**: video Drive thử `<video src=uc?export=download>` trước (timeupdate hoạt động → auto-complete 90% + resume); `onError` (file lớn bị Drive chặn stream) → fallback iframe `/preview` + nút hoàn thành tay
3. **Ghi vét tiến độ khi rời trang**: đổi block ở sidebar / bấm về danh sách (unmount) → upsert thường; đóng tab / chuyển app (`pagehide` + `visibilitychange hidden`) → `flushProgressKeepalive` mới trong service (fetch keepalive thẳng REST PostgREST vì supabase-js không hỗ trợ; access token cache sẵn trong ref)
- Chế độ xem trước admin/GV: mọi đường ghi đều bị chặn như cũ

### Lưu ý kỹ thuật
- Drive `uc?export=download` chỉ stream tốt với file vừa/nhỏ (<~100MB); file lớn dính trang virus-scan → tự fallback iframe, không vỡ UI
- Ghi vét chỉ gửi `watched_seconds` (Prefer: merge-duplicates) — không đụng status/quiz_score

---

## 2026-06-11 — Tính năng Học trực tuyến (E-Learning lát 1)

### Đã làm
- `services/elearningStudyService.ts`: lấy mô-đun theo lớp học viên (enrollments → classes → courses → course_modules), bài học đã xuất bản, tiến độ; upsert `elearning_progress` theo (user_id, block_id)
- `pages/StudentLearnPage.tsx`: danh sách bài học gom theo mô-đun, thanh % hoàn thành, **học tuần tự** (bài sau khóa đến khi bài trước xong)
- `pages/LessonPlayerPage.tsx`: sidebar khối nội dung + player — YouTube/Drive nhúng iframe, video HTML5 (Cloudinary/VPS/link mp4) tự hoàn thành khi xem ≥90% và lưu watched_seconds mỗi 15s, PDF iframe, bài viết text
- Route `/student/learn`, `/student/learn/:lessonId` + menu STUDENT "Học trực tuyến"
- Types `Elearning*` thêm vào `src/types/index.ts` (repo này dùng types viết tay, không gen)

### Vấn đề gặp
- Không có — RLS tiến độ dùng đúng pattern `attempts` (`user_id = auth.uid()`), học viên đã có Supabase auth thật

### Bổ sung cùng ngày — Chế độ xem trước cho Admin/GV
- `Layout.tsx`: admin có thêm nhóm menu "XEM TRƯỚC → Học trực tuyến"
- `StudentLearnPage.tsx`: role admin/teacher → dropdown chọn lớp bất kỳ (banner vàng), mọi bài mở khóa, không tải/hiển thị tiến độ
- `LessonPlayerPage.tsx`: preview không ghi `elearning_progress` (chặn cả markCompleted lẫn timeupdate), ẩn nút "Đánh dấu đã học xong"
- `elearningStudyService.ts`: tách `getModulesWithLessonsByClassIds(classIds)` dùng chung cho preview và học viên

### Kế hoạch tiếp theo
- Lát 2: khối Quiz trong bài học (RPC không lộ answer_key, tái dùng `question_bank`)
- Nâng cấp tracking video YouTube bằng IFrame Player API (đếm giây xem thật thay vì nút bấm tay)
- Cân nhắc ràng buộc thời gian xem tối thiểu cho video iframe (YouTube/Drive không tracking được)
