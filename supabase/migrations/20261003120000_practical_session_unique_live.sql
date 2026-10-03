-- One live field-grading session per class, template and mode. A soft-deleted session no longer blocks a new one.
ALTER TABLE public.practical_exam_sessions DROP CONSTRAINT IF EXISTS practical_exam_sessions_class_template_mode_unique;
CREATE UNIQUE INDEX practical_exam_sessions_class_template_mode_unique
  ON public.practical_exam_sessions (class_id, template_id, mode)
  WHERE is_deleted = false;
