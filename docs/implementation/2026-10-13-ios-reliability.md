# Nâng cấp độ ổn định iOS

Ngày bắt đầu: 2026-10-13 (Asia/Saigon).
Trạng thái: đã triển khai P0–P5; kiểm thử tự động và fixture trình duyệt đạt; P6 còn nghiệm thu trên thiết bị thật. Đã commit (`a6bd241`) và lên production ngày 13/10/2026 theo yêu cầu của chủ dự án, khi chưa có kết quả thiết bị thật.
Người dùng đã yêu cầu ghi kế hoạch và tiến độ vào repo, sau đó triển khai; chọn áp dụng antislop trong lúc sửa.

## Mục tiêu và phạm vi

Giảm tranh chấp camera, phục hồi sau gián đoạn, xử lý fullscreen theo khả năng thực tế, giữ nút thao tác trong vùng nhìn, giảm tác vụ AI trên luồng giao diện và tải trang ban đầu.
Module: exam-taking; shell dùng chung; App routes; platform/browser nếu cần.
Database/API: không thay đổi schema, RPC chấm điểm, giới hạn vi phạm hay dữ liệu thí sinh.
UI: giữ nhận diện HPTTS, ENERGY 1 / RHYTHM 1 / MOTION 1. Không thêm hiệu ứng; sửa bố cục để thao tác được trên màn hình nhỏ.

## Kế hoạch và tiến độ

| Mốc | Công việc | Trạng thái | Điều kiện hoàn tất |
|---|---|---|---|
| P0 | Ghi kế hoạch, điểm tiếp tục và rollback | Hoàn tất | Đã liên kết từ AGENTS và ledger |
| P1 | Camera giám sát dùng chung, hủy kết quả phiên cũ, phục hồi camera, trạng thái thử lại | Hoàn tất mã nguồn + fixture | Bỏ camera AI riêng; hủy/timeout acquire và play; xử lý mute/ended, quay lại tab, hình đứng; fixture phục hồi đạt |
| P2 | Fullscreen chuẩn/WebKit, trạng thái không hỗ trợ, lỗi yêu cầu fullscreen | Hoàn tất mã nguồn + unit tests | Không giả fullscreen; chuẩn/prefixed/unsupported/rejected đều có test |
| P3 | Viewport động, safe-area, modal cuộn và thao tác mobile | Hoàn tất mã nguồn + fixture | Viewport 320×568, 390×844, 844×390; không tràn ngang trong fixture; nút cuối modal thao tác được |
| P4 | Nhận diện mặt trong Worker, fallback, hủy phiên và giải phóng tài nguyên | Hoàn tất mã nguồn + fixture | Worker trả count=0 với hình tổng hợp trong dev và production build; timeout/cancel/fallback có test; giữ chu kỳ/ngưỡng |
| P5 | Tải trang khi cần, hạn chế render lại câu hỏi | Hoàn tất mã nguồn | Lazy routes theo public module, Suspense và lỗi tải trang; memo danh sách câu hỏi; bỏ vòng import đồng bộ manage-windows |
| P6 | Kiểm thử tích hợp, báo cáo, nghiệm thu thiết bị | Tự động/fixture đạt; chờ thiết bị thật | Build/lint/boundaries/tests đạt; chưa thử thi đầy đủ trên iPhone/iPad/Android |

Ước lượng ban đầu: sửa mã 24–38 giờ; kiểm thử thiết bị và phát sinh thêm 1–2 ngày. Thời gian thực tế ghi ở nhật ký, không suy từ ước lượng.

## Nguyên tắc chính sách và rủi ro

- Không coi thiếu API fullscreen là thoát fullscreen; chỉ ghi thoát sau một phiên fullscreen thực sự.
- Không giảm ngưỡng AI hoặc bỏ giám sát để che lag. Giữ chu kỳ mặt 1 giây và vật thể 2,5 giây trong đợt này; bỏ frame chưa sẵn sàng thay vì suy luận không có mặt.
- Worker/ảnh thu nhỏ có thể ảnh hưởng độ chính xác: cần thử mặt xa/gần, ánh sáng yếu, nhiều người, điện thoại và sách trên thiết bị thật.
- Nếu Worker hoặc OffscreenCanvas/WASM không tương thích, dùng MediaPipe trên luồng chính rồi BlazeFace. Trường hợp này vẫn có thể khựng; chưa đo mức cải thiện trên iOS và chưa điều chỉnh chu kỳ quét theo hiệu năng.
- Thư viện Worker dùng IIFE nguyên bản từ npm `@mediapipe/tasks-vision@1.0.1`, phục vụ qua Vite middleware và asset production. Khi nâng phiên bản phải đổi đồng bộ đường asset trong Vite/client và WASM URL; không đổi chỉ một phía.
- Background/điện thoại gọi đến có thể ngắt camera. Phục hồi không đồng nghĩa bỏ qua vi phạm rời tab đã quy định.
- Khả năng fullscreen iPhone/iPad khác nhau; dùng feature detection. Không hứa fullscreen giống Android.
- Không ghi PASS thiết bị thật từ mô phỏng viewport hoặc unit tests.

## Kiểm thử và nghiệm thu

Baseline trước sửa: build thành công (cảnh báo chunk lớn), 34 files / 250 tests đạt. Working tree có thay đổi OCR ngoài phạm vi: `.env.example`, `api/scan-id-card.ts`, `api/_lib/`, `src/modules/integrations/data/ocr-proxy.ts`, `ocr-image.ts`, `supabase/.temp/`; giữ nguyên.

Checklist thiết bị (chưa chạy):

- iPhone Safari: cho phép/từ chối camera; ảnh bàn → ảnh mặt → thi; xoay dọc/ngang; thanh địa chỉ thay đổi; bàn phím; modal không khuất nút.
- Chuyển ứng dụng, khóa/mở máy, cuộc gọi: camera phục hồi hoặc báo lỗi/thử lại; không nhận nhầm hình treo là vi phạm AI.
- Thi đủ thời lượng: chọn/sửa đáp án, lưu, mất mạng ngắn, nộp, kết quả; đo lag và thời gian inference.
- iPad Safari: fullscreen và thoát fullscreen; kiểm tra một thao tác không bị đếm nhiều lần.
- Android Chrome và desktop: kiểm tra hồi quy camera, fullscreen, AI, lưu và nộp.

## Deployment và rollback

Chỉ deploy sau kiểm thử mã nguồn đạt và có kết quả thiết bị thật, hoặc người dùng quyết định rõ triển khai bản thử chưa nghiệm thu. Chưa có yêu cầu deploy ở lần triển khai này.
Rollback: `docs/rollback/2026-10-13-ios-reliability.md`. Chưa commit; không tự tạo commit toàn bộ working tree có thay đổi OCR.

## Nhật ký / điểm tiếp tục

- 2026-10-13: xác nhận phạm vi; tạo kế hoạch, rollback và AGENTS.
- Camera: AI chỉ đọc evidence video. `platform/media/camera.ts` hủy/timeout yêu cầu, dừng luồng trả về muộn và chờ pixel thật khi play. Evidence hủy phiên cũ, bỏ hình pre-event cũ, theo dõi mute/ended và hình đứng 5 giây, phục hồi khi visible/pageshow, có nút kết nối lại. Bước ảnh bàn/mặt có retry và kiểm tra track trước chụp.
- Fullscreen: adapter chuẩn/WebKit; đọc element thực; không coi không hỗ trợ là fullscreen và không ghi thoát nếu chưa có phiên fullscreen thực.
- Layout: viewport-fit=cover, 100dvh với fallback, safe-area, min-height/min-width flex, modal cuộn và cỡ chữ ô nhập mobile. Giữ màu và nhận diện HPTTS.
- AI: classic Worker vì MediaPipe 1.0.1 cần importScripts; phát hiện trong trình duyệt rằng ESM/asset dev qua Vite transform không phù hợp, đã sửa bằng library nguyên bản phục vụ local. Timeout khởi tạo 20 giây/inference 5 giây, hủy frame muộn, giới hạn cạnh dài 640px, fallback, giải phóng COCO sau tác vụ đang chạy và đóng detector/Worker. Bỏ frame ẩn, đứng hình, camera cũ; không gộp mẫu AI qua gián đoạn.
- Hiệu năng React: lazy routes, fallback tải/lỗi, memo danh sách câu hỏi để countdown không render lại danh sách. Chuyển import exam-taking trong manage-windows sang dynamic import để build không có cảnh báo circular chunks. Giữ các route e-learning được thêm đồng thời bởi công việc khác.
- Kiểm thử: 39 files / 287 tests đạt, gồm 19 tests mới của nâng cấp iOS; tổng số có cả tests e-learning từ công việc đồng thời. Lint không lỗi/cảnh báo; boundaries 0 exceptions; production build đạt. Vẫn có cảnh báo kích thước chunk lớn cho các thư viện nặng. Entry JS trong một build sau nâng cấp khoảng 505 kB / gzip 149 kB, baseline 1.564 MB / gzip 477 kB; đây là kích thước bundle, không phải số đo lag trên iPhone.
- Fixture Chrome: camera ready → interrupted → nút retry → ready; số lần mở 1 → 2 sau retry, bật AI vẫn là 2. Worker thực trả mode=worker/count=0 với canvas tổng hợp, dev và production QA build. Không gọi getUserMedia thật; đường upload AI bị vô hiệu trong fixture.
- Bố cục fixture: modal ảnh dọc 390×844 không tràn ngang; ngang 844×390 panel cao khoảng 358px, nội dung khoảng 705px cuộn được và bấm nút cuối thành công. Modal xác nhận 320×568 panel khoảng 536px, nội dung khoảng 697px, xác nhận thành công. Modal cảnh báo hiển thị countdown. Đây không phải nghiệm thu Safari hay luồng bài thi có tài khoản thật.
- Contrast nút mới: trắng trên brand-700 (#1f4e8a) = 8.35:1; giữ palette hiện có, thêm focus-visible.
- Smoke test entry production QA: `/start` hiển thị chọn vai trò, bấm Thí sinh sang `/login` và hiển thị form đăng nhập. Không nhập tài khoản hoặc tạo bài thi thật.
- Bước tiếp theo: chạy checklist thiết bị thật ở trên, ghi model máy/iOS/trình duyệt, thời lượng thi, lỗi và số đo trước/sau. Chưa có bằng chứng để đóng P6 hoặc deploy production. Không tự sửa ngưỡng vi phạm để giải quyết lag.

## Cách AI phiên sau kiểm thử lại

1. Đọc AGENTS và tài liệu này; xem git status/diff để không đụng thay đổi OCR/e-learning ngoài phạm vi.
2. Chạy `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run check:boundaries`, `npm.cmd run build` trên Windows PowerShell.
3. Fixture dev: `npm.cmd run dev -- --host 127.0.0.1`; mở `/tests/browser/ios-reliability.html`.
4. Fixture production: `npx.cmd vite build --config tests/browser/vite.config.ts`, sau đó `npx.cmd vite preview --config tests/browser/vite.config.ts --host 127.0.0.1 --port 5174`; mở cùng đường fixture. `.qa-dist` được bỏ qua Git/ESLint và không phải thư mục deploy.
5. Không đưa fixture vào cấu hình production chính, không dùng tài khoản/dữ liệu thí sinh thật trong fixture. Cập nhật kết quả thiết bị và deployment vào tài liệu sau khi có bằng chứng.

## Kiểm tra UI trong phạm vi nâng cấp

- Hard Gate PASS trong fixture: không tràn ngang ở các viewport đã ghi; retry camera và các nút cuối modal hoạt động; màu nút mới đạt 8.35:1. Không thêm dữ liệu/chỉ số sản phẩm giả vào app; dữ liệu tổng hợp chỉ nằm trong fixture có nhãn rõ.
- Purpose Gate PASS: safe-area/viewport/modal cuộn phục vụ việc nhìn và bấm được nút; không thêm trang trí hoặc hiệu ứng.
- Liveliness PASS theo hướng giữ thiết kế: màu HPTTS và phân cấp hiện có, ENERGY/RHYTHM/MOTION 1/1/1, hành động chính giữ vai trò trung tâm.
- Craftsmanship PASS cho kiểm thử mã nguồn/fixture: có trạng thái camera bắt đầu, gián đoạn và thử lại; Suspense và lỗi tải route; build/lint/tests/boundaries đạt. Nghiệm thu toàn luồng trên Safari và thiết bị thật vẫn ở P6, không coi báo cáo fixture là chứng nhận UI toàn ứng dụng hoặc đủ điều kiện deploy.
