import React, { useRef, useState } from "react";
import * as marked from "marked";
import Plot from "react-plotly.js";
import $ from "jquery";
import "datatables.net";

window.marked = marked;

// Helper: Parse markdown, extract Plotly, Mermaid, DataTables code blocks, and return an array of React elements
const renderAssistantMessage = (content, idx) => {
  // Parse markdown for plotly, mermaid, datatables code blocks
  const blockRegex = /```(plotly|mermaid|datatables)([\s\S]*?)```/g;
  let lastIndex = 0;
  let elements = [];
  let match;
  let key = 0;
  while ((match = blockRegex.exec(content)) !== null) {
    // Render markdown before the block
    if (match.index > lastIndex) {
      const before = content.slice(lastIndex, match.index);
      elements.push(
        <div
          key={`md-${key++}`}
          className="rendered-markdown"
          dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(before) : before }}
        />
      );
    }
    const blockType = match[1];
    const blockContent = match[2];
    if (blockType === "plotly") {
      let chartConfig = null;
      try {
        chartConfig = JSON.parse(blockContent);
      } catch {}
      if (chartConfig) {
        elements.push(
          <div key={`plotly-${key++}`} className="plotly-chart">
            <Plot data={chartConfig.data} layout={chartConfig.layout} config={chartConfig.config || {}} />
          </div>
        );
      } else {
        elements.push(<pre key={`plotly-fallback-${key++}`}>{match[0]}</pre>);
      }
    } else if (blockType === "mermaid") {
      // Render a placeholder div for Mermaid, will be hydrated by useEffect
      const diagramId = `mermaid-diagram-${idx}-${key++}`;
      elements.push(
        <div key={diagramId} className="mermaid" data-mermaid-code={blockContent} id={diagramId}>
          {blockContent}
        </div>
      );
    } else if (blockType === "datatables") {
      // Render a placeholder div for DataTables, will be hydrated by useEffect
      const tableId = `datatables-table-${idx}-${key++}`;
      elements.push(
        <div key={tableId} className="datatables-table-container" data-table-config={blockContent} id={tableId}>
          <pre>{blockContent}</pre>
        </div>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  // Render any remaining markdown after the last block
  if (lastIndex < content.length) {
    const after = content.slice(lastIndex);
    elements.push(
      <div
        key={`md-${key++}`}
        className="rendered-markdown"
        dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(after) : after }}
      />
    );
  }
  return <>{elements}</>;
};

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState([]);
  const [input, setInput] = useState("");
  const [thinkingVisible, setThinkingVisible] = useState(true);
  const chatRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_URL || '';

  const sendPrompt = () => {
    const prompt = input.trim();
    if (!prompt) return;
    setMessages((msgs) => [...msgs, { role: "user", content: prompt }]);
    setInput("");
    setThinking([]);
    let rawMarkdown = "";
    let lastAssistantMsg = null;
    const eventSource = new window.EventSource(`${apiBase}/api/llm/stream?prompt=${encodeURIComponent(prompt)}`);
    eventSource.addEventListener("thinking", (event) => {
      const data = JSON.parse(event.data);
      setThinking((prev) => [...prev, data.content]);
    });
    eventSource.addEventListener("chunk", (event) => {
      const data = JSON.parse(event.data);
      rawMarkdown += data.content;
      if (!lastAssistantMsg) {
        lastAssistantMsg = { role: "assistant", content: "" };
        setMessages((msgs) => [...msgs, lastAssistantMsg]);
      }
      setMessages((msgs) => {
        const updated = [...msgs];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant") {
            updated[i] = { ...updated[i], content: rawMarkdown };
            break;
          }
        }
        return updated;
      });
      setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 0);
    });
    eventSource.addEventListener("done", () => {
      eventSource.close();
      lastAssistantMsg = null;
    });
    eventSource.onerror = () => eventSource.close();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      sendPrompt();
      e.preventDefault();
    }
  };

  React.useEffect(() => {
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    }
  }, []);

  React.useEffect(() => {
    // Mermaid hydration: render all .mermaid[data-mermaid-code] blocks
    const bubbles = document.querySelectorAll(".chatgpt-bubble");
    bubbles.forEach((bubble) => {
      const mermaidDivs = bubble.querySelectorAll(".mermaid[data-mermaid-code]");
      mermaidDivs.forEach((div) => {
        if (div.dataset.processed) return;
        div.dataset.processed = "true";
        try {
          const code = div.getAttribute("data-mermaid-code");
          div.innerHTML = "";
          // Only call mermaid.render if div is attached to the DOM
          if (window.mermaid && window.mermaid.parse && document.body.contains(div)) {
            try {
              window.mermaid.parse(code);
              const uniqueId = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;
              setTimeout(() => {
                // Double-check the div is still in the DOM
                if (document.body.contains(div)) {
                  window.mermaid.render(uniqueId, code, (svgCode) => {
                    div.innerHTML = svgCode;
                  }, div);
                }
              }, 0);
            } catch (err) {
              div.innerHTML = `<pre style='color:#f55'>Invalid Mermaid diagram</pre><pre>${code}</pre>`;
            }
          } else {
            div.innerHTML = `<pre>${code}</pre>`;
          }
        } catch {}
      });
      // DataTables hydration (unchanged)
      const tableDivs = bubble.querySelectorAll(".datatables-table-container[data-table-config]");
      tableDivs.forEach((div) => {
        if (div.dataset.processed) return;
        div.dataset.processed = "true";
        try {
          const config = JSON.parse(div.getAttribute("data-table-config"));
          const tableId = div.id + "-table";
          let table = div.querySelector("table");
          if (!table) {
            table = document.createElement("table");
            table.id = tableId;
            table.classList.add("display");
            div.innerHTML = "";
            div.appendChild(table);
          }
          $(table).DataTable(config);
        } catch {}
      });
      // MathJax hydration: always typeset
      if (window.MathJax) {
        window.MathJax.typesetPromise([bubble]).catch(() => {});
      }
    });
  }, [messages]);

  return (
    <>
      <div className="chatgpt-header">
        <h1>LLM Chat Demo</h1>
      </div>
      <div className="chatgpt-main">
        <div className="chatgpt-chatbox">
          <div className="chatgpt-messages" id="chat-messages" ref={chatRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatgpt-message ${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="chatgpt-bubble rendered-markdown" dangerouslySetInnerHTML={{ __html: msg.content }} />
                ) : (
                  <div className="chatgpt-bubble">{renderAssistantMessage(msg.content, idx)}</div>
                )}
              </div>
            ))}
          </div>
          <div className="chatgpt-inputbar">
            <textarea
              id="prompt"
              placeholder="Send a message... (Ctrl+Enter to send)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <button id="submit" onClick={sendPrompt}>➤</button>
          </div>
        </div>
        <div className="chatgpt-thinking-section" id="thinking-section">
          <div className="chatgpt-thinking-header">
            <span>Thinking</span>
            <button id="toggle-thinking" title="Minimize" onClick={() => setThinkingVisible(v => !v)}>{thinkingVisible ? '−' : '+'}</button>
          </div>
          {thinkingVisible && (
            <div id="thinking" className="chatgpt-thinking">
              {thinking.map((t, i) => <p key={i}>🤔 {t}</p>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatApp;
