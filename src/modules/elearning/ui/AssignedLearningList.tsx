import { Link } from 'react-router-dom';
import { useAssignedLearning } from '../queries/use-assigned-learning';
import { assignedLessonUrl } from '../domain/assigned-learning';

export function AssignedLearningList({userId}:{userId:string}) {
  const catalog=useAssignedLearning(userId);
  return <section className="mb-6" aria-labelledby="assigned-lessons-title">
    <h3 id="assigned-lessons-title" className="text-lg font-semibold text-slate-800 mb-3">Bài học được giao theo lớp</h3>
    {catalog.isPending && <p role="status" className="text-slate-500">Đang tải bài được giao...</p>}
    {catalog.error && <div role="alert" className="text-red-700 mb-3">
      <p>Không tải được bài được giao: {catalog.error.message}</p>
      <button type="button" onClick={()=>void catalog.refetch()} className="mt-2 underline">Tải lại</button>
    </div>}
    {catalog.data && catalog.data.every((group)=>group.lessons.length===0) && <p className="text-slate-500">Chưa có bài học được giao theo phiên bản.</p>}
    {catalog.data?.filter((group)=>group.lessons.length>0).map(({enrollment,lessons,progress})=><section key={enrollment.id} className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
      <h4 className="font-semibold text-slate-700 mb-3">{enrollment.className}</h4>
      <ol className="space-y-2">{lessons.map((lesson)=>{
        const done=lesson.blocks.filter((block)=>progress.some((p)=>p.assignment_id===lesson.assignment_id&&p.block_id===block.id&&p.status==='completed')).length;
        const content=<><span className="block font-medium">{lesson.title}</span>
          <span className="block text-xs text-slate-500">Phiên bản {lesson.version} · {lesson.can_open ? `${done}/${lesson.blocks.length} mục hoàn thành` : 'Chưa mở: kiểm tra thời hạn và bài cần hoàn thành trước'}
            {lesson.due_at && ` · Hạn học: ${new Date(lesson.due_at).toLocaleString('vi-VN')}`}</span></>;
        return <li key={lesson.assignment_id}>{lesson.can_open
          ? <Link to={assignedLessonUrl(enrollment.id,lesson)} className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">{content}</Link>
          : <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-500" aria-disabled="true">{content}</div>}</li>;
      })}</ol>
    </section>)}
  </section>;
}
