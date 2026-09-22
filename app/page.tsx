// app/page.tsx
"use client";

import React, { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-ai-service.kaykafe.com";

export default function EvaluationDashboard() {
  const [activeTab, setActiveTab] = useState<"text" | "image">("image");
  const [inputText, setInputText] = useState("Hóa đơn HD-9988...");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [evalSaved, setEvalSaved] = useState(false);

  // Xử lý khi chọn file ảnh từ máy
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAiResult(null);
      setEvalSaved(false);
    }
  };

  // 1. Gửi dữ liệu trích xuất (Tự động nhận diện gửi text hay gửi file ảnh)
  const handleExtract = async () => {
    setLoading(true);
    setAiResult(null);
    setEvalSaved(false);

    try {
      let res;
      if (activeTab === "image") {
        if (!selectedFile) {
          alert("Vui lòng chọn một file ảnh hóa đơn.");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        res = await fetch(`${API_BASE_URL}/ai/extract-invoice-image`, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(`${API_BASE_URL}/ai/extract-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: inputText }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi HTTP: ${res.status}`);
      }

      const data = await res.json();
      setAiResult(data);
    } catch (error: any) {
      alert("Lỗi khi xử lý: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Gửi đánh giá phản hồi chất lượng (HITL)
  const handleFeedback = async (isAccurate: boolean) => {
    if (!aiResult) return;

    try {
      const res = await fetch(`${API_BASE_URL}/ai/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalInput: activeTab === "image" ? selectedFile?.name : inputText,
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
      alert("Lỗi gửi đánh giá: " + error);
    }
  };

  // Bổ sung các state quản lý phân tích luồng trong component EvaluationDashboard
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

// Hàm kích hoạt phân tích chuyên sâu qua Stream Analysis
  const handleStreamAnalysis = async (aiResult: any) => {
    if (!aiResult) {
      alert("Vui lòng trích xuất hóa đơn trước khi yêu cầu phân tích.");
      return;
    }

    setStreamingText("");
    setIsStreaming(true);

    // Tạo câu lệnh (prompt) tổng hợp từ dữ liệu JSON hóa đơn vừa trích xuất
    const analysisPrompt = `
Hãy đóng vai chuyên gia tài chính và kiểm toán. Dựa vào thông tin hóa đơn sau:
- Nhà cung cấp: ${aiResult.vendorName || "Không rõ"}
- Ngày hóa đơn: ${aiResult.invoiceDate || "Không rõ"}
- Tổng tiền: ${aiResult.totalAmount || 0} ${aiResult.currency || "VND"}
- Chi tiết mặt hàng: ${JSON.stringify(aiResult.items || [])}

Hãy phân tích chi tiết:
1. Đánh giá tính hợp lý của các khoản chi và đơn giá.
2. Kiểm tra tính chính xác của phép tính và thuế GTGT.
3. Đưa ra 2 gợi ý cụ thể để doanh nghiệp tối ưu chi phí này.
`;

    try {
      const response = await fetch(`${API_BASE_URL}/ai/stream-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: analysisPrompt }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Không thể kết nối đến luồng phân tích.");
      }

      // Đọc luồng dữ liệu theo thời gian thực (Server-Sent Events)
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Giải mã dữ liệu nhị phân nhận được thành chuỗi văn bản
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const rawData = line.replace("data: ", "").trim();

            if (!rawData) continue;

            try {
              const parsed = JSON.parse(rawData);

              // Kiểm tra tín hiệu kết thúc từ backend
              if (parsed.done) {
                break;
              }

              // Nếu dữ liệu là một chuỗi ký tự (token), nối vào kết quả hiển thị
              if (typeof parsed === "string") {
                accumulatedText += parsed;
                setStreamingText(accumulatedText);
              }
            } catch (e) {
              // Trường hợp dữ liệu thô không phải JSON
              accumulatedText += rawData;
              setStreamingText(accumulatedText);
            }
          }
        }
      }
    } catch (error: any) {
      alert("Lỗi luồng phân tích: " + error.message);
    } finally {
      setIsStreaming(false);
    }
  };
  return (
      <main className="min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="border-b border-slate-700 pb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-sky-400">
                Trích xuất & Đánh giá Hóa đơn (AI Vision)
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                API Server: <span className="font-mono text-emerald-400">{API_BASE_URL}</span>
              </p>
            </div>
            {/* Tab chuyển đổi giữa Text và Ảnh */}
            <div className="flex bg-slate-800 p-1 rounded border border-slate-700">
              <button
                  onClick={() => setActiveTab("image")}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                      activeTab === "image" ? "bg-sky-600 text-white" : "text-slate-400"
                  }`}
              >
                Upload Ảnh
              </button>
              <button
                  onClick={() => setActiveTab("text")}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                      activeTab === "text" ? "bg-sky-600 text-white" : "text-slate-400"
                  }`}
              >
                Nhập Text
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cột trái: Đầu vào */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
              {activeTab === "image" ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">
                      Chọn ảnh hóa đơn (JPG, PNG, WebP):
                    </label>
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleFileChange}
                        className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                    />

                    {previewUrl && (
                        <div className="border border-slate-700 rounded overflow-hidden max-h-56 flex items-center justify-center bg-slate-950">
                          <img src={previewUrl} alt="Preview" className="max-h-56 object-contain" />
                        </div>
                    )}
                  </div>
              ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">
                      Văn bản hóa đơn:
                    </label>
                    <textarea
                        rows={8}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        className="w-full p-3 rounded bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
              )}

              <button
                  onClick={handleExtract}
                  disabled={loading}
                  className="mt-4 w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 font-medium rounded transition"
              >
                {loading ? "AI đang phân tích..." : "Trích xuất thông tin"}
              </button>
            </div>

            {/* Cột phải: Kết quả trích xuất & Đánh giá */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-medium mb-2 text-slate-300">
                  Dữ liệu có cấu trúc (Structured JSON):
                </h2>
                <div className="bg-slate-900 border border-slate-700 rounded p-3 h-56 overflow-auto font-mono text-xs text-emerald-400">
                  {aiResult ? (
                      <pre>{JSON.stringify(aiResult, null, 2)}</pre>
                  ) : (
                      <span className="text-slate-500 italic">Chưa có dữ liệu trích xuất...</span>
                  )}
                </div>
              </div>

              {/* Khối hiển thị AI Streaming Financial Analysis */}
              {aiResult && (
                  <div className="mt-6 bg-slate-800 p-5 rounded-lg border border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <h3 className="text-base font-semibold text-sky-400">
                          Trợ lý Phân tích
                        </h3>
                      </div>
                      <button
                          onClick={() => handleStreamAnalysis(aiResult?.data)}
                          disabled={isStreaming}
                          className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-xs font-semibold rounded transition flex items-center gap-2 shadow"
                      >
                        {isStreaming ? (
                            <>
                              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                              Đang phân tích dòng tiền...
                            </>
                        ) : (
                            "⚡ Bắt đầu Phân tích"
                        )}
                      </button>
                    </div>

                    {/* Hộp hiển thị kết quả phân tích theo thời gian thực */}
                    <div className="p-4 bg-slate-950 border border-slate-700 rounded-md min-h-[140px] text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                      {streamingText ? (
                          <div>
                            {streamingText}
                            {isStreaming && (
                                <span className="inline-block w-2 h-4 bg-sky-400 ml-1 animate-pulse"></span>
                            )}
                          </div>
                      ) : (
                          <span className="text-slate-500 italic text-xs">
          Bấm nút "Bắt đầu Phân tích chuyên sâu" để AI kiểm toán đơn giá, kiểm tra sai sót số học và gợi ý tối ưu chi phí...
        </span>
                      )}
                    </div>
                  </div>
              )}

              {aiResult && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Đánh giá độ chính xác:</span>
                      <select
                          value={rating}
                          onChange={(e) => setRating(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n} sao
                            </option>
                        ))}
                      </select>
                    </div>

                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ghi chú đánh giá..."
                        className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    />

                    <div className="flex gap-2">
                      <button
                          onClick={() => handleFeedback(true)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded transition"
                      >
                        ✓ Chính xác
                      </button>
                      <button
                          onClick={() => handleFeedback(false)}
                          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-medium rounded transition"
                      >
                        ✗ Chưa chính xác
                      </button>
                    </div>

                    {evalSaved && (
                        <p className="text-xs text-center text-emerald-400 font-semibold mt-1">
                          Đã lưu phản hồi vào bộ dữ liệu đánh giá!
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
