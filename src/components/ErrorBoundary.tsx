import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
  message: string;
}

function isChunkLoadFailure(error: Error): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("chunkloaderror")
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    isChunkError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      isChunkError: isChunkLoadFailure(error),
      message: error?.message || "เกิดข้อผิดพลาดในการแสดงผลหน้าเว็บ",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Uncaught application error:", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="error-boundary-shell" role="alert">
        <div className="error-boundary-card">
          <div className="error-boundary-badge">
            {this.state.isChunkError ? "ตรวจพบเวอร์ชันใหม่ของระบบ" : "ระบบขัดข้องชั่วคราว"}
          </div>
          <h1>
            {this.state.isChunkError
              ? "ระบบมีการอัปเดตเวอร์ชันใหม่"
              : "ไม่สามารถแสดงผลหน้านี้ได้ชั่วคราว"}
          </h1>
          <p>
            {this.state.isChunkError
              ? "ไฟล์บางส่วนบนเบราว์เซอร์เป็นเวอร์ชันเก่า กดปุ่มโหลดหน้าเว็บใหม่เพื่อรับเวอร์ชันล่าสุดครับ"
              : "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณากดโหลดหน้าเว็บใหม่หรือกลับสู่หน้าหลัก"}
          </p>
          {this.state.message && (
            <pre className="error-boundary-detail">{this.state.message}</pre>
          )}
          <div className="error-boundary-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => window.location.reload()}
            >
              โหลดหน้าเว็บใหม่
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => window.location.assign("/")}
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }
}
