import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mayConfirmRead,type AssignedBlock,type LearningReceipt } from '../domain/assigned-learning';
import { useAssignedLearning,useRecordAssignedProgress } from '../queries/use-assigned-learning';
import { AssignedVideo } from './AssignedVideo';
import { QuizBlock } from './QuizBlock';

interface Props {userId:string;enrollmentId:string;assignmentId:string;lessonId:string}
export function AssignedLessonPlayer({userId,enrollmentId,assignmentId,lessonId}:Props) {
  const catalog=useAssignedLearning(userId);
  const save=useRecordAssignedProgress(userId);
  const [selected,setSelected]=useState<string|null>(null);
  const [localProgress,setLocalProgress]=useState<Record<string,LearningReceipt>>({});
  const [saveError,setSaveError]=useState('');
  const group=catalog.data?.find((item)=>item.enrollment.id===enrollmentId);
  const lesson=group?.lessons.find((item)=>item.assignment_id===assignmentId&&item.lesson_id===lessonId);
  const receiptOf=(blockId:string)=>localProgress[blockId] ?? group?.progress.find((item)=>item.assignment_id===assignmentId&&item.block_id===blockId);
  const firstPending=lesson?.blocks.find((block)=>receiptOf(block.id)?.status!=='completed');
  const active=lesson?.blocks.find((block)=>block.id===selected) ?? firstPending ?? lesson?.blocks[0];
  const confirm=async(block:AssignedBlock)=>{
    if(!mayConfirmRead(block) || save.isPending) return;
    setSaveError('');
    try {
      const receipt=await save.mutateAsync({enrollmentId,assignmentId,blockId:block.id,confirmRead:true});
      setLocalProgress((prev)=>({...prev,[block.id]:receipt}));
      setSelected(block.id);
    } catch(error) {setSaveError(error instanceof Error ? error.message : 'Không ghi nhận được hoàn thành.');}
  };
  const renderContent=(block:AssignedBlock)=>{
    if(block.block_type==='article') return <article className="whitespace-pre-wrap bg-white border border-slate-200 rounded-2xl p-6 text-slate-700">{block.body_richtext}</article>;
    const url=block.content_url ?? '';
    if(block.block_type==='pdf') {
      const drive=/drive\.google\.com\/file\/d\/([\w-]+)/i.exec(url);
      return <iframe title={block.title ?? 'Tài liệu PDF'} src={drive ? `https://drive.google.com/file/d/${drive[1]}/preview` : url} className="w-full h-[70vh] border border-slate-200 rounded-2xl" />;
    }
    if(block.block_type==='video') {
      if(block.storage_provider==='youtube') {
        const match=/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i.exec(url);
        return match ? <iframe title={block.title ?? 'Video bài giảng'} src={`https://www.youtube-nocookie.com/embed/${match[1]}?rel=0`} allowFullScreen className="aspect-video w-full border border-slate-200 rounded-2xl" /> : <p role="alert">Đường dẫn YouTube không hợp lệ.</p>;
      }
      return <AssignedVideo key={`${assignmentId}:${block.id}`} userId={userId} enrollmentId={enrollmentId} assignmentId={assignmentId} block={block}
        receipt={receiptOf(block.id)} onReceipt={(receipt)=>setLocalProgress((prev)=>({...prev,[block.id]:receipt}))} />;
    }
    return <QuizBlock key={`${assignmentId}:${block.id}`} userId={userId} enrollmentId={enrollmentId} assignmentId={assignmentId} block={block}
      attempts={group?.quizAttempts ?? []} onPassed={()=>setLocalProgress((prev)=>({...prev,[block.id]:{id:block.id,status:'completed',resume_seconds:0,source:'server_quiz',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}}))} />;
  };
  if(catalog.isPending) return <p role="status">Đang tải bài được giao...</p>;
  if(catalog.error) return <div role="alert"><p className="text-red-700">{catalog.error.message}</p><button onClick={()=>void catalog.refetch()} className="underline mt-2">Tải lại</button></div>;
  if(!lesson || !lesson.can_open) return <div role="alert"><p>Bài chưa mở, đã hết hạn hoặc không thuộc lớp của bạn.</p><Link to="/student/learn" className="text-indigo-600 underline">Danh sách bài học</Link></div>;
  const done=lesson.blocks.filter((block)=>receiptOf(block.id)?.status==='completed').length;
  return <div className="max-w-6xl mx-auto">
    <Link to="/student/learn" className="text-sm text-indigo-600 underline">← Danh sách bài học</Link>
    <h2 className="text-lg font-bold text-slate-800 mt-2">{lesson.title}</h2>
    <p className="text-xs text-slate-500 mb-4">{group?.enrollment.className} · Phiên bản {lesson.version} · Hoàn thành {done}/{lesson.blocks.length} mục</p>
    <div className="flex flex-col lg:flex-row gap-4">
      <aside className="lg:w-72 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-2 h-fit" aria-label="Nội dung bài học">
        {lesson.blocks.map((block,index)=><button type="button" key={block.id} onClick={()=>{setSelected(block.id);setSaveError('');}}
          aria-current={active?.id===block.id ? 'step' : undefined}
          className={`block w-full text-left rounded-xl px-3 py-3 mb-1 focus-visible:outline-2 focus-visible:outline-indigo-600 ${active?.id===block.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}>
          {receiptOf(block.id)?.status==='completed' ? '✓' : index+1} · {block.title || block.block_type}
        </button>)}
      </aside>
      <main className="flex-1 min-w-0">{active ? <>
        {renderContent(active)}
        {saveError && <p role="alert" className="mt-3 text-red-700">{saveError}</p>}
        {receiptOf(active.id)?.status==='completed' ? <p className="mt-3 text-green-700">✓ Đã hoàn thành</p>
          : mayConfirmRead(active) && <button type="button" disabled={save.isPending} onClick={()=>void confirm(active)} className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-xl disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-600">{save.isPending ? 'Đang lưu...' : 'Đánh dấu đã học xong'}</button>}
      </> : <p>Bài học chưa có nội dung.</p>}</main>
    </div>
  </div>;
}
