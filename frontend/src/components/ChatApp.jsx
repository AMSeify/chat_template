import React, { useRef, useState, useEffect } from "react";
import * as marked from "marked";
import Plot from "react-plotly.js";
import $ from "jquery";
import "datatables.net";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiStopCircle, FiChevronDown, FiChevronUp } from "react-icons/fi";

window.marked = marked;

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
  pedantic: false,
  headerIds: false,
});

// Helper: Parse markdown, extract Plotly, Mermaid, DataTables code blocks, and return an array of React elements
// (Logic remains the same as the original, just ensuring Tailwind classes are used where applicable)
const renderAssistantMessage = (content, idx) => {
  const blockRegex = /```(plotly|mermaid|datatables)([\s\S]*?)```/g;
  let lastIndex = 0;
  let elements = [];
  let key = 0;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    // Render markdown before the block
    if (match.index > lastIndex) {
      const before = content.slice(lastIndex, match.index);
      elements.push(
        <div
          key={`md-${key++}`}
          className="rendered-markdown math-content" // Keep rendered-markdown for potential custom styles or selectors
          dangerouslySetInnerHTML={{
            __html: window.marked ? marked.parse(before) : before,
          }}
        />
      );
    }

    const blockType = match[1];
    const blockContent = match[2].trim();

    if (blockType === "plotly") {
      let chartConfig = null;
      try {
        chartConfig = JSON.parse(blockContent);
      } catch (e) {
        console.error("Error parsing Plotly config:", e);
      }

      if (chartConfig && chartConfig.data && chartConfig.layout) {
        elements.push(
          <div key={`plotly-${key++}`} className="plotly-chart w-full flex justify-center"> {/* Added w-full and flex justify-center for centering */}
            <Plot
              data={chartConfig.data}
              layout={{ ...chartConfig.layout, autosize: true }} // Ensure chart is responsive
              config={chartConfig.config || { displayModeBar: false }} // Hide modebar by default
              useResizeHandler={true} // Enable responsive resizing
              style={{ width: '100%', height: '100%' }} // Plotly container styles
            />
          </div>
        );
      } else {
        // Display an error message if parsing fails
        elements.push(
          <div key={`plotly-fallback-${key++}`} className="text-red-500 bg-gray-800 p-3 rounded-md">
            <p>Error: Could not render Plotly chart. Invalid JSON or missing 'data'/'layout'.</p>
            <pre className="whitespace-pre-wrap break-words text-sm mt-2">{blockContent}</pre>
          </div>
        );
      }
    } else if (blockType === "mermaid") {
      const diagramId = `mermaid-diagram-${idx}-${key++}`;
      elements.push(
        <div
          key={diagramId}
          className="mermaid bg-[#444654] p-4 rounded-lg text-[#ececf1] overflow-auto" // Added text color and overflow
          data-mermaid-code={blockContent}
          id={diagramId}
        >
          {/* Initial content or error will be set by useEffect */}
          <div className="flex items-center justify-center h-32">Loading diagram...</div> {/* Placeholder */}
        </div>
      );
    } else if (blockType === "datatables") {
      const tableId = `datatables-table-${idx}-${key++}`;
      elements.push(
        <div
          key={tableId}
          className="datatables-table-container bg-[#343541] p-4 rounded-lg overflow-x-auto" // Added overflow-x-auto for horizontal scrolling
          data-table-config={blockContent}
          id={tableId}
        >
           {/* Placeholder content before DataTables initializes */}
           <div className="flex items-center justify-center h-32">Loading table...</div> {/* Placeholder */}
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
        className="rendered-markdown" // Keep rendered-markdown for potential custom styles or selectors
        dangerouslySetInnerHTML={{
          __html: window.marked ? marked.parse(after) : after,
        }}
      />
    );
  }

  return <>{elements}</>;
};


const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showThinkingDetails, setShowThinkingDetails] = useState(false); // Renamed state for clarity
  const chatRef = useRef(null);
  const eventSourceRef = useRef(null);

  const apiBase = import.meta.env.VITE_API_URL || "";

  const stopGenerating = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsGenerating(false);
      // Do NOT clear thinking messages here, they should persist after stop/done
    }
  };

  const sendPrompt = () => {
    const prompt = input.trim();
    if (!prompt) return;

    // Close any existing connection
    stopGenerating();

    setMessages((msgs) => [...msgs, { role: "user", content: prompt }]);
    setInput("");
    setThinking([]); // Clear thinking messages on new prompt
    setShowThinkingDetails(false); // Hide thinking details on new prompt

    let rawMarkdown = "";
    let lastAssistantMsgIndex = -1; // Keep track of the index of the last assistant message

    const eventSource = new window.EventSource(
      `${apiBase}/api/llm/stream?prompt=${encodeURIComponent(prompt)}`
    );
    eventSourceRef.current = eventSource;
    setIsGenerating(true);

    eventSource.addEventListener("thinking", (event) => {
      try {
        const data = JSON.parse(event.data);
        setThinking((prev) => [...prev, data.content]);
      } catch (error) {
        console.error("Failed to parse thinking event data:", error);
      }
    });

    eventSource.addEventListener("chunk", (event) => {
      try {
        const data = JSON.parse(event.data);
        rawMarkdown += data.content;

        setMessages((msgs) => {
          const updated = [...msgs];
          // If the last message is the user message we just sent, add the assistant message
          if (lastAssistantMsgIndex === -1 || updated[lastAssistantMsgIndex]?.role !== 'assistant') {
             updated.push({ role: "assistant", content: data.content });
             lastAssistantMsgIndex = updated.length - 1;
          } else {
             // Otherwise, update the content of the existing last assistant message
             updated[lastAssistantMsgIndex] = { ...updated[lastAssistantMsgIndex], content: rawMarkdown };
          }
          return updated;
        });

      } catch (error) {
         console.error("Failed to parse chunk event data:", error);
      }

      // Scroll to bottom after receiving a chunk
      setTimeout(() => {
        if (chatRef.current)
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 0);
    });

    eventSource.addEventListener("done", () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsGenerating(false);
      // Thinking messages will now be visible if thinking.length > 0
      lastAssistantMsgIndex = -1; // Reset index
    });

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      eventSource.close();
      eventSourceRef.current = null;
      setIsGenerating(false);
      // Optionally add an error message to the chat
      setMessages((msgs) => [...msgs, { role: "assistant", content: "An error occurred while generating the response." }]);
      lastAssistantMsgIndex = -1; // Reset index
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
      if (!isGenerating) { // Prevent sending new prompt while generating
         sendPrompt();
      }
    }
  };

  // Toggle thinking details visibility
  const toggleThinkingDetails = () => {
    setShowThinkingDetails(!showThinkingDetails);
  };

  // Initialize mermaid
  useEffect(() => {
    if (window.mermaid) {
      try {
        window.mermaid.initialize({
          startOnLoad: false, // Crucial for manual rendering
          theme: "dark",
          securityLevel: "loose", // Use with caution
          flowchart: { htmlLabels: true, curve: "linear" },
          sequence: { actorMargin: 50 }, // Added margin for sequence diagrams
          themeVariables: {
            // Standard dark theme colors, adjusted slightly
            primaryColor: "#57a3eb",
            primaryTextColor: "#fff",
            primaryBorderColor: "#57a3eb",
            lineColor: "#999",
            secondaryColor: "#444654",
            tertiaryColor: "#444654",
            noteTextColor: "#fff",
            noteBkgColor: "#40414f", // Darker background for notes
            titleColor: "#fff",
            actorBorder: "#57a3eb",
            actorBkg: "#343541",
            actorTextColor: "#fff",
            actorLineColor: "#999",
            signalColor: "#fff",
            signalTextColor: "#fff",
            labelBoxBkgColor: "#343541",
            labelBoxBorderColor: "#57a3eb",
            labelTextColor: "#fff",
            loopTextColor: "#fff",
            activationBorderColor: "#57a3eb",
            activationBkgColor: "#444654",
            sequenceNumberColor: "#fff",
             // Node styles (example for default nodes)
            nodeBorder: '#57a3eb',
            nodeBkg: '#40414f',
            nodeTextColor: '#fff',
          },
        });
        console.log("Mermaid initialized successfully");
      } catch (error) {
        console.error("Error initializing Mermaid:", error);
      }
    } else {
      console.warn("Mermaid library not loaded");
    }
  }, []);

  // Hydrate Mermaid, DataTables, and MathJax after messages update
  useEffect(() => {
     // Use a more specific selector or check if the bubble is new if performance is an issue
    const bubbles = chatRef.current ? chatRef.current.querySelectorAll(".chatgpt-bubble") : [];

    bubbles.forEach((bubble) => {
       // Process Mermaid diagrams
       const mermaidDivs = bubble.querySelectorAll(
         ".mermaid[data-mermaid-code]:not([data-processed='true'])" // Only process unprocessed divs
       );
       mermaidDivs.forEach(async (div) => { // Use async for mermaid.render
         div.dataset.processed = "true";
         const code = div.getAttribute("data-mermaid-code");
         if (!code || !window.mermaid) {
             div.innerHTML = `<pre class="text-red-500">Mermaid code missing or library not loaded.</pre><pre>${code || 'No code found'}</pre>`;
             return;
         }

         // Add basic placeholder before rendering
         div.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">Rendering diagram...</div>`;


         try {
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
             // Use a temporary div to render and then replace
            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none'; // Keep it hidden
            document.body.appendChild(tempDiv); // Attach to body to ensure it's in the DOM for rendering

            const { svg } = await window.mermaid.render(id, code, tempDiv);

            document.body.removeChild(tempDiv); // Clean up the temporary div

            if (svg) {
                div.innerHTML = svg;
                 // Apply additional SVG styling if needed (e.g., background if not handled by theme)
                 const svgElement = div.querySelector('svg');
                 if(svgElement) {
                     svgElement.style.backgroundColor = '#444654'; // Match bubble background
                 }
            } else {
                 throw new Error("Mermaid render returned no SVG.");
            }

         } catch (error) {
           console.error("Error rendering Mermaid diagram:", error);
           div.innerHTML = `<pre class="text-red-500">Error rendering diagram: ${error.message}</pre><pre>${code}</pre>`;
         }
       });

       // Process DataTables
       const tableDivs = bubble.querySelectorAll(
         ".datatables-table-container[data-table-config]:not([data-processed='true'])" // Only process unprocessed divs
       );
       tableDivs.forEach((div) => {
         div.dataset.processed = "true";
         try {
           const config = JSON.parse(div.getAttribute("data-table-config"));
           const tableId = div.id + "-table";

            // Clear placeholder and create table element
            div.innerHTML = "";
           let table = document.createElement("table");
           table.id = tableId;
            // Add necessary DataTables and Tailwind classes
           table.classList.add("w-full", "text-left", "border-collapse", "display", "text-[#c5c5d2]");
           div.appendChild(table);

           // Destroy existing DataTable instance if it exists
           if ($.fn.DataTable.isDataTable('#' + tableId)) {
               $('#' + tableId).DataTable().destroy();
           }

           // Initialize DataTables with the config
           const dataTable = $(table).DataTable(config);

           // Apply Tailwind dark mode styles to DataTables elements after initialization
           const dataTablesWrapper = $(`#${tableId}`).closest('.dataTables_wrapper');
            if (dataTablesWrapper.length) { // Ensure wrapper exists
                dataTablesWrapper.addClass('text-[#c5c5d2] bg-[#343541] p-4 rounded-lg'); // Wrapper styles

                // Note: Applying classes to specific DataTables generated elements is complex and might need !important or utility classes.
                // The following are general attempts and might need fine-tuning based on DataTables DOM structure.

                dataTablesWrapper.find('.dataTables_length, .dataTables_filter, .dataTables_info, .dataTables_paginate').addClass('text-[#c5c5d2] my-2');

                dataTablesWrapper.find('label').addClass('text-[#c5c5d2]'); // Ensure labels are visible

                dataTablesWrapper.find('.dataTables_filter input, .dataTables_length select').addClass('bg-[#40414f] text-[#ececf1] border border-[#555] rounded px-2 py-1 mx-1 focus:ring-2 focus:ring-[#19c37d] outline-none');

                dataTablesWrapper.find('.dataTables_paginate .paginate_button').addClass('bg-[#40414f] text-[#c5c5d2] border border-[#555] rounded px-3 py-1 mx-0.5 cursor-pointer transition duration-200 hover:bg-[#565869] hover:text-white');

                dataTablesWrapper.find('.dataTables_paginate .paginate_button.current').addClass('bg-[#19c37d] text-white border-[#19c37d]').removeClass('hover:bg-[#565869] hover:text-white');

                 dataTablesWrapper.find('.dataTables_paginate .paginate_button.disabled').addClass('bg-[#2a2b32] text-[#666] border-[#444] cursor-not-allowed opacity-50').removeClass('hover:bg-[#565869] hover:text-white');

                 // Add basic table styles again, they might get overridden by DataTables
                 $(`#${tableId}`).addClass('bg-[#2a2b32] text-[#c5c5d2] border-collapse');
                 $(`#${tableId} thead th, #${tableId} thead td`).addClass('bg-[#444654] text-[#ececf1] border-b-2 border-[#555] px-4 py-2');
                 $(`#${tableId} tbody tr`).addClass('bg-[#2a2b32]');
                 $(`#${tableId} tbody tr td`).addClass('text-[#c5c5d2]');
                 $(`#${tableId} tbody tr:hover`).addClass('bg-[#383942]');
                 $(`#${tableId}.stripe tbody tr.odd`).addClass('bg-[#343541]');

            } else {
                 console.warn("DataTables wrapper not found for ID:", tableId);
                 // Still attempt to style the original table element if wrapper not found
                 $(`#${tableId}`).addClass('bg-[#2a2b32] text-[#c5c5d2] border-collapse');
                  $(`#${tableId} thead th, #${tableId} thead td`).addClass('bg-[#444654] text-[#ececf1] border-b-2 border-[#555] px-4 py-2');
                 $(`#${tableId} tbody tr`).addClass('bg-[#2a2b32]');
                 $(`#${tableId} tbody tr td`).addClass('text-[#c5c5d2]');
                 $(`#${tableId} tbody tr:hover`).addClass('bg-[#383942]');
                 $(`#${tableId}.stripe tbody tr.odd`).addClass('bg-[#343541]');
            }


         } catch (error) {
             console.error("DataTables initialization error:", error);
             div.innerHTML = `<pre class="text-red-500">Error initializing DataTables: ${error.message}</pre><pre>${div.getAttribute("data-table-config")}</pre>`;
         }
       });

       // MathJax hydration: always typeset the whole bubble
       if (window.MathJax && window.MathJax.typesetPromise) {
         try {
           window.MathJax.typesetPromise([bubble])
             .then(() => {
               // console.log("MathJax typeset completed for a bubble");
             })
             .catch((err) => {
               console.error("MathJax typeset error on bubble:", err);
             });
         } catch (error) {
           console.error("Error during MathJax typesetting on bubble:", error);
         }
       }
    });

     // Auto-scroll whenever hydration might have changed the content height
     setTimeout(() => {
        if (chatRef.current)
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 100); // Small delay to allow rendering

  }, [messages]); // Dependency on messages ensures hydration after new messages arrive


  // Scroll to bottom when messages or thinking state changes
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, thinking]);


  return (
    <div className="flex flex-col h-screen w-screen bg-[#343541] text-[#ececf1] font-sans overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-[#343541] text-[#ececf1] py-4 px-0 text-center text-xl font-semibold border-b border-[#2a2b32] tracking-tight">
        <h1 className="font-semibold text-xl tracking-tight m-0">ChatGPT</h1>
      </div>

      {/* Main chat area */}
      {/* Simplified layout: flex column for the whole app, chat area takes flex-1 */}
      <div
        className="flex-1 pt-6 pb-0 px-0 overflow-y-auto max-h-none min-h-0 flex flex-col gap-0 bg-[#343541]
                   scrollbar-thin scrollbar-thumb-[#444654] scrollbar-track-[#2a2b32]"
        id="chat-messages"
        ref={chatRef}
      >
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            className={`w-full flex flex-row justify-center items-start px-3 pb-4 m-0 ${
              msg.role === "user" ? "justify-end" : "justify-start" // Align bubbles right for user, left for assistant
            } bg-transparent`} // Background color on the row is transparent, bubble has its own bg
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Message Bubble */}
            {msg.role === "user" ? (
              // User message bubble (Telegram style)
              <div className="chatgpt-bubble rendered-markdown text-white bg-blue-600 rounded-lg rounded-br-none shadow-md max-w-md w-auto px-4 py-2 text-lg break-words text-left">
                {/* In React, it's generally better to use dangerouslySetInnerHTML sparingly and only when rendering trusted HTML/markdown */}
                 <div dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
            ) : (
              // Assistant message bubble
              <div className="chatgpt-bubble bg-[#40414f] text-[#ececf1] rounded-lg rounded-bl-none shadow-md max-w-3xl w-full px-4 py-2 text-lg break-words text-left prose prose-invert"> {/* Added prose-invert for markdown styling */}
                {renderAssistantMessage(msg.content, idx)}
              </div>
            )}
          </motion.div>
        ))}

        {/* Thinking indicators and collapsible section */}
        {/* Show thinking section ONLY if NOT generating AND thinking messages exist */}
        {!isGenerating && thinking.length > 0 && (
          <motion.div
            className="w-full flex flex-row justify-center items-start px-3 pb-4 m-0 bg-[#343541] justify-start" // Align left like assistant messages
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-[#40414f] text-[#c5c5d2] rounded-lg shadow-md max-w-xl w-full text-left overflow-hidden self-start ml-3">
              <div
                className="flex items-center justify-between px-4 py-2 cursor-pointer select-none"
                onClick={toggleThinkingDetails} // Use the new toggle state
              >
                <div className="flex items-center">
                   {/* No loading animation needed here as it shows after done */}
                  <span className="font-semibold">Thoughts/Steps:</span>
                </div>
                {showThinkingDetails ? <FiChevronUp /> : <FiChevronDown />} {/* Toggle Icon */}
              </div>
              <AnimatePresence>
                {showThinkingDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-4 py-2 border-t border-[#565869] overflow-hidden"
                  >
                    <ul className="list-disc list-inside text-sm marker:text-[#57a3eb]"> {/* Added marker color */}
                      {thinking.map((step, stepIdx) => (
                        <li key={stepIdx} className="mb-1">{step}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
        {/* Add padding at the bottom to prevent input area from covering last message */}
        <div className="pb-24 flex-none"></div> {/* flex-none to prevent it from shrinking */}
      </div>

      {/* Input area - fixed at the bottom */}
      <div className="flex-none flex items-end gap-2 px-4 md:px-6 py-4 border-t border-[#2a2b32] bg-[#343541] shadow-lg sticky bottom-0 z-10 w-full justify-center"> {/* Adjusted padding, added shadow, w-full, justify-center */}
         <div className="relative flex items-center w-full max-w-3xl"> {/* Wrapper to control max width and position button */}
            <textarea
              id="prompt"
              placeholder="پیام به ChatGPT... (Enter برای ارسال، Shift+Enter برای خط جدید)" // Placeholder in Persian
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="flex-1 bg-[#40414f] text-[#ececf1] border-none rounded-lg pr-12 pl-4 py-3 text-lg resize-none min-h-[52px] max-h-[200px] outline-none shadow-md font-inherit placeholder-[#8e8ea0] focus:ring-2 focus:ring-[#19c37d] scrollbar-thin scrollbar-thumb-[#565869] scrollbar-track-[#40414f] overflow-y-auto" // Increased min-height, added right padding for button, increased max-height
              rows={1} // Start with one row
            />
            {isGenerating ? (
              <motion.button
                onClick={stopGenerating}
                className="absolute right-3 bottom-3 bg-red-500 text-white border-none rounded-md p-1.5 text-xl cursor-pointer transition duration-200 shadow-md flex items-center justify-center hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed z-20" // Position button inside textarea, adjusted size
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                disabled={!isGenerating}
                aria-label="Stop generation" // Accessibility label
              >
                <FiStopCircle /> {/* Stop Icon */}
              </motion.button>
            ) : (
              <motion.button
                id="submit"
                onClick={sendPrompt}
                className="absolute right-3 bottom-3 bg-[#19c37d] text-white border-none rounded-md p-1.5 text-xl cursor-pointer transition duration-200 shadow-md flex items-center justify-center hover:bg-[#15a06b] disabled:opacity-50 disabled:cursor-not-allowed z-20" // Position button inside textarea, adjusted size, used green color
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                disabled={!input.trim() || isGenerating}
                aria-label={input.trim() ? "Send message" : "Message input is empty"} // Accessibility label
              >
                <FiSend /> {/* Send Icon */}
              </motion.button>
            )}
         </div>
      </div>
    </div>
  );
};

export default ChatApp;