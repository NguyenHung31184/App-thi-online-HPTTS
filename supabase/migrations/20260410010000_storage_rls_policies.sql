-- Storage RLS Policies cho bucket exam-uploads.
-- Vì bucket đang là PUBLIC (getPublicUrl không cần auth), policy SELECT không có tác dụng
-- trên public bucket — nhưng vẫn khai báo để rõ ý định khi chuyển sang private sau này.
-- Policy quan trọng nhất ở đây là INSERT / UPDATE / DELETE (giới hạn ai được upload/xóa).
--
-- Cấu trúc path trong bucket exam-uploads:
--   questions/{examId}/...           ← ảnh câu hỏi đề thi      (admin/teacher upload)
--   question-bank/{occupationId}/... ← ảnh câu hỏi ngân hàng   (admin/teacher upload)
--   exam-snapshots/{examId}.json     ← snapshot đề thi          (admin/teacher upload)
--   proctoring/{attemptId}/...       ← ảnh giám sát thi         (Edge Function / service_role)
--   cccd/{attemptId}/...             ← ảnh CCCD                 (Edge Function / service_role)
--
-- QUAN TRỌNG: Các policy này chỉ có hiệu lực khi Supabase Storage đã bật RLS
-- (Dashboard → Storage → Policies → Enable RLS).
-- Nếu bucket PUBLIC, policy SELECT bị bỏ qua; khi chuyển sang PRIVATE thì có tác dụng.

-- =============================================================================
-- SECTION 1: Ảnh câu hỏi (questions/, question-bank/, exam-snapshots/)
-- =============================================================================

-- SELECT: Ai cũng đọc được (câu hỏi cần hiển thị cho thí sinh trong lúc thi)
-- Trên public bucket: policy này không có tác dụng nhưng khai báo rõ ý định
CREATE POLICY "question-images select public" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'exam-uploads'
    AND (
      name LIKE 'questions/%'
      OR name LIKE 'question-bank/%'
      OR name LIKE 'exam-snapshots/%'
    )
  );

-- INSERT: Chỉ admin/teacher mới được upload ảnh câu hỏi mới
CREATE POLICY "question-images insert admin-teacher" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam-uploads'
    AND (
      name LIKE 'questions/%'
      OR name LIKE 'question-bank/%'
      OR name LIKE 'exam-snapshots/%'
    )
    AND get_my_role() IN ('admin', 'teacher')
  );

-- UPDATE: Chỉ admin/teacher mới được ghi đè ảnh câu hỏi
CREATE POLICY "question-images update admin-teacher" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exam-uploads'
    AND (
      name LIKE 'questions/%'
      OR name LIKE 'question-bank/%'
      OR name LIKE 'exam-snapshots/%'
    )
    AND get_my_role() IN ('admin', 'teacher')
  )
  WITH CHECK (get_my_role() IN ('admin', 'teacher'));

-- DELETE: Chỉ admin mới được xóa ảnh câu hỏi (teacher không xóa được)
CREATE POLICY "question-images delete admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exam-uploads'
    AND (
      name LIKE 'questions/%'
      OR name LIKE 'question-bank/%'
      OR name LIKE 'exam-snapshots/%'
    )
    AND get_my_role() = 'admin'
  );

-- =============================================================================
-- SECTION 2: Ảnh giám sát và CCCD (proctoring/, cccd/)
-- Edge Function dùng service_role key → tự động bypass RLS khi upload.
-- Policy này giới hạn ai được ĐỌC ảnh nhạy cảm từ client.
-- =============================================================================

-- SELECT: Chỉ admin/teacher mới được xem ảnh proctoring/CCCD qua client
-- (service_role bypass RLS, nên Edge Function vẫn đọc/ghi được)
CREATE POLICY "evidence-images select admin-teacher" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-uploads'
    AND (
      name LIKE 'proctoring/%'
      OR name LIKE 'cccd/%'
    )
    AND get_my_role() IN ('admin', 'teacher')
  );

-- INSERT/UPDATE/DELETE cho evidence: chỉ service_role (Edge Function) được phép.
-- Không tạo policy client-side → mặc định bị chặn nếu không phải service_role.
-- (service_role bypass RLS hoàn toàn, nên Edge Function vẫn hoạt động)

-- =============================================================================
-- SECTION 3: Ghi chú kỹ thuật
-- =============================================================================
-- Để chuyển sang mô hình an toàn hoàn toàn:
-- 1. Đổi bucket exam-uploads từ PUBLIC → PRIVATE trên Dashboard
-- 2. Ảnh câu hỏi (questions/, question-bank/): dùng signed URL hoặc transform URL
--    Hoặc: tách sang bucket exam-questions riêng (public)
-- 3. Evidence (proctoring/, cccd/): giữ private, Edge Function trả signed URL ngắn hạn
--    (đã làm: examUploadService.ts nhận signedUrl từ Edge Function)
--
-- Tham khảo: https://supabase.com/docs/guides/storage/security/access-control

COMMENT ON TABLE storage.objects IS
  'exam-uploads bucket: questions/ question-bank/ exam-snapshots/ (public read, admin/teacher write) | proctoring/ cccd/ (admin/teacher read only, Edge writes)';
