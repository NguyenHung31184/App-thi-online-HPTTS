# Phân tích AI Proctoring (COCO-SSD) — Thực thi & rủi ro máy đời thấp

## 1. Cách bật/tắt

- **Env:** `VITE_AI_PROCTORING_ENABLED=1` thì bật, mặc định `0` (tắt).
- **Vị trí dùng:** Chỉ trong trang làm bài **thi lý thuyết** (`ExamTakePage`), sau khi thí sinh đã **chụp ảnh khuôn mặt** (`photoVerified === true`).
- **Thi thực hành:** Không dùng AI proctoring.

---

## 2. Luồng thực thi (100% frontend)

### 2.1. Khởi tạo (khi `enabled === true`)

1. **TensorFlow.js:** `import('@tensorflow/tfjs')` — khởi tạo backend (ưu tiên WebGL, fallback CPU).
2. **COCO-SSD:** `import('@tensorflow-models/coco-ssd')` rồi `coco.load()` — tải model (mặc định **lite_mobilenet_v2**, nhẹ nhất).
3. **Camera:** `getUserMedia({ video: 640x480, facingMode: 'user' })` — một stream riêng cho AI (không dùng chung stream với ProctoringEvidenceCapture).
4. **Video ẩn:** Một thẻ `<video>` 1x1 px, opacity 0, dùng làm input cho model.

Nếu tải model hoặc bật camera lỗi → toast báo lỗi, component không crash; luồng thi vẫn chạy.

### 2.2. Chu kỳ “burst” (giảm tải cho máy)

| Tham số | Mặc định | Ý nghĩa |
|--------|----------|--------|
| `burstEveryMs` | 60_000 | Cứ 60 giây mới chạy một đợt detect. |
| `burstDurationMs` | 5_000 | Mỗi đợt chỉ chạy 5 giây. |
| `detectIntervalMs` | 1_000 | Trong 5 giây đó, mỗi 1 giây gọi `model.detect(video)` **một lần**. |

Tức là: **trong 60 giây chỉ có 5 lần inference** (giây 0, 1, 2, 3, 4 của burst), rồi nghỉ 55 giây. Đây là cách “thực thi trên frontend” nhưng hạn chế tải CPU/GPU.

### 2.3. Một lần detect

```ts
const preds = await model.detect(video);
```

- Input: frame hiện tại của `<video>` (640×480).
- Output: mảng `{ class, score, bbox }[]` — 80 lớp COCO, chỉ dùng vài lớp:

| COCO class   | Hành động trong app              | Loại vi phạm |
|-------------|-----------------------------------|-------------|
| `cell phone`| Ghi vi phạm + chụp evidence      | `ai_cell_phone` |
| `book`      | Ghi vi phạm + chụp evidence      | `ai_prohibited_object` |
| `laptop`    | Ghi vi phạm + chụp evidence      | `ai_prohibited_object` |
| `person`    | Đếm số người                     | — |

Sau khi có `preds`:

- **Điện thoại / sách / laptop:** confidence ≥ `minScore` (mặc định 0.6) → gọi `maybeHit('ai_cell_phone' | 'ai_prohibited_object')`.
- **Person:** đếm `personCount`; nếu = 0 → `maybeHit('ai_no_face')`; nếu > 1 → `maybeHit('ai_multiple_face')`.

**Lưu ý:** COCO-SSD nhận diện **object** (điện thoại, sách, laptop, người), **không** nhận diện “khuôn mặt” riêng. “Không mặt” / “nhiều mặt” thực chất là **không có person / nhiều hơn 1 person** trong khung hình.

### 2.4. Khi phát hiện vi phạm (`maybeHit`)

- **Cooldown 10s** mỗi loại vi phạm → tránh spam log và upload.
- Gọi `evidenceRef.current.captureAndUpload(kind)` → chụp frame camera (của **ProctoringEvidenceCapture**, stream khác) → upload lên Supabase Storage.
- Gọi `onViolation(kind, evidence)` → `ExamTakePage` ghi `attempt_audit_logs` (event + metadata).
- Nếu `notify === true` thì toast (hiện tại `notify={false}`).

Toàn bộ logic chạy trong trình duyệt; **không có server nào chạy model**.

---

## 3. Thực thi trên frontend — Có sợ máy đời thấp không?

### 3.1. Đúng là chạy 100% trên frontend

- Model và TensorFlow.js tải về browser.
- Inference chạy bằng:
  - **WebGL** (nếu có): dùng GPU, nhanh hơn nhiều.
  - **CPU** (fallback): không cần GPU nhưng chậm, tốn CPU.

Trên **máy đời thấp** (CPU yếu, ít RAM, không WebGL hoặc driver lỗi) có thể gặp:

| Vấn đề | Mô tả |
|--------|--------|
| **Tải model lần đầu** | Lite MobileNet v2 ~ vài MB (thường < 5MB). Mạng chậm hoặc máy yếu có thể load lâu 10–30+ giây. |
| **Inference chậm** | Trên CPU, mỗi lần `detect()` có thể 500ms–2s hoặc hơn. Burst 5 lần trong 5 giây có thể bị “dồn” (lần 2 chạy khi lần 1 chưa xong) → trải nghiệm giật, trang “đơ”. |
| **RAM** | TensorFlow.js + model + 2 stream camera (evidence + AI) có thể cần ~100–200MB+ RAM. Máy 2GB RAM, nhiều tab có thể bị trì trệ hoặc tab crash. |
| **WebGL không khả dụng** | Một số máy/trình duyệt cũ, WebGL bị tắt hoặc lỗi → TF.js fallback CPU → chậm rõ rệt. |
| **Pin / nhiệt** | Chạy inference định kỳ (dù burst) vẫn tốn pin và có thể làm máy nóng trên thiết bị yếu. |

Vì vậy **có thể sợ máy đời thấp không thực hiện được ổn định**: hoặc chậm (lag khi làm bài), hoặc không tải nổi model / bị đơ, hoặc phải tắt AI để thi mới dùng được.

### 3.2. Những gì app đã làm để giảm rủi ro

| Cơ chế | Tác dụng |
|--------|----------|
| **Tắt mặc định** | `VITE_AI_PROCTORING_ENABLED=0` → không ai bị ảnh hưởng trừ khi chủ động bật. |
| **Burst** | 60s mới chạy 5s, mỗi giây 1 lần detect → giảm tải so với detect liên tục. |
| **Lỗi không làm hỏng thi** | `loadModel` / `detectOnce` catch lỗi, toast báo; không throw ra ngoài → thí sinh vẫn làm bài, chỉ mất phần AI giám sát. |
| **Model nhẹ** | COCO-SSD dùng **lite_mobilenet_v2** (default) — nhẹ và nhanh nhất trong các lựa chọn COCO-SSD. |

Chưa có:

- Kiểm tra “máy có đủ khả năng” (WebGL, RAM, thử inference thử) rồi mới bật AI.
- Tự tắt AI sau vài lần inference quá chậm hoặc lỗi.
- Chạy model trên server (backend) rồi frontend chỉ gửi ảnh.

---

## 4. Gợi ý giảm rủi ro cho máy đời thấp

1. **Giữ mặc định tắt**  
   Chỉ bật `VITE_AI_PROCTORING_ENABLED=1` ở phòng thi / môi trường có máy đủ mạnh và đã test.

2. **Detection capability (tùy chọn)**  
   Trước khi bật AI:
   - Gọi `tf.getBackend()` → nếu không phải `webgl` có thể cảnh báo hoặc không bật.
   - Gọi một lần `model.detect(video)` đo thời gian; nếu > 2–3 giây có thể coi là “máy yếu” và không bật burst, hoặc bật với burst thưa hơn (ví dụ 120s / 3s).

3. **Burst “nhẹ” hơn cho máy yếu**  
   Có thể dùng env hoặc config: tăng `burstEveryMs` (ví dụ 120_000), giảm `burstDurationMs` (3_000) và tăng `detectIntervalMs` (2_000) để ít lần inference hơn.

4. **Backend inference (dài hạn)**  
   Nếu cần bắt buộc AI mà vẫn hỗ trợ máy cũ: gửi ảnh từ frontend lên server (Node/Python), chạy COCO-SSD hoặc model tương tự trên server, trả kết quả xuống. Frontend chỉ cần chụp và gửi ảnh theo burst — không chạy TensorFlow.js trên máy thí sinh.

---

## 5. Tóm tắt

| Câu hỏi | Trả lời ngắn |
|--------|---------------|
| AI proctoring chạy ở đâu? | **100% frontend**: TensorFlow.js + COCO-SSD trong browser, không có server chạy model. |
| Phát hiện những gì? | **Object detection** (COCO): `cell phone` → vi phạm điện thoại; `book`, `laptop` → vật cấm; `person` → dùng để suy ra “không mặt” (0 person) hoặc “nhiều người” (>1 person). |
| Máy đời thấp có sợ không? | **Có.** Có thể chậm (load model, inference trên CPU), lag khi làm bài, tốn RAM/pin; một số máy có thể không chạy nổi hoặc phải tắt AI. |
| App đã giảm rủi ro thế nào? | Tắt mặc định; dùng burst (60s / 5s / 1s); model lite; lỗi không làm hỏng bài thi. Chưa có detection capability hay backend inference. |

File này có thể cập nhật khi đổi model, thêm backend, hoặc thêm kiểm tra “máy đủ mạnh” trước khi bật AI.

---

## 6. Tham chiếu theo dòng máy phổ thông (Samsung, Apple, Oppo, Xiaomi)

*Ước lượng năm máy “chạy ổn” AI proctoring (COCO-SSD burst) — dựa trên chipset, RAM, WebGL/trình duyệt. Chỉ mang tính tham khảo.*

### 6.1. Mốc tham chiếu: iPhone 7 Plus

| Thông số | Giá trị |
|----------|--------|
| Ra mắt | **9/2016** |
| Chip | Apple A10 Fusion (4 nhân) |
| RAM | 3 GB |
| Hệ điều hành | Cập nhật cuối **iOS 15** (không lên iOS 16+) |

**Đánh giá với AI proctoring:**

- Safari trên iOS có **WebGL không ổn định** với TensorFlow.js → thường **fallback CPU**.
- A10 + 3GB RAM chạy inference **trên CPU** → mỗi lần detect có thể **1–3+ giây** → burst 5 lần trong 5 giây dễ bị dồn, trang giật/đơ.
- **Kết luận:** iPhone 7 Plus **không nên coi là “chạy tốt”**; có thể bật AI nhưng trải nghiệm dễ lag, chỉ nên dùng khi chấp nhận rủi ro hoặc tắt AI cho máy này.

### 6.2. Ước lượng “chạy tốt” theo hãng và năm

“Chạy tốt” ở đây: load model trong thời gian chấp nhận được (< ~15s), mỗi lần detect ~200–800 ms (tùy WebGL/CPU), không gây đơ rõ rệt khi làm bài.

| Hãng | Khoảng năm máy phổ thông “chạy tốt” | Ghi chú |
|------|-------------------------------------|--------|
| **Apple** | **2018–2019 trở đi** (iPhone XR/XS, iPhone 11 trở lên) | Safari WebGL vẫn có lỗi định kỳ; máy từ A12 (2018) trở lên CPU đủ mạnh để CPU fallback chấp nhận được với burst. iPhone 7/8 (2016–2017) **không** khuyến nghị cho AI bật. |
| **Samsung** | **2019–2020 trở đi** (Galaxy A50/A51, A70/A71, S10 series trở lên) | Chrome Android WebGL ổn; chip Exynos/Snapdragon tầm trung 2019+ (Mali-G72, Adreno 618…) đủ cho burst. Dòng A giá rẻ hơn (A20, A21) có thể chậm hơn. |
| **Xiaomi / Redmi** | **2019–2020 trở đi** (Redmi Note 8 Pro, K30, Mi 10 series; Snapdragon 7xx, 6xx đời mới hoặc Dimensity) | Chrome Android; chip tầm trung 2019+ thường đủ cho COCO-SSD burst. Máy giá rất rẻ (chip yếu, 2GB RAM) vẫn có thể lag. |
| **OPPO** | **2019–2020 trở đi** (Reno series, A series dùng Snapdragon 7xx / Dimensity 800) | Tương tự Xiaomi; Chrome Android, chip tầm trung từ 2019–2020 trở đi thường ổn với burst. |

### 6.3. Tóm tắt theo năm

| Năm ra mắt máy | Kỳ vọng với AI proctoring (burst) |
|----------------|------------------------------------|
| **2016–2017** | **Không khuyến nghị** — iPhone 7/8, máy Android tầm trung cũ: CPU/GPU yếu, WebGL/Safari hạn chế, dễ lag/đơ. |
| **2018** | **Biên giới** — iPhone X/XS/XR (A12) có thể chạy được với CPU; Android tầm trung 2018 tùy model, nhiều máy vẫn chậm. |
| **2019–2020** | **Hợp lý** — Đa số máy phổ thông Samsung A, Xiaomi Redmi, OPPO tầm trung, iPhone 11+: burst chạy ổn nếu mạng và bộ nhớ đủ. |
| **2021 trở đi** | **Tốt** — Chip và trình duyệt đủ mạnh; vẫn nên giữ burst và tắt mặc định nếu nhiều thí sinh dùng máy cũ. |

Lưu ý: cùng năm, **dòng flagship** thường chạy tốt hơn **dòng giá rẻ** (chip yếu, ít RAM). Nếu đối tượng thi chủ yếu dòng rẻ (A series giá thấp, Redmi/Realme entry), nên **mặc định tắt AI** hoặc thêm kiểm tra năng lực máy trước khi bật.
