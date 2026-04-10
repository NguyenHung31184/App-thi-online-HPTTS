# Điểm rollback (checkpoint trước khi push GitHub)

| Trường | Giá trị |
|--------|---------|
| **Thời điểm ghi nhận** | **2:09 SA (sáng), 11.04.2026** |
| **Mục đích** | Đánh dấu trạng thái code trước khi đẩy lên GitHub — dễ quay lại bằng tag Git hoặc commit tương ứng. |

## Cách quay lại trạng thái này

```bash
# Xem tag
git tag -l "checkpoint-*"

# Checkout theo tag (detached HEAD — chỉ để xem / tạo nhánh)
git checkout checkpoint-20260411-0209-pre-push

# Hoặc tạo nhánh từ tag
git checkout -b fix/tu-tag-rollback checkpoint-20260411-0209-pre-push
```

## Tag Git tương ứng

Sau khi commit mọi thay đổi cần push, tạo tag **trên commit đó** (nếu chưa tạo):

```bash
git tag -a checkpoint-20260411-0209-pre-push -m "Rollback: 2:09 SA 11.04.2026 — trước push GitHub"
git push origin checkpoint-20260411-0209-pre-push
```

> **Lưu ý:** Tag phải trỏ đúng commit bạn muốn giữ. Nếu đã tạo tag trước khi commit, xóa tag và tạo lại:  
> `git tag -d checkpoint-20260411-0209-pre-push` rồi `git tag -a ...` sau commit cuối.
