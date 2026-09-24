import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Calculator,
  Code2,
  FileImage,
  FileText,
  Home,
  Menu,
  Plus,
  QrCode,
  Search,
  Settings,
  Shield,
  Upload,
  Receipt,
  Share2,
  Brain,
  Crop,
  Wrench
} from "lucide-react";
import QRCode from "qrcode";
import { db, type Note } from "./db";

type Tool = {
  id: string;
  name: string;
  description: string;
  icon: any;
};

const tools: Tool[] = [
  {
    id: "brain",
    name: "Second Brain",
    description: "Private notes, ideas and local knowledge",
    icon: Brain
  },
  {
    id: "pdf",
    name: "PDF Toolbox",
    description: "Work with PDF files locally",
    icon: FileText
  },
  {
    id: "vault",
    name: "Private Vault",
    description: "Private local vault foundation",
    icon: Shield
  },
  {
    id: "invoice",
    name: "Invoice Generator",
    description: "Create invoices without a server",
    icon: Receipt
  },
  {
    id: "file-share",
    name: "LAN File Share",
    description: "Local device sharing foundation",
    icon: Share2
  },
  {
    id: "image",
    name: "Image Tools",
    description: "Resize, compress and convert images",
    icon: FileImage
  },
  {
    id: "qr",
    name: "QR Toolkit",
    description: "Generate QR codes locally",
    icon: QrCode
  },
  {
    id: "developer",
    name: "Developer Toolbox",
    description: "JSON, Base64, UUID and utilities",
    icon: Code2
  },
  {
    id: "screenshot",
    name: "Screenshot Cleaner",
    description: "Crop, resize and clean screenshots",
    icon: Crop
  },
  {
    id: "calculator",
    name: "Calculator Hub",
    description: "Math, finance, dates and units",
    icon: Calculator
  }
];

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;

  return (
    <Link className="tool-card" to={`/tools/${tool.id}`}>
      <div className="tool-icon">
        <Icon size={24} />
      </div>

      <div>
        <h3>{tool.name}</h3>
        <p>{tool.description}</p>
      </div>
    </Link>
  );
}

function HomePage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      tools.filter((tool) =>
        `${tool.name} ${tool.description}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [search]
  );

  return (
    <>
      <section className="hero">
        <div className="eyebrow">PRIVATE • OFFLINE • LOCAL</div>

        <h1>
          Your personal toolkit.
          <br />
          <span>Without the cloud.</span>
        </h1>

        <p>
          A privacy-first collection of useful tools that run directly inside
          your browser.
        </p>
      </section>

      <div className="home-search">
        <Search size={20} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
        />
      </div>

      <div className="section-heading">
        <h2>All Tools</h2>
        <span>{filtered.length} tools</span>
      </div>

      <div className="tool-grid">
        {filtered.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}

function ImageTool() {
  const [images, setImages] = useState<
    { name: string; url: string; size: number }[]
  >([]);

  const [quality, setQuality] = useState(0.8);
  const [width, setWidth] = useState("");

  function addFiles(files: FileList | null) {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        setImages((current) => [
          ...current,
          {
            name: file.name,
            url: String(reader.result),
            size: file.size
          }
        ]);
      };

      reader.readAsDataURL(file);
    });
  }

  async function processImage(image: {
    name: string;
    url: string;
  }) {
    const img = new Image();

    img.src = image.url;

    await img.decode();

    const targetWidth =
      Number(width) > 0 ? Number(width) : img.naturalWidth;

    const targetHeight = Math.round(
      img.naturalHeight * (targetWidth / img.naturalWidth)
    );

    const canvas = document.createElement("canvas");

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) return;

    context.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download =
      image.name.replace(/\.[^.]+$/, "") + "-optimized.webp";

    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel">
      <h2>Image Tools</h2>

      <p className="muted">
        Images are processed locally in your browser.
      </p>

      <label className="dropzone">
        <Upload size={32} />
        <strong>Select images</strong>
        <span>JPG, PNG, WebP and other browser-supported images</span>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      <div className="controls">
        <label>
          Quality: {Math.round(quality * 100)}%
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </label>

        <label>
          Resize width
          <input
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="Original size"
          />
        </label>
      </div>

      <div className="file-list">
        {images.map((image, index) => (
          <div className="file-row" key={`${image.name}-${index}`}>
            <img src={image.url} />

            <div className="file-info">
              <strong>{image.name}</strong>
              <small>{Math.round(image.size / 1024)} KB</small>
            </div>

            <button onClick={() => processImage(image)}>
              Download
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrainTool() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function loadNotes() {
    const data = await db.notes
      .orderBy("updatedAt")
      .reverse()
      .toArray();

    setNotes(data);
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function saveNote() {
    if (!title.trim()) return;

    await db.notes.add({
      title,
      content,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    setTitle("");
    setContent("");

    loadNotes();
  }

  return (
    <section className="panel">
      <h2>Second Brain Lite</h2>

      <p className="muted">
        Notes are stored in IndexedDB on this device.
      </p>

      <input
        className="full-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
      />

      <textarea
        className="full-input textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your thoughts..."
      />

      <button onClick={saveNote}>
        <Plus size={17} />
        Save note
      </button>

      <div className="notes">
        {notes.map((note) => (
          <article className="note" key={note.id}>
            <strong>{note.title}</strong>
            <p>{note.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function QRTool() {
  const [text, setText] = useState("https://example.com");
  const [src, setSrc] = useState("");

  async function generate() {
    const data = await QRCode.toDataURL(text, {
      width: 500,
      margin: 2
    });

    setSrc(data);
  }

  function download() {
    if (!src) return;

    const a = document.createElement("a");

    a.href = src;
    a.download = "localkit-qr.png";

    a.click();
  }

  return (
    <section className="panel">
      <h2>QR Toolkit</h2>

      <textarea
        className="full-input textarea small"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text or URL"
      />

      <div className="button-row">
        <button onClick={generate}>Generate QR</button>

        {src && (
          <button className="secondary" onClick={download}>
            Download PNG
          </button>
        )}
      </div>

      {src && (
        <div className="qr-preview">
          <img src={src} />
        </div>
      )}
    </section>
  );
}

function DeveloperTool() {
  const [input, setInput] = useState('{"hello":"world"}');
  const [output, setOutput] = useState("");

  function formatJSON() {
    try {
      setOutput(JSON.stringify(JSON.parse(input), null, 2));
    } catch {
      setOutput("Invalid JSON");
    }
  }

  function minifyJSON() {
    try {
      setOutput(JSON.stringify(JSON.parse(input)));
    } catch {
      setOutput("Invalid JSON");
    }
  }

  function uuid() {
    setOutput(crypto.randomUUID());
  }

  function base64Encode() {
    setOutput(btoa(unescape(encodeURIComponent(input))));
  }

  function base64Decode() {
    try {
      setOutput(decodeURIComponent(escape(atob(input))));
    } catch {
      setOutput("Invalid Base64");
    }
  }

  return (
    <section className="panel">
      <h2>Developer Toolbox</h2>

      <textarea
        className="full-input textarea"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="button-grid">
        <button onClick={formatJSON}>Format JSON</button>
        <button onClick={minifyJSON}>Minify JSON</button>
        <button onClick={uuid}>Generate UUID</button>
        <button onClick={base64Encode}>Base64 Encode</button>
        <button onClick={base64Decode}>Base64 Decode</button>
      </div>

      <pre className="output">{output}</pre>
    </section>
  );
}

function CalculatorTool() {
  const [value, setValue] = useState("");

  function calculate() {
    if (!/^[0-9+\-*/().% ]+$/.test(value)) {
      setValue("Invalid expression");
      return;
    }

    try {
      const result = Function(`"use strict";return (${value})`)();
      setValue(String(result));
    } catch {
      setValue("Error");
    }
  }

  return (
    <section className="panel calculator">
      <h2>Calculator</h2>

      <input
        className="calculator-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="12 * 5 + 10"
      />

      <button onClick={calculate}>Calculate</button>

      <div className="calculator-help">
        Supports +, -, *, /, %, parentheses and numbers.
      </div>
    </section>
  );
}

function PlaceholderTool({ tool }: { tool: Tool }) {
  const Icon = tool.icon;

  return (
    <section className="panel placeholder">
      <div className="large-tool-icon">
        <Icon size={36} />
      </div>

      <h2>{tool.name}</h2>

      <p>{tool.description}</p>

      <div className="notice">
        <Wrench size={18} />
        <span>
          This module is included in the LocalKit architecture and is ready
          for its full local implementation.
        </span>
      </div>
    </section>
  );
}

export default function App() {
  const location = useLocation();

  const [menu, setMenu] = useState(false);

  const path = location.pathname.replace(/\/+$/, "");
  const isHome = path === "" || path === "/LocalKit";

  const toolId = path.split("/").pop();

  const selectedTool = tools.find((tool) => tool.id === toolId);

  let content;

  if (isHome) {
    content = <HomePage />;
  } else if (toolId === "image") {
    content = <ImageTool />;
  } else if (toolId === "brain") {
    content = <BrainTool />;
  } else if (toolId === "qr") {
    content = <QRTool />;
  } else if (toolId === "developer") {
    content = <DeveloperTool />;
  } else if (toolId === "calculator") {
    content = <CalculatorTool />;
  } else if (selectedTool) {
    content = <PlaceholderTool tool={selectedTool} />;
  } else {
    content = <HomePage />;
  }

  return (
    <div className="app">
      <header>
        <button
          className="icon-button mobile-menu"
          onClick={() => setMenu(!menu)}
        >
          <Menu size={22} />
        </button>

        <Link to="/" className="brand">
          LocalKit
          <span>Offline SuperTools</span>
        </Link>

        <div className="top-search">
          <Search size={18} />
          <input placeholder="Search tools..." />
        </div>

        <button className="icon-button">
          <Settings size={20} />
        </button>
      </header>

      <div className="layout">
        <aside className={menu ? "sidebar open" : "sidebar"}>
          <Link to="/" onClick={() => setMenu(false)}>
            <Home size={18} />
            Home
          </Link>

          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.id}
                to={`/tools/${tool.id}`}
                onClick={() => setMenu(false)}
              >
                <Icon size={18} />
                {tool.name}
              </Link>
            );
          })}
        </aside>

        <main>{content}</main>
      </div>

      <footer>
        LocalKit • Private • Offline • Local
      </footer>
    </div>
  );
}
