-- Cho phép question_bank gắn với nghề đào tạo từ bảng courses (app quản lý TTDT).
-- courses.id là TEXT (vd: kh01, FL-BD); đổi occupation_id sang TEXT và bỏ FK tới occupations.

ALTER TABLE question_bank DROP CONSTRAINT IF EXISTS question_bank_occupation_id_fkey;
ALTER TABLE question_bank ALTER COLUMN occupation_id TYPE TEXT USING occupation_id::TEXT;
