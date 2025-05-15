import React, { useRef, useState } from "react";
import * as marked from "marked";
import Plot from "react-plotly.js";
import $ from "jquery";
import "datatables.net";

window.marked = marked;

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
  pedantic: false,
  headerIds: false
});

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
          className="rendered-markdown math-content"
          dangerouslySetInnerHTML={{ __html: window.marked ? marked.parse(before) : before }}
        />
      );
    }
    const blockType = match[1];
    const blockContent = match[2].trim();
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
        <div 
          key={diagramId} 
          className="mermaid" 
          data-mermaid-code={blockContent} 
          id={diagramId} 
          style={{background: '#444654', padding: '16px', borderRadius: '8px'}}
        >
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
  const [isGenerating, setIsGenerating] = useState(false);
  const chatRef = useRef(null);
  const eventSourceRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_URL || '';

  const stopGenerating = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsGenerating(false);
    }
  };

  const sendPrompt = () => {
    const prompt = input.trim();
    if (!prompt) return;
    
    // Close any existing connection
    stopGenerating();
    
    setMessages((msgs) => [...msgs, { role: "user", content: prompt }]);
    setInput("");
    setThinking([]);
    let rawMarkdown = "";
    let lastAssistantMsg = null;

    const eventSource = new window.EventSource(`${apiBase}/api/llm/stream?prompt=${encodeURIComponent(prompt)}`);
    eventSourceRef.current = eventSource;
    setIsGenerating(true);

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
      eventSourceRef.current = null;
      setIsGenerating(false);
      lastAssistantMsg = null;
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsGenerating(false);
    };
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift+Enter: let the default behavior happen (newline)
        return;
      }
      // Just Enter: send message
      e.preventDefault();
      sendPrompt();
    }
  };

  React.useEffect(() => {
    // Initialize mermaid with dark theme settings
    if (window.mermaid) {
      try {
        window.mermaid.initialize({ 
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          flowchart: {
            htmlLabels: true,
            curve: 'linear',
          },
          themeVariables: {
            primaryColor: '#57a3eb',
            primaryTextColor: '#fff',
            primaryBorderColor: '#57a3eb',
            lineColor: '#999',
            secondaryColor: '#444654',
            tertiaryColor: '#444654',
            noteTextColor: '#fff',
            noteBkgColor: '#444654',
            titleColor: '#fff',
            actorBorder: '#57a3eb',
            actorBkg: '#343541',
            actorTextColor: '#fff',
            actorLineColor: '#999',
            signalColor: '#fff',
            signalTextColor: '#fff',
            labelBoxBkgColor: '#343541',
            labelBoxBorderColor: '#57a3eb',
            labelTextColor: '#fff',
            loopTextColor: '#fff',
            activationBorderColor: '#57a3eb',
            activationBkgColor: '#444654',
            sequenceNumberColor: '#fff',
          }
        });
        console.log('Mermaid initialized successfully');
      } catch (error) {
        console.error('Error initializing Mermaid:', error);
      }
    } else {
      console.warn('Mermaid library not loaded');
    }
  }, []);

  React.useEffect(() => {
    // Updated Mermaid hydration logic
    const bubbles = document.querySelectorAll(".chatgpt-bubble");
    bubbles.forEach((bubble) => {
      const mermaidDivs = bubble.querySelectorAll(".mermaid[data-mermaid-code]");
      mermaidDivs.forEach((div) => {
        if (div.dataset.processed === "true") return;
        
        try {
          const code = div.getAttribute("data-mermaid-code");
          if (!code) return;
          
          div.dataset.processed = "true";
          div.innerHTML = code;
          
          if (window.mermaid) {
            // Force re-render of mermaid diagram
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            div.innerHTML = '';
            try {
              window.mermaid.render(id, code).then(({svg}) => {
                div.innerHTML = svg;
              }).catch(error => {
                console.error('Error rendering Mermaid diagram:', error);
                div.innerHTML = `<pre style="color: #f55">Error rendering diagram: ${error.message}</pre><pre>${code}</pre>`;
              });
            } catch (error) {
              console.error('Error in Mermaid render process:', error);
              div.innerHTML = `<pre style="color: #f55">Error in render process: ${error.message}</pre><pre>${code}</pre>`;
            }
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          div.innerHTML = `<pre style="color: #f55">Error rendering diagram: ${error.message}</pre>`;
        }
      });

      // DataTables and MathJax hydration (unchanged)
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
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          window.MathJax.typesetPromise([bubble]).then(() => {
            console.log('MathJax typeset completed');
          }).catch((err) => {
            console.error('MathJax typeset error:', err);
          });
        } catch (error) {
          console.error('Error during MathJax typesetting:', error);
        }
      }
    });
  }, [messages]);

  return (
    <>
      <div className="chatgpt-header">
        <h1 style={{fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.5px', margin: 0}}>ChatGPT</h1>
      </div>
      <div className="chatgpt-main">
        <div className="chatgpt-chatbox">
          <div className="chatgpt-messages" id="chat-messages" ref={chatRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatgpt-message ${msg.role}`} style={{padding: 0, margin: 0}}>
                {msg.role === 'user' ? (
                  <div className="chatgpt-bubble rendered-markdown" style={{background: '#444654', color: '#ececf1', borderRadius: 8, margin: '0 auto', boxShadow: 'none'}} dangerouslySetInnerHTML={{ __html: msg.content }} />
                ) : (
                  <div className="chatgpt-bubble" style={{background: '#343541', color: '#ececf1', border: '1px solid #444654', borderRadius: 8, margin: '0 auto', boxShadow: 'none'}}>{renderAssistantMessage(msg.content, idx)}</div>
                )}
              </div>
            ))}
          </div>
          <div className="chatgpt-inputbar">
            <textarea
              id="prompt"
              placeholder="Message ChatGPT... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              style={{background: '#40414f', color: '#ececf1', borderRadius: 8, padding: '16px 18px', fontSize: '1.08em', boxShadow: '0 2px 8px 0 #0002', border: 'none', fontFamily: 'inherit'}}
            />
            {isGenerating ? (
              <button
                onClick={stopGenerating}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: '1em',
                  height: 48,
                  boxShadow: '0 2px 8px 0 #0002',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 22px',
                  whiteSpace: 'nowrap'
                }}
              >
                Stop
              </button>
            ) : (
              <button id="submit" onClick={sendPrompt} style={{background: '#19c37d', color: '#fff', borderRadius: 8, fontSize: '1.5em', height: 48, boxShadow: '0 2px 8px 0 #0002', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 22px'}}>
                ➤
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatApp;
