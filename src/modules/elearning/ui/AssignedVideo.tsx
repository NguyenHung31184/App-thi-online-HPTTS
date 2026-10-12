import { useCallback,useEffect,useRef,useState } from 'react';
import { appendPlayback,playbackInterval,type PlaybackInterval,type PlaybackSample } from '../domain/playback';
import type { AssignedBlock,LearningReceipt } from '../domain/assigned-learning';
import { flushAssignedProgress,useRecordAssignedProgress,watchLearningToken } from '../queries/use-assigned-learning';

interface Props {userId:string;enrollmentId:string;assignmentId:string;block:AssignedBlock;receipt?:LearningReceipt;onReceipt:(receipt:LearningReceipt)=>void}

export function AssignedVideo({userId,enrollmentId,assignmentId,block,receipt,onReceipt}:Props) {
  const video=useRef<HTMLVideoElement>(null);
  const previous=useRef<PlaybackSample|null>(null);
  const pending=useRef<PlaybackInterval[]>([]);
  const inFlight=useRef(false);
  const nextSaveAt=useRef(0);
  const token=useRef('');
  const mounted=useRef(true);
  const done=useRef(receipt?.status==='completed');
  const onReceiptRef=useRef(onReceipt);
  onReceiptRef.current=onReceipt;
  const initialResume=useRef(receipt?.resume_seconds ?? 0);
  const [saveError,setSaveError]=useState('');
  const [mediaError,setMediaError]=useState('');
  const save=useRecordAssignedProgress(userId);
  const saveRef=useRef(save.mutateAsync);
  saveRef.current=save.mutateAsync;
  const context={enrollmentId,assignmentId,blockId:block.id};
  const contextRef=useRef(context);
  contextRef.current=context;
  const duration=block.duration_seconds ?? 0;

  const pump=useCallback(async()=>{
    if (inFlight.current || done.current || Date.now()<nextSaveAt.current || pending.current.length===0) return;
    const range=pending.current.shift()!;
    inFlight.current=true;
    try {
      const current=Math.min(duration,Math.max(0,Math.floor(video.current?.currentTime ?? range.to)));
      const result=await saveRef.current({...contextRef.current,resumeSeconds:current,fromSeconds:range.from,toSeconds:range.to});
      done.current=result.status==='completed';
      if (mounted.current) {setSaveError('');onReceiptRef.current(result);}
      if (done.current) pending.current=[];
    } catch (error) {
      pending.current.unshift(range);
      if (mounted.current) setSaveError(error instanceof Error ? error.message : 'Không lưu được tiến độ.');
    } finally {
      nextSaveAt.current=Date.now()+2000;
      inFlight.current=false;
    }
  },[duration]);

  useEffect(()=>{
    mounted.current=true;
    const stop=watchLearningToken((value)=>{token.current=value;});
    const timer=window.setInterval(()=>void pump(),2000);
    const flush=()=>{
      previous.current=null;
      if (done.current || inFlight.current || !pending.current[0]) return;
      const range=pending.current[0];
      flushAssignedProgress(token.current,{...contextRef.current,
        resumeSeconds:Math.min(duration,Math.floor(video.current?.currentTime ?? range.to)),fromSeconds:range.from,toSeconds:range.to});
    };
    const visibility=()=>{previous.current=null;if(document.visibilityState==='hidden') flush();};
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{
      mounted.current=false;stop();window.clearInterval(timer);
      window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);
      flush();
    };
  },[duration,pump]);

  const sample=()=>{
    const v=video.current;
    if (!v || done.current || duration<=0) return;
    const current:PlaybackSample={position:Math.min(duration,v.currentTime),wallTime:performance.now(),
      playing:!v.paused&&!v.ended,visible:document.visibilityState==='visible',seeking:v.seeking,rate:v.playbackRate};
    const interval=playbackInterval(previous.current,current);
    if (interval) pending.current=appendPlayback(pending.current,interval);
    previous.current=current;
  };
  const resetAnchor=()=>{previous.current=null;};
  const url=block.content_url ?? '';
  const drive=/drive\.google\.com\/file\/d\/([\w-]+)/i.exec(url);
  const src=block.storage_provider==='drive' && drive ? `https://drive.google.com/uc?export=download&id=${drive[1]}` : url;

  return <div>
    {duration<=0 ? <p role="alert" className="text-red-700">Video chưa được cấu hình thời lượng. Liên hệ giảng viên để có thể ghi nhận tiến độ.</p>
      : <video ref={video} src={src} controls className="w-full rounded-2xl border border-slate-200 bg-black max-h-[70vh]"
        onTimeUpdate={sample} onPlay={sample} onSeeking={resetAnchor} onSeeked={sample} onRateChange={resetAnchor}
        onPause={()=>{resetAnchor();void pump();}} onEnded={()=>{resetAnchor();void pump();}}
        onLoadedMetadata={()=>{if(video.current && initialResume.current>0) video.current.currentTime=Math.min(initialResume.current,duration,video.current.duration);}}
        onError={()=>setMediaError('Không phát được video để ghi nhận thời gian xem. Liên hệ giảng viên để kiểm tra đường dẫn video.')} />}
    {mediaError && <p role="alert" className="mt-2 text-red-700">{mediaError}</p>}
    {saveError && <p role="alert" className="mt-2 text-red-700">Chưa lưu được tiến độ: {saveError}. Hệ thống sẽ thử lại khi còn mở bài.</p>}
    <p className="mt-2 text-xs text-slate-500">Thời gian phát thực tế được ghi nhận. Tua video không được tính là đã xem; hoàn thành do máy chủ xác nhận.</p>
  </div>;
}
