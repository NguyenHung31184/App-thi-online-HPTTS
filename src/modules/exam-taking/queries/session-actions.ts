export {
  getAttempt,
  getTheoryAttemptWindowContext as getAttemptWindowContext,
  getTheoryAiProctoringState as getAiProctoringState,
  getTheoryAttemptQuestions as getQuestionsForAttempt,
  recordTheoryAttemptAuditEvent as logAuditEvent,
  recordTheoryAiProctoringIncident as recordAiProctoringIncident,
  saveTheoryAttemptAnswers as updateAttemptAnswers,
  startTheoryAttempt as startExamAttempt,
  beginTheoryAttemptClock as beginExamClock,
  submitTheoryAttempt as submitAttempt,
  getBrowserProctoringState, recordBrowserViolation, attachBrowserViolationEvidence,
} from '../application/manage-theory-attempt';
export { uploadExamFileViaEdge } from '../application/upload-exam-file';
export { detectFacesInVideo, loadBlazeFaceModel, validateAndBuildStartExamPortrait } from '../application/blaze-face-proctor';
export { detectFacesWithMediaPipe, loadMediaPipeFaceDetector } from '../application/mediapipe-face-proctor';
export { createFaceScanner } from '../application/create-face-scanner';
export {
  forgetObjectDetector, loadObjectDetector, objectDetectionEnabled, preloadProctoring, proctoringWasPreloaded,
  type ObjectDetector,
} from '../application/object-detector';
