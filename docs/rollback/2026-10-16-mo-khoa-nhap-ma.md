# Rollback: giám thị mở khóa học viên nhập sai mã truy cập

## Chỉ lùi code

`git revert <hash commit>` và push. Khối "học viên đang nhập sai mã truy cập" mất khỏi màn Giám sát trực tiếp; câu
báo lỗi vào thi trở lại thành mã lỗi máy chủ. Không mất dữ liệu.

## Lùi database

Hai hàm và một bảng mới, không sửa hàm cũ. Khóa sau 5 lần sai vẫn chạy như trước.

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.unlock_exam_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_exam_access_failures();
DROP TABLE IF EXISTS public.exam_access_unlocks;
COMMIT;
```

Mở khóa tay khi chưa có nút (chạy bằng công cụ quản trị, ghi lại ai và lúc nào):

```sql
DELETE FROM public.exam_access_failures WHERE window_id = '<id kỳ thi>' AND user_id = '<id tài khoản thi>';
```

Migration của repo này áp bằng CLI từ repo app quản lý (xem ghi chú áp production ở `docs/GHI_CHU.md` repo app quản lý).
