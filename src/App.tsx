import {
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Download, Upload } from "lucide-react";

interface Verse {
  text: string;
  reference: string;
}

interface TextStyle {
  fontSize: number;
  titleSize: number;
  fontFamily: string;
  color: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  x: number;
  y: number;
}

const fonts = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Helvetica",
];

// Canvas dimensions - consistent across all components
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

export default function BibleVerseFormatter() {
  const [verseRange, setVerseRange] = useState<string>("");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [textStyle, setTextStyle] = useState<TextStyle>({
    fontSize: 24,
    titleSize: 16,
    fontFamily: "Arial",
    color: "#ffffff",
  });
  const [verseBox, setVerseBox] = useState<Box>({
    x: 50,
    y: 50,
    width: 400,
    height: 200,
  });
  const [refBox, setRefBox] = useState<Box>({
    x: 600,
    y: 400,
    width: 200,
    height: 60,
  });
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<DragState>({ x: 0, y: 0 });

  const parseVerseRange = (range: string) => {
    const trimmed = range.trim();

    // Match patterns like "john 3:16" or "matt 25:31-33"
    const match = trimmed.match(
      /^([a-zA-Z]+)\s+(\d+):(\d+(?:-\d+)?(?:,\d+)*)$/i
    );
    if (match) {
      const [, book, chapter, versesPart] = match;
      const verses: number[] = [];

      const parts = versesPart.split(",");
      for (const part of parts) {
        if (part.includes("-")) {
          const [start, end] = part.split("-").map((v) => parseInt(v.trim()));
          for (let i = start; i <= end; i++) {
            verses.push(i);
          }
        } else {
          verses.push(parseInt(part.trim()));
        }
      }

      return { book, chapter, verses };
    }

    throw new Error("Invalid verse format");
  };

  const fetchVerses = async (): Promise<void> => {
    if (!verseRange) return;

    try {
      const {
        book,
        chapter,
        verses: verseNumbers,
      } = parseVerseRange(verseRange);
      const fetched: Verse[] = [];

      for (const verse of verseNumbers) {
        try {
          const response = await fetch(
            `https://bible-api.com/${book}+${chapter}:${verse}`
          );
          const data = await response.json();
          if (data.text) {
            fetched.push({
              text: data.text.trim(),
              reference: data.reference,
            });
          }
        } catch (error) {
          console.error(`Error fetching verse ${verse}:`, error);
        }
      }
      setVerses(fetched);
    } catch (error) {
      alert('Invalid verse format. Try: "john 3:16", "matt 25:31-33", etc.');
    }
  };

  const handleBackgroundUpload = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBackgroundImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") fetchVerses();
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const downloadImage = async (verseIndex: number): Promise<void> => {
    if (!verses[verseIndex]) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    if (backgroundImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          resolve();
        };
        img.src = backgroundImage;
      });
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw verse text
    ctx.fillStyle = textStyle.color;
    ctx.font = `${textStyle.fontSize}px ${textStyle.fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const verseLines = wrapText(
      ctx,
      verses[verseIndex].text,
      verseBox.width - 20
    );
    const verseLineHeight = textStyle.fontSize * 1.2;

    verseLines.forEach((line, lineIndex) => {
      const yPos = verseBox.y + 10 + lineIndex * verseLineHeight;
      if (yPos < verseBox.y + verseBox.height - 10) {
        ctx.fillText(line, verseBox.x + 10, yPos);
      }
    });

    // Draw reference text
    ctx.font = `${textStyle.titleSize}px ${textStyle.fontFamily}`;
    ctx.textAlign = "right";

    const refLines = wrapText(
      ctx,
      verses[verseIndex].reference,
      refBox.width - 20
    );
    const refLineHeight = textStyle.titleSize * 1.2;

    refLines.forEach((line, lineIndex) => {
      const yPos = refBox.y + 10 + lineIndex * refLineHeight;
      if (yPos < refBox.y + refBox.height - 10) {
        ctx.fillText(line, refBox.x + refBox.width - 10, yPos);
      }
    });

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verse_${verseIndex + 1}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const downloadAllImages = async (): Promise<void> => {
    for (let i = 0; i < verses.length; i++) {
      await downloadImage(i);
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };

  // Updated mouse handlers for dragging
  const handleMouseDown = (
    e: MouseEvent<HTMLDivElement>,
    boxType: string,
    action: string = "drag"
  ): void => {
    e.preventDefault();
    e.stopPropagation();

    if (action === "drag") {
      setIsDragging(boxType);
    } else {
      setIsResizing(boxType);
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>): void => {
    if (!isDragging && !isResizing) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Get container dimensions for scaling
    const container = e.currentTarget;
    const containerRect = container.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / containerRect.width;
    const scaleY = CANVAS_HEIGHT / containerRect.height;

    const scaledDeltaX = deltaX * scaleX;
    const scaledDeltaY = deltaY * scaleY;

    if (isDragging === "verse") {
      setVerseBox((prev) => ({
        ...prev,
        x: Math.max(
          0,
          Math.min(CANVAS_WIDTH - prev.width, prev.x + scaledDeltaX)
        ),
        y: Math.max(
          0,
          Math.min(CANVAS_HEIGHT - prev.height, prev.y + scaledDeltaY)
        ),
      }));
    } else if (isDragging === "ref") {
      setRefBox((prev) => ({
        ...prev,
        x: Math.max(
          0,
          Math.min(CANVAS_WIDTH - prev.width, prev.x + scaledDeltaX)
        ),
        y: Math.max(
          0,
          Math.min(CANVAS_HEIGHT - prev.height, prev.y + scaledDeltaY)
        ),
      }));
    } else if (isResizing === "verse") {
      setVerseBox((prev) => ({
        ...prev,
        width: Math.max(
          100,
          Math.min(CANVAS_WIDTH - prev.x, prev.width + scaledDeltaX)
        ),
        height: Math.max(
          50,
          Math.min(CANVAS_HEIGHT - prev.y, prev.height + scaledDeltaY)
        ),
      }));
    } else if (isResizing === "ref") {
      setRefBox((prev) => ({
        ...prev,
        width: Math.max(
          80,
          Math.min(CANVAS_WIDTH - prev.x, prev.width + scaledDeltaX)
        ),
        height: Math.max(
          30,
          Math.min(CANVAS_HEIGHT - prev.y, prev.height + scaledDeltaY)
        ),
      }));
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (): void => {
    setIsDragging(null);
    setIsResizing(null);
  };

  // Helper function to get consistent font sizes based on container width
  const getScaledFontSize = (baseFontSize: number, containerWidth: number) => {
    return (baseFontSize / CANVAS_WIDTH) * containerWidth;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-slate-800 text-white flex flex-col">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <section className="text-center space-y-2">
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: textStyle.fontFamily }}
            >
              Scripture Frame
            </h1>
            <p className="text-gray-300">
              Create beautiful verse images with customizable design.
            </p>
          </section>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <Input
                    className="flex-1 min-w-0 bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                    value={verseRange}
                    onChange={(e) => setVerseRange(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="e.g. john 3:16, matt 25:31-33"
                  />
                  <Label className="relative border-2 border-dashed border-gray-400 rounded-md px-4 py-2 text-center cursor-pointer whitespace-nowrap hover:border-gray-300 transition-colors">
                    <Upload className="w-4 h-4 inline mr-2" />
                    <span>Upload Background</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBackgroundUpload}
                    />
                  </Label>
                  <Button onClick={fetchVerses} className="whitespace-nowrap">
                    Load Verses
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <Button
                    onClick={downloadAllImages}
                    disabled={verses.length === 0}
                    variant="secondary"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download All ({verses.length})
                  </Button>
                  {backgroundImage && (
                    <div className="flex items-center gap-2">
                      <img
                        src={backgroundImage}
                        alt="Uploaded preview"
                        className="w-12 h-12 object-cover rounded border border-slate-600"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBackgroundImage(null)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Text customization controls */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">Text Customization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Text Color</Label>
                  <input
                    type="color"
                    value={textStyle.color}
                    onChange={(e) =>
                      setTextStyle((s) => ({ ...s, color: e.target.value }))
                    }
                    className="w-full h-10 rounded border-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Font Size</Label>
                  <Input
                    type="number"
                    value={textStyle.fontSize}
                    onChange={(e) =>
                      setTextStyle((s) => ({
                        ...s,
                        fontSize: parseInt(e.target.value),
                      }))
                    }
                    min="12"
                    max="72"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Reference Size</Label>
                  <Input
                    type="number"
                    value={textStyle.titleSize}
                    onChange={(e) =>
                      setTextStyle((s) => ({
                        ...s,
                        titleSize: parseInt(e.target.value),
                      }))
                    }
                    min="10"
                    max="48"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="flex flex-col gap-2 col-span-2 sm:col-span-1">
                  <Label className="text-sm">Font Family</Label>
                  <Select
                    value={textStyle.fontFamily}
                    onValueChange={(value: any) =>
                      setTextStyle((s) => ({ ...s, fontFamily: value }))
                    }
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {verses.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">
                  Preview ({verses.length} verses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="flex gap-4 pb-4">
                    {verses.map((v, i) => (
                      <div
                        key={i}
                        className="relative shrink-0 w-[512px] aspect-[16/9] border border-slate-600 rounded overflow-hidden bg-slate-800"
                      >
                        {backgroundImage && (
                          <img
                            src={backgroundImage}
                            alt="Background"
                            className="absolute inset-0 w-full h-full object-cover z-0"
                          />
                        )}
                        <div
                          className="absolute z-10 p-2 leading-tight overflow-hidden"
                          style={{
                            left: `${(verseBox.x / CANVAS_WIDTH) * 100}%`,
                            top: `${(verseBox.y / CANVAS_HEIGHT) * 100}%`,
                            width: `${(verseBox.width / CANVAS_WIDTH) * 100}%`,
                            height: `${
                              (verseBox.height / CANVAS_HEIGHT) * 100
                            }%`,
                            fontSize: `${getScaledFontSize(
                              textStyle.fontSize,
                              512
                            )}px`,
                            fontFamily: textStyle.fontFamily,
                            color: textStyle.color,
                            wordWrap: "break-word",
                            whiteSpace: "normal",
                            lineHeight: "1.2",
                          }}
                        >
                          {v.text}
                        </div>
                        <div
                          className="absolute z-10 p-2 text-right overflow-hidden"
                          style={{
                            left: `${(refBox.x / CANVAS_WIDTH) * 100}%`,
                            top: `${(refBox.y / CANVAS_HEIGHT) * 100}%`,
                            width: `${(refBox.width / CANVAS_WIDTH) * 100}%`,
                            height: `${(refBox.height / CANVAS_HEIGHT) * 100}%`,
                            fontSize: `${getScaledFontSize(
                              textStyle.titleSize,
                              512
                            )}px`,
                            fontFamily: textStyle.fontFamily,
                            color: textStyle.color,
                            wordWrap: "break-word",
                            whiteSpace: "normal",
                            lineHeight: "1.2",
                          }}
                        >
                          {v.reference}
                        </div>
                        <Button
                          onClick={() => downloadImage(i)}
                          size="sm"
                          className="absolute top-2 right-2 z-20"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Master Editor */}
          {verses.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">
                  Edit Placement (applies to all verses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-4xl mx-auto">
                  <div
                    data-editor-container
                    className="relative w-full aspect-[16/9] border-2 border-dashed border-slate-500 rounded bg-slate-800 overflow-hidden select-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {backgroundImage && (
                      <img
                        src={backgroundImage}
                        alt="Editor Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
                      />
                    )}

                    {/* Verse Box */}
                    <div
                      className="absolute border-2 border-dashed border-blue-400 bg-blue-400 bg-opacity-20 cursor-move group"
                      style={{
                        left: `${(verseBox.x / CANVAS_WIDTH) * 100}%`,
                        top: `${(verseBox.y / CANVAS_HEIGHT) * 100}%`,
                        width: `${(verseBox.width / CANVAS_WIDTH) * 100}%`,
                        height: `${(verseBox.height / CANVAS_HEIGHT) * 100}%`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, "verse", "drag")}
                    >
                      <div className="absolute -top-6 left-0 text-xs text-blue-400 font-medium bg-slate-800 px-2 py-1 rounded">
                        Verse Text
                      </div>
                      <div
                        style={{
                          fontSize: `${getScaledFontSize(
                            textStyle.fontSize,
                            800
                          )}px`,
                          color: textStyle.color,
                          fontFamily: textStyle.fontFamily,
                          lineHeight: "1.2",
                        }}
                        className="w-full h-full p-2 overflow-hidden leading-tight pointer-events-none"
                      >
                        {verses[0]?.text ||
                          "Sample verse text that wraps properly within the box constraints and shows how the actual text will appear"}
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-blue-400 cursor-se-resize opacity-70 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) =>
                          handleMouseDown(e, "verse", "resize")
                        }
                      />
                    </div>

                    {/* Reference Box */}
                    <div
                      className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400 bg-opacity-20 cursor-move group"
                      style={{
                        left: `${(refBox.x / CANVAS_WIDTH) * 100}%`,
                        top: `${(refBox.y / CANVAS_HEIGHT) * 100}%`,
                        width: `${(refBox.width / CANVAS_WIDTH) * 100}%`,
                        height: `${(refBox.height / CANVAS_HEIGHT) * 100}%`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, "ref", "drag")}
                    >
                      <div className="absolute -top-6 left-0 text-xs text-yellow-400 font-medium bg-slate-800 px-2 py-1 rounded">
                        Reference
                      </div>
                      <div
                        style={{
                          fontSize: `${getScaledFontSize(
                            textStyle.titleSize,
                            800
                          )}px`,
                          color: textStyle.color,
                          fontFamily: textStyle.fontFamily,
                          lineHeight: "1.2",
                        }}
                        className="w-full h-full p-2 overflow-hidden text-right pointer-events-none"
                      >
                        {verses[0]?.reference || "Genesis 1:1"}
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-yellow-400 cursor-se-resize opacity-70 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleMouseDown(e, "ref", "resize")}
                      />
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-400 space-y-1">
                    <div className="text-center">
                      <span className="text-blue-400">■</span> Verse Text Box:
                      Drag to move, resize from bottom-right corner
                    </div>
                    <div className="text-center">
                      <span className="text-yellow-400">■</span> Reference Box:
                      Drag to move, resize from bottom-right corner
                    </div>
                    <div className="text-center text-xs text-gray-500">
                      Text will automatically wrap within the box boundaries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="text-center text-sm text-gray-400 py-4 border-t border-slate-700">
        © {new Date().getFullYear()} Scripture Frame. Made with faith.
      </footer>
    </div>
  );
}
