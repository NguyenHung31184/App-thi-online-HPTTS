// Vite serves this fixture in development; it is not a production entry point.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../src/index.css';
import AppLayout from '../../src/shared/ui/AppLayout';
import ConfirmationModal from '../../src/shared/ui/ConfirmationModal';
import { ViolationAlertModal } from '../../src/modules/exam-taking/ui/proctoring/ViolationAlertModal';
import { CameraRecoveryNotice } from '../../src/modules/exam-taking/ui/proctoring/CameraRecoveryNotice';
import { ProctoringEvidenceCapture } from '../../src/modules/exam-taking/ui/proctoring/ProctoringEvidenceCapture';
import { AiObjectProctorBurst } from '../../src/modules/exam-taking/ui/proctoring/AiObjectProctorBurst';
import { createFaceScanner } from '../../src/modules/exam-taking/application/create-face-scanner';
import type { ProctoringCameraStatus, ProctoringEvidenceCaptureRef } from '../../src/modules/exam-taking/domain/proctoring-evidence';
import type { FaceScanner } from '../../src/modules/exam-taking/domain/face-scanner';

const canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 480;
const context = canvas.getContext('2d')!;
let tick = 0;
window.setInterval(() => {
  context.fillStyle = '#eaf6fd';
  context.fillRect(0, 0, 640, 480);
  context.fillStyle = '#1f4e8a';
  context.fillRect((tick++ * 10) % 500, 80, 120, 160);
}, 100);
let lastStream: MediaStream | null = null;
let acquisitions = 0;
Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: {
    getUserMedia: async () => {
      acquisitions += 1;
      lastStream = canvas.captureStream(10);
      return lastStream;
    },
  },
});

export function Fixture() {
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<'confirm' | 'violation' | 'photo' | null>(null);
  const [camera, setCamera] = useState<ProctoringCameraStatus>('stopped');
  const [enabled, setEnabled] = useState(false);
  const [workerResult, setWorkerResult] = useState('Chưa kiểm thử Worker');
  const [cameraCount, setCameraCount] = useState(0);
  const [result, setResult] = useState('');
  const evidence = useRef<ProctoringEvidenceCaptureRef | null>(null);
  const aiEvidence = useRef<ProctoringEvidenceCaptureRef | null>({
    getVideoElement: () => evidence.current?.getVideoElement() ?? null,
    restartCamera: async () => { await evidence.current?.restartCamera(); },
    captureAndUpload: async () => ({ ok: false, error: 'qa_upload_disabled' }),
    captureSequenceAndUpload: async () => ({ ok: false, error: 'qa_upload_disabled' }),
  });
  const scannerRef = useRef<FaceScanner | null>(null);
  const workerController = useRef<AbortController | null>(null);
  const [runAi, setRunAi] = useState(false);

  useEffect(() => () => {
    workerController.current?.abort();
    scannerRef.current?.close();
  }, []);

  const testWorker = async () => {
    workerController.current?.abort();
    scannerRef.current?.close();
    const controller = new AbortController();
    workerController.current = controller;
    setWorkerResult('Đang khởi tạo Worker…');
    try {
      const scanner = await createFaceScanner(controller.signal);
      scannerRef.current = scanner;
      const video = evidence.current?.getVideoElement();
      if (!video) throw new Error('Bật camera giả trước khi kiểm thử');
      const count = await scanner.detect(video);
      setWorkerResult(`Bộ nhận diện: ${scanner.mode}; số mặt: ${count}`);
      scanner.close();
      scannerRef.current = null;
    } catch (error) {
      setWorkerResult(error instanceof Error ? error.message : 'Worker lỗi');
    }
  };

  return (
    <AppLayout navSections={[]} title="Kiểm thử iOS" userEmail="Dữ liệu giả" userRole="QA local" onLogout={() => setResult('Đã bấm đăng xuất giả')} isSidebarOpen={sidebar} setSidebarOpen={setSidebar}>
      <div className="exam-session mx-auto max-w-3xl space-y-3">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">Kiểm thử local với dữ liệu giả. Không dùng camera thật, không lưu bài thi hoặc gửi minh chứng.</p>
        <div className="flex flex-wrap gap-2">
          {[
            ['Modal xác nhận', () => setModal('confirm')],
            ['Modal cảnh báo', () => setModal('violation')],
            ['Modal chụp ảnh', () => setModal('photo')],
            ['Bật camera giả', () => setEnabled(true)],
            ['Ngắt camera giả', () => { const track = lastStream?.getVideoTracks()[0]; track?.stop(); track?.dispatchEvent(new Event('ended')); }],
            ['Tắt camera giả', () => { setEnabled(false); setRunAi(false); }],
            ['Kiểm thử Worker', () => { void testWorker(); }],
            ['Bật AI với camera chung', () => { setCameraCount(acquisitions); setRunAi(true); }],
            ['Đếm lần mở camera', () => setCameraCount(acquisitions)],
          ].map(([label, action]) => <button key={String(label)} type="button" className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-white" onClick={action as () => void}>{String(label)}</button>)}
        </div>
        <CameraRecoveryNotice status={camera} restart={() => { void evidence.current?.restartCamera(); }} />
        <p role="status">Trạng thái camera: {camera}; số lần mở: {cameraCount}</p>
        <p role="status">{workerResult}</p>
        <p role="status">{result}</p>
        <ProctoringEvidenceCapture ref={evidence} enabled={enabled} attemptId="qa-local" examId="qa-local" studentKey="qa-local" onCameraStatus={setCamera} />
        <AiObjectProctorBurst enabled={enabled && runAi} evidenceRef={aiEvidence} detectObjects={false} onViolation={() => { setRunAi(false); setResult('AI phát hiện tín hiệu trên hình giả; upload bị vô hiệu trong fixture'); }} />
        <ConfirmationModal isOpen={modal === 'confirm'} onClose={() => setModal(null)} onConfirm={() => { setResult('Đã xác nhận giả'); setModal(null); }} title="Xác nhận kiểm thử" confirmText="Xác nhận">
          {Array.from({ length: 12 }, (_, i) => <span className="block" key={i}>Nội dung kiểm thử cuộn modal dòng {i + 1}.</span>)}
        </ConfirmationModal>
        <ViolationAlertModal kind={modal === 'violation' ? 'focus_lost' : null} violationCount={1} maxViolations={5} onClose={() => setModal(null)} />
        {modal === 'photo' && <div className="viewport-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5">
            <h2 className="font-semibold">Chụp ảnh khuôn mặt: bố cục giả</h2>
            <p className="my-3">Khung này kiểm tra cùng lớp CSS của màn chụp ảnh. Không chụp ảnh thật.</p>
            <div className="aspect-video rounded-lg bg-slate-800" />
            {Array.from({ length: 8 }, (_, i) => <p key={i} className="my-3">Hướng dẫn căn khung dòng {i + 1}</p>)}
            <button className="min-h-11 w-full rounded-lg bg-brand-700 p-3 text-white" onClick={() => { setResult('Đã chụp giả'); setModal(null); }}>Chụp ảnh giả</button>
          </div>
        </div>}
      </div>
    </AppLayout>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Fixture /></BrowserRouter>);
