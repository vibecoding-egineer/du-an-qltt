import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceapi from "@vladmandic/face-api";
import { X, Camera, ScanFace, CheckCircle2, RefreshCw } from "lucide-react";

const ATTENDANCE_COOLDOWN = 5000;
const FACE_MATCH_THRESHOLD = 0.6;


interface FaceScannerModalProps {
  onClose: () => void;
  students: any[];
  mode: 'register' | 'attendance';
  studentIdToRegister?: number;
  studentNameToRegister?: string;
  onFaceRegistered?: (descriptor: any) => void;
  onAttendanceMarked?: (studentId: number) => void;
}

export function FaceScannerModal({
  onClose,
  students,
  mode,
  studentNameToRegister,
  onFaceRegistered,
  onAttendanceMarked
}: FaceScannerModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(mode === 'attendance');
  const [message, setMessage] = useState("Đang tải dữ liệu mô hình AI nhận diện...");
  const [lastMarkedStudent, setLastMarkedStudent] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const markedCooldownRef = useRef<Record<number, number>>({});

  // Audio feedback chime on success
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioRef.current || audioRef.current.state === "closed") {
        audioRef.current = new AudioCtx();
      }
      const ctx = audioRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Autoplay policy fallback
    }
  }, []);

  // Cleanup AudioContext to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioRef.current && audioRef.current.state !== "closed") {
        audioRef.current.close().catch(console.error);
      }
    };
  }, []);

  // 1. Load Face-API models safely (SSD Mobilenet v1 is installed in /public/models)
// 1. Load Face-API models directly from Official CDN
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        // Khởi tạo backend cho TensorFlow.js thuần bằng CPU theo yêu cầu
        // @ts-ignore - Bỏ qua lỗi TypeScript vì thư viện thiếu định nghĩa type cho tf.setBackend
        await faceapi.tf.setBackend('cpu');
        // @ts-ignore
        await faceapi.tf.ready();

        // SỬ DỤNG ĐƯỜNG DẪN CDN CHÍNH THỨC
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), 
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        if (isMounted) {
          setModelsLoaded(true);
          setMessage("Mô hình AI đã sẵn sàng. Vui lòng nhìn trực diện vào camera.");
        }
      } catch (e) {
        console.error("Lỗi khi tải mô hình face-api từ CDN:", e);
        if (isMounted) {
          setMessage("Lỗi kết nối tải dữ liệu AI. Vui lòng thử lại.");
        }
      }
    };
    loadModels();
    
    return () => { isMounted = false; };
  }, []);
  // 2. Prepare FaceMatcher in attendance mode with robust descriptor parsing
  const faceMatcher = useMemo(() => {
    if (mode !== "attendance" || !modelsLoaded || students.length === 0) {
      return null;
    }

    const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];

    for (const student of students) {
      if (!student.faceDescriptor) continue;

      try {
        let raw = student.faceDescriptor;
        while (typeof raw === "string") {
          raw = JSON.parse(raw);
        }

        const values = Array.isArray(raw)
          ? raw.map(Number)
          : Object.values(raw).map(Number);

        if (values.length !== 128 || values.some(isNaN)) {
          continue;
        }

        labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(
            String(student.id),
            [new Float32Array(values)]
          )
        );
      } catch (err) {
        console.warn("Face descriptor parse error for student:", student.name, err);
      }
    }

    if (!labeledDescriptors.length) return null;

    return new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD);
  }, [students, modelsLoaded, mode]);

  // Update helper message if matcher status changes
  useEffect(() => {
    if (mode === 'attendance' && modelsLoaded) {
      if (faceMatcher) {
        setMessage("Sẵn sàng tự động nhận diện. Giữ khuôn mặt ổn định trước camera.");
      } else {
        setMessage("Lớp học này chưa có học viên nào đăng ký khuôn mặt AI.");
      }
    }
  }, [mode, modelsLoaded, faceMatcher]);

  const isFaceGoodEnough = (detection: any) => {
    if (!detection) return false;
    const box = detection.detection ? detection.detection.box : detection.box;
    if (!box) return false;

    // Minimum size check
    if (box.width < 50 || box.height < 50 || isNaN(box.x) || isNaN(box.y)) return false;

    const score = detection.detection ? detection.detection.score : 1;
    if (score < 0.5) return false;

    return true;
  };

  // Helper to clear overlay canvas
  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Draw overlay for single face registration
  const drawRegistrationDetection = (video: HTMLVideoElement, detection: any, label: string) => {
    if (!canvasRef.current || !video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const box = detection.detection ? detection.detection.box : detection.box;
    if (box && typeof box.x === 'number' && typeof box.y === 'number' && !isNaN(box.x)) {
      // FIX ERROR 4: Manual coordinate flipping
      // Calculate the mirrored X coordinate for the box's left edge
      const mirroredX = canvas.width - box.width - box.x;

      ctx.strokeStyle = "rgba(34, 197, 94, 1)"; // Green
      ctx.lineWidth = 3;
      ctx.strokeRect(mirroredX, box.y, box.width, box.height); // Use flipped X

      // FIX ERROR 4: Remove nested scale, draw label at correct flipped center
      const labelX = mirroredX + box.width / 2;
      const labelY = box.y - 8;

      ctx.fillStyle = "rgba(34, 197, 94, 1)";
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, labelX, labelY); // Draw directly
    }
  };

  // Draw overlay for multi-face attendance
  const drawAttendanceDetections = (video: HTMLVideoElement, detections: any[]) => {
    if (!canvasRef.current || !video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let newlyMarkedName: string | null = null;

    detections.forEach(detection => {
      const box = detection.detection ? detection.detection.box : detection.box;
      if (!box || box.width < 50 || box.height < 50 || isNaN(box.x)) {
        return;
      }

      const bestMatch = faceMatcher ? faceMatcher.findBestMatch(detection.descriptor) : null;
      let labelText = "Không xác định";
      let boxColor = "rgba(239, 68, 68, 1)"; // Red

      if (bestMatch && bestMatch.label !== 'unknown') {
        const studentId = parseInt(bestMatch.label);
        const student = students.find(s => s.id === studentId);
        if (student) {
          labelText = student.name;
          boxColor = "rgba(34, 197, 94, 1)"; // Green

          const now = Date.now();
          const lastMarked = markedCooldownRef.current[studentId] || 0;
          if (now - lastMarked > ATTENDANCE_COOLDOWN) {
            markedCooldownRef.current[studentId] = now;
            newlyMarkedName = student.name;
            if (onAttendanceMarked) {
              onAttendanceMarked(studentId);
            }
          }
        }
      }

      // FIX ERROR 4: Manual coordinate flipping
      // Calculate the mirrored X coordinate for the box's left edge
      const mirroredX = canvas.width - box.width - box.x;

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(mirroredX, box.y, box.width, box.height); // Use flipped X

      // FIX ERROR 4: Remove nested scale, draw label at correct flipped center
      const labelX = mirroredX + box.width / 2;
      const labelY = box.y - 8;

      ctx.fillStyle = boxColor;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labelText, labelX, labelY); // Draw directly
    });

    if (newlyMarkedName) {
      playSuccessChime();
      setMessage(`✓ Điểm danh thành công: ${newlyMarkedName}`);
      setLastMarkedStudent(newlyMarkedName);
    }
  };

  // Main scan execution
// Main scan execution
  const processFrame = useCallback(async () => {
    console.log("=== BẮT ĐẦU QUÉT ===");
    
    if (!webcamRef.current) return console.log("Lỗi: Không tìm thấy webcamRef");
    if (!webcamRef.current.video) return console.log("Lỗi: Không tìm thấy thẻ video");
    if (!modelsLoaded) return console.log("Lỗi: Models chưa tải xong");
    if (isProcessingRef.current) return console.log("Lỗi: Đang bận xử lý frame trước đó (isProcessing = true)");

    const video = webcamRef.current.video;
    console.log("Trạng thái video readyState:", video.readyState);
    console.log("Kích thước video:", video.videoWidth, "x", video.videoHeight);

    if (
      video.readyState < 3 ||
      !video.videoWidth ||
      !video.videoHeight ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      console.log("Lỗi: Bị chặn lại do Video chưa sẵn sàng (chưa có hình ảnh thực tế)");
      return;
    }

    isProcessingRef.current = true;
    setScanning(true);

try {
      video.width = video.videoWidth;
      video.height = video.videoHeight;

      const detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      console.log("Bắt đầu đưa frame vào AI detect...");

      // --- 1. TẠO CANVAS TRUNG GIAN ĐỂ ÉP KIỂU PIXEL CHUẨN ---
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      }
      // -------------------------------------------------------

      if (mode === 'register') {
        setMessage("Đang quét cấu trúc khuôn mặt...");
        
        // --- 2. TRUYỀN tempCanvas VÀO THAY VÌ video ---
        const detection = await faceapi
          .detectSingleFace(tempCanvas, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();

        console.log("Kết quả từ AI:", detection ? "TÌM THẤY MẶT" : "KHÔNG TÌM THẤY");

        if (detection) {
          if (!isFaceGoodEnough(detection)) {
            setMessage("Đưa khuôn mặt lại gần camera hơn.");
            clearCanvas();
            return;
          }

          drawRegistrationDetection(
            video,
            detection,
            studentNameToRegister || "Khuôn mặt hợp lệ"
          );

          playSuccessChime();

          setMessage(`✓ Nhận diện thành công cho ${studentNameToRegister || "học viên"}!`);

          if (onFaceRegistered) {
            onFaceRegistered(Array.from(detection.descriptor));
          }
        } else {
          setMessage("Không phát hiện khuôn mặt rõ ràng. Hãy nhìn thẳng vào camera và thử lại.");
          clearCanvas();
        }
      } else if (mode === 'attendance') {
        if (!faceMatcher) {
          setMessage("Lớp học chưa có dữ liệu khuôn mặt học viên.");
          clearCanvas();
          return;
        }

        // --- 3. TRUYỀN tempCanvas VÀO THAY VÌ video ---
        const detections = await faceapi
          .detectAllFaces(tempCanvas, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptors();

        const validDetections = detections.filter((d: any) => {
          const box = d.detection ? d.detection.box : d.box;
          return box && typeof box.width === 'number' && typeof box.height === 'number' && !isNaN(box.width) && !isNaN(box.height);
        });

        const sortedDetections = validDetections.sort((a: any, b: any) => {
          const boxA = a.detection ? a.detection.box : a.box;
          const boxB = b.detection ? b.detection.box : b.box;
          const areaA = boxA.width * boxA.height;
          const areaB = boxB.width * boxB.height;
          return areaB - areaA;
        });

        if (sortedDetections.length === 0) {
          setMessage("Đang chờ khuôn mặt xuất hiện trước camera...");
          clearCanvas();
        } else {
          drawAttendanceDetections(video, sortedDetections);
        }
      }
    } catch (e) {
      console.error("Lỗi trong quá trình AI quét khuôn mặt:", e);
      setMessage("Có lỗi phát sinh trong quá trình nhận diện.");
    } finally {
      isProcessingRef.current = false;
      setScanning(false);
    }
  }, [modelsLoaded, mode, faceMatcher, studentNameToRegister, onFaceRegistered, playSuccessChime]);

  // Auto-scan recursive timer loop (prevents concurrent frame congestion)
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const runLoop = async () => {
      if (isCancelled) return;
      if (autoScan && modelsLoaded && mode === 'attendance' && faceMatcher) {
        await processFrame();
      }
      if (!isCancelled && autoScan && mode === 'attendance') {
        timerId = setTimeout(runLoop, 400);
      }
    };

    if (autoScan && modelsLoaded && mode === 'attendance' && faceMatcher) {
      runLoop();
    }

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [autoScan, modelsLoaded, mode, faceMatcher, processFrame]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
          title="Đóng"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <ScanFace className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {mode === 'register' ? `Đăng ký khuôn mặt AI ${studentNameToRegister ? `- ${studentNameToRegister}` : ''}` : 'Điểm danh Camera AI tự động'}
          </h3>
          <p className="mt-1 text-sm text-slate-600 font-medium min-h-[20px]">
            {message}
          </p>
          {lastMarkedStudent && mode === 'attendance' && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full ring-1 ring-green-600/20 animate-pulse">
              <CheckCircle2 className="h-3.5 w-3.5" /> vừa điểm danh {lastMarkedStudent}
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-[4/3] flex items-center justify-center mb-5 ring-4 ring-slate-100">
          {/* @ts-ignore */}
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            mirrored={true}
            videoConstraints={{
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 }
            }}
            className="h-full w-full object-cover"
          />
          <canvas
            ref={canvasRef}
            // FIX ERROR 4: Remove scale-x-[-1]
            className="absolute inset-0 pointer-events-none w-full h-full object-cover"
          />
          
          {/* Target Focus Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="w-48 h-48 sm:w-60 sm:h-60 relative">
                <div className="absolute inset-0 border border-white/20 rounded-2xl overflow-hidden">
                   {(autoScan || scanning) && (
                     <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-transparent to-blue-500/40 animate-scanner">
                       <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-400 shadow-[0_1px_15px_3px_rgba(59,130,246,1)]"></div>
                     </div>
                   )}
                </div>
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
             </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {mode === 'attendance' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScan}
                onChange={(e) => setAutoScan(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Tự động quét liên tục
            </label>
          ) : <div />}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={processFrame}
              disabled={!modelsLoaded || scanning}
              className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all w-full sm:w-auto"
            >
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {scanning ? 'Đang nhận diện...' : (mode === 'register' ? 'Chụp & Đăng ký' : 'Quét ngay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}