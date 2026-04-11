-- Cho phép thí sinh xem metadata ảnh lúc vào thi (chỉ event photo_taken, chỉ attempt của mình).
-- Kèm policy Storage: đọc object proctoring/{user_id}/{attempt_id}/... khi attempt thuộc user.

CREATE POLICY "attempt_audit_logs_student_select_start_photo" ON attempt_audit_logs
  FOR SELECT TO authenticated
  USING (
    event = 'photo_taken'
    AND attempt_id IN (SELECT id FROM attempts WHERE user_id = auth.uid())
  );

CREATE POLICY "proctoring_storage_select_student_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-uploads'
    AND name LIKE ('proctoring/' || auth.uid()::text || '/%')
    AND split_part(name, '/', 3)::uuid IN (SELECT id FROM attempts WHERE user_id = auth.uid())
  );

COMMENT ON POLICY "attempt_audit_logs_student_select_start_photo" ON attempt_audit_logs IS
  'Thí sinh chỉ SELECT được log photo_taken của các attempt của mình — dùng path trong metadata để tạo signed URL hiển thị phiếu kết quả.';
