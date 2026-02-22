"use client";

import { useState, useEffect } from "react";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

export function QRCodeDisplay({ url, size = 256 }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [url, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = "qr-code.png";
    link.href = dataUrl;
    link.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <img src={dataUrl} alt="QR Code" width={size} height={size} />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
          <input
            readOnly
            value={url}
            className="flex-1 bg-transparent text-sm truncate outline-none px-2"
          />
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" /> Download QR
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1 text-green-500" /> Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
