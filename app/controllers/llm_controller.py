from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
import asyncio
import json
import time
import random
import uuid
from datetime import datetime

router = APIRouter()

@router.get("/api/llm/stream")
async def stream_llm_response(prompt: str = Query(...)):
    async def event_generator():
        request_id = str(uuid.uuid4())
        start_time = time.time()
        total_tokens = 0
        completion_tokens = 0
        thinking_steps = [
            "Analyzing the prompt...",
            "Gathering components for the response...",
            "Structuring the output..."
        ]
        for step in thinking_steps:
            if "error" in prompt.lower() and random.random() < 0.3:
                error_data = {
                    "message": "An error occurred during processing: Simulated error",
                    "request_id": request_id,
                    "timestamp": datetime.now().isoformat()
                }
                yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
                return
            thinking_data = {
                "content": step,
                "timestamp": datetime.now().isoformat()
            }
            yield f"event: thinking\ndata: {json.dumps(thinking_data)}\n\n"
            await asyncio.sleep(0.5)
            total_tokens += len(step.split())
        response_chunks = []
        prompt_lower = prompt.lower()
        line_chart = {
            "data": [
                {
                    "type": "scatter", "mode": "lines", "name": "Series A",
                    "x": [1, 2, 3, 4, 5], "y": [10, 15, 13, 17, 15],
                    "line": {"color": "rgb(75, 192, 192)"}
                }
            ],
            "layout": {"title": "Simple Line Chart", "height": 300}
        }
        flowchart = """```mermaid\nflowchart LR\n    A[Idea] --> B{Plan?}\n    B -->|Yes| C[Execute]\n    B -->|No| A\n    C --> D[Done]\n```"""
        datatables_table_config = {
            "data": [
                {"name":"Oli Bob", "age":"12", "city":"London", "progress":50, "gender":"male"},
                {"name":"Mary May", "age":"1", "city":"Madrid", "progress":90, "gender":"female"},
                {"name":"Christine Lobowski", "age":"42", "city":"Paris", "progress":42, "gender":"female"},
                {"name":"Brendon Philips", "age":"125", "city":"Dublin", "progress":100, "gender":"male"},
                {"name":"Margret Marmajuke", "age":"16", "city":"Canada", "progress":12, "gender":"female"},
                {"name":"Frankie Peters", "age":"30", "city":"Manchester", "progress":50, "gender":"male"},
                {"name":"Lane McMasters", "age":"20", "city":"Birmingham", "progress":60, "gender":"female"},
                {"name":"Jenson Brown", "age":"40", "city":"London", "progress":30, "gender":"male"},
                {"name":"Jamie John", "age":"25", "city":"Madrid", "progress":70, "gender":"male"},
                {"name":"Cathy James", "age":"17", "city":"Edinburgh", "progress":10, "gender":"female"},
            ],
            "columns": [
                {"title":"Name", "data":"name"},
                {"title":"Age", "data":"age"},
                {"title":"City", "data":"city"},
                {"title":"Progress", "data":"progress"},
                {"title":"Gender", "data":"gender"},
            ],
             "paging": True,
             "searching": True,
             "ordering": True,
             "info": True,
             "pageLength": 5
        }
        if "error" in prompt_lower:
            response_chunks = [
                "# Simulating an Error\n\n",
                "Processing your request, but expecting an error...\n\n"
            ]
            for chunk in response_chunks:
                chunk_data = {"content": chunk, "timestamp": datetime.now().isoformat()}
                yield f"event: chunk\ndata: {json.dumps(chunk_data)}\n\n"
                await asyncio.sleep(0.3)
                completion_tokens += len(chunk.split())
            error_data = {
                "message": "Model execution failed: Simulated error after content",
                "request_id": request_id,
                "timestamp": datetime.now().isoformat()
            }
            yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
            return
        elif "all" in prompt_lower:
            response_chunks = [
                "# Demonstration of All Components\n\n",
                "This response showcases various rendering capabilities:\n\n",
                "## Markdown Features\n\n",
                "Here's a standard markdown list:\n\n",
                "- First item\n- Second item\n- Third item\n\n",
                "And a simple **bold** and *italic* text example.\n\n",
                "## Math Rendering\n\n",
                "Inline math: The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.\n\n",
                "Display math:\n\n",
                "$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\n",
                "## Plotly Chart\n\n",
                "Here is an embedded interactive line chart:\n\n",
                "```plotly\n" + json.dumps(line_chart) + "\n```\n\n",
                "## Mermaid Diagram\n\n",
                "Visualizing a simple process with a flowchart:\n\n",
                flowchart + "\n\n",
                "## Interactive Table (DataTables)\n\n",
                "Here is an interactive table with sorting, filtering, and pagination:\n\n",
                 "```datatables\n" + json.dumps(datatables_table_config) + "\n```\n\n",
                "## Simple Markdown Table\n\n",
                "Data can also be presented in simple markdown tables:\n\n",
                "| Header 1 | Header 2 | Header 3 |\n",
                "|----------|----------|----------|\n",
                "| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |\n",
                "| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |\n",
                "| Row 3, Col 1 | Row 3, Col 2 | Row 3, Col 3 |\n\n",
                "This concludes the demonstration of all components."
            ]
        elif "table" in prompt_lower:
            response_chunks = [
                "# Interactive Table Demonstration (DataTables)\n\n",
                "This section demonstrates an interactive table using the DataTables.js library.\n\n",
                "You can sort columns by clicking on the headers, filter using the search box, and navigate through pages.\n\n",
                "```datatables\n" + json.dumps(datatables_table_config) + "\n```\n\n",
                "This table includes features like sorting, filtering, pagination, and basic styling."
            ]
        elif "math" in prompt_lower:
            response_chunks = [
                "# Math Rendering Example\n\n",
                "You can include inline math like $E = mc^2$ or display equations:\n\n",
                "$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n",
                "More complex examples:\n\n",
                "$$\\begin{aligned}\n\\nabla \\times \\vec{\\mathbf{B}} -\\, \\frac{1}{c}\\, \\frac{\\partial\\vec{\\mathbf{E}}}{\\partial t} & = \\frac{4\\pi}{c}\\vec{\\mathbf{j}} \\\\n\\nabla \\cdot \\vec{\\mathbf{E}} & = 4 \\pi \\rho \\\\n\\nabla \\times \\vec{\\mathbf{E}}\\, +\\, \\frac{1}{c}\\, \\frac{\\partial\\vec{\\mathbf{B}}}{\\partial t} & = \\vec{\\mathbf{0}} \\\\n\\nabla \\cdot \\vec{\\mathbf{B}} & = 0\\end{aligned}$$\n\n",
                "You can also include inline math within text explanations: If $\\alpha > \\beta$ then we need to recalculate $\\gamma = \\frac{\\alpha - \\beta}{2}$ to balance the equation."
            ]
        elif "chart" in prompt_lower:
            line_chart_full = {
                "data": [
                    {
                        "type": "scatter",
                        "mode": "lines",
                        "name": "Website Traffic",
                        "x": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
                        "y": [65, 59, 80, 81, 56, 55, 40],
                        "line": {"color": "rgb(75, 192, 192)"}
                    },
                    {
                        "type": "scatter",
                        "mode": "lines",
                        "name": "Conversion Rate",
                        "x": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
                        "y": [28, 48, 40, 19, 86, 27, 90],
                        "line": {"color": "rgb(255, 99, 132)"}
                    }
                ],
                "layout": {
                    "title": "Monthly Website Performance",
                    "xaxis": {"title": "Month"},
                    "yaxis": {"title": "Value"},
                    "height": 400
                }
            }
            bar_chart = {
                "data": [
                    {
                        "type": "bar",
                        "x": ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
                        "y": [12, 19, 3, 5, 2, 3],
                        "marker": {
                            "color": [
                                "rgba(255, 99, 132, 0.8)",
                                "rgba(54, 162, 235, 0.8)",
                                "rgba(255, 206, 86, 0.8)",
                                "rgba(75, 192, 192, 0.8)",
                                "rgba(153, 102, 255, 0.8)",
                                "rgba(255, 159, 64, 0.8)"
                            ]
                        }
                    }
                ],
                "layout": {
                    "title": "Survey Results",
                    "xaxis": {"title": "Color"},
                    "yaxis": {"title": "Votes"},
                    "height": 400
                }
            }
            response_chunks = [
                "# Plotly Chart Demonstration\n\n",
                "Interactive charts can be embedded using Plotly. Here's a line chart showing website performance:\n\n",
                "```plotly\n" + json.dumps(line_chart_full) + "\n```\n\n",
                "Bar charts are excellent for categorical comparisons:\n\n",
                "```plotly\n" + json.dumps(bar_chart) + "\n```\n\n",
                "These charts are fully interactive - you can hover over data points, zoom, pan, and even download them as images."
            ]
        elif "diagram" in prompt_lower:
            flowchart_full = """```mermaid\nflowchart TD\n    A[Start] --> B{Is it working?}\n    B -->|Yes| C[Great!]\n    B -->|No| D[Debug]\n    D --> B\n```"""
            sequence = """```mermaid\nsequenceDiagram\n    participant Client\n    participant Server\n    participant LLM\n    Client->>Server: Send prompt\n    Server->>LLM: Process prompt\n    LLM-->>Server: Return thinking steps\n    Server-->>Client: Stream thinking\n    LLM-->>Server: Return response chunks\n    Server-->>Client: Stream response\n    Note right of Client: Renders progressively\n```"""
            class_diagram = """```mermaid\nclassDiagram\n    class StreamingService {\n        +process_prompt()\n        +stream_response()\n    }\n    class LLMProvider {\n        -model: string\n        +generate_response()\n        +stream_thinking()\n    }\n    class Client {\n        +display_response()\n        +render_markdown()\n    }\n    StreamingService --> LLMProvider\n    Client --> StreamingService\n```"""
            response_chunks = [
                "# Diagram Demonstration\n\n",
                "Diagrams can be created using Mermaid syntax. Here's a flowchart:\n\n",
                flowchart_full + "\n\n",
                "You can also create sequence diagrams to show interactions:\n\n",
                sequence + "\n\n",
                "Or class diagrams for system architecture:\n\n",
                class_diagram + "\n\n",
                "Diagrams are great for explaining complex processes and relationships."
            ]
        else:
            response_chunks = [
                "# Standard Markdown Response\n\n",
                "This is a standard markdown response with **bold text**, *italic text*, and a list:\n\n",
                "- Item 1\n- Item 2\n- Item 3\n\n",
                "You can also include [links](https://example.com) and `inline code`.\n\n",
                "```python\n# Code blocks are supported\ndef hello_world():\n    print('Hello, World!')\n```\n\n",
                "That's the basic functionality demonstration! Try typing 'math', 'chart', 'diagram', 'table', 'all', or 'error'."
            ]
        for chunk in response_chunks:
            chunk_data = {
                "content": chunk,
                "timestamp": datetime.now().isoformat()
            }
            yield f"event: chunk\ndata: {json.dumps(chunk_data)}\n\n"
            await asyncio.sleep(0.1)
            completion_tokens += len(chunk.split())
        time_taken = time.time() - start_time
        done_data = {
            "message": "Response complete",
            "metadata": {
                "request_id": request_id,
                "total_tokens": total_tokens + completion_tokens,
                "completion_tokens": completion_tokens,
                "time_taken": time_taken
            },
            "timestamp": datetime.now().isoformat()
        }
        yield f"event: done\ndata: {json.dumps(done_data)}\n\n"
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
