// app/page.tsx
"use client";

import React, { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
export default function EvaluationDashboard() {
  const [inputText, setInputText] = useState(
      "Hóa đơn HD-7788 ngày 21/09/2026 từ KAY KAFÉ. Mua 2 Bánh Ngói Nhân Nhân giá 25000. Tổng cộng thanh toán 50000 VND."
  );
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [evalSaved, setEvalSaved] = useState(false);

  // 1. Gửi request trích xuất thông tin
  const handleExtract = async () => {
    setLoading(true);
    setAiResult(null);
    setEvalSaved(false);

    try {
      const res = await fetch(`${API_BASE_URL}/ai/extract-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      setAiResult(data);
    } catch (error) {
      alert("Lỗi kết nối tới NestJS API: " + error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Gửi phản hồi đánh giá chất lượng (HITL)
  const handleFeedback = async (isAccurate: boolean) => {
    if (!aiResult) return;

    try {
      const res = await fetch(`${API_BASE_URL}/ai/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalInput: inputText,
          aiOutput: aiResult,
          isAccurate,
          rating,
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEvalSaved(true);
      }
    } catch (error) {
      alert("Lỗi khi gửi đánh giá: " + error);
    }
  };

  return (
      <main className="min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="border-b border-slate-700 pb-4">
            <h1 className="text-2xl font-bold text-sky-400">
              Hệ thống Đánh giá & Giám sát AI (HITL Dashboard)
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Kiểm tra kết quả trích xuất hóa đơn và gắn nhãn chất lượng mô hình.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cột trái: Nhập liệu */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  Văn bản hóa đơn gốc:
                </label>
                <textarea
                    rows={7}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full p-3 rounded bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Nhập thông tin hóa đơn cần trích xuất..."
                />
              </div>
              <button
                  onClick={handleExtract}
                  disabled={loading}
                  className="mt-4 w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 font-medium rounded transition"
              >
                {loading ? "Đang xử lý qua AI..." : "Trích xuất thông tin"}
              </button>
            </div>

            {/* Cột phải: Kết quả AI */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-medium mb-2 text-slate-300">
                  Kết quả trích xuất JSON (Structured Output):
                </h2>
                <div className="bg-slate-900 border border-slate-700 rounded p-3 h-48 overflow-auto font-mono text-xs text-emerald-400">
                  {aiResult ? (
                      <pre>{JSON.stringify(aiResult, null, 2)}</pre>
                  ) : (
                      <span className="text-slate-500 italic">
                    Chưa có dữ liệu. Hãy bấm trích xuất...
                  </span>
                  )}
                </div>
              </div>

              {/* Khu vực đánh giá chất lượng (Human-in-the-loop) */}
              {aiResult && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Đánh giá chất lượng:</span>
                      <div className="flex items-center gap-1">
                        <span>Điểm:</span>
                        <select
                            value={rating}
                            onChange={(e) => setRating(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5"
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                              <option key={n} value={n}>
                                {n} sao
                              </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ghi chú thêm nếu AI trích xuất sai..."
                        className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />

                    <div className="flex gap-2">
                      <button
                          onClick={() => handleFeedback(true)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded transition"
                      >
                        ✓ Chính xác (Thumbs Up)
                      </button>
                      <button
                          onClick={() => handleFeedback(false)}
                          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-medium rounded transition"
                      >
                        ✗ Có lỗi (Thumbs Down)
                      </button>
                    </div>

                    {evalSaved && (
                        <p className="text-xs text-center text-emerald-400 font-semibold mt-1">
                          Đã ghi nhận đánh giá thành công vào hệ thống!
                        </p>
                    )}
                  </div>
              )}
            </div>
          </div>
        </div>
      </main>
  );
}
