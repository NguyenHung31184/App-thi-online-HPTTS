# Rollback: TTDT resend and "Dọn lỗi cũ" removal

## Step 1 (button removal)

`git revert --no-edit <step 1 hash>` then the usual checks and push. The button comes back as it was (it deletes
nothing, see the implementation doc).

## Step 2 (resend)

The 66 enrollments had no `grade_details` row before the resend (snapshot in
`D:\Data\App-thi-online-HPTTS-bao-cao\2026-10-02-grade_details-truoc-khi-gui-lai.json`). To undo, an operator-approved
SQL on the TTDT side removes or clears the rows created for exactly those `(enrollment_id, module_id)` pairs, dry-run
first in a rolling-back `DO` block. In the exam app, `synced_to_ttdt_at` on those attempts can be set back to null and
their `exam_sync_jobs` rows left as history.
