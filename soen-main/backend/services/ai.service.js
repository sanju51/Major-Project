import axios from "axios";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL = "deepseek-coder";

const systemInstruction = `You are an expert MERN developer.
Your goal is to help users build and modify projects.

When creating or modifying a project:
1. You MUST return a JSON object with two fields: "text" and "fileTree".
2. The "fileTree" MUST contain all necessary files for the project to RUN.
3. For NEW projects, ALWAYS include a "package.json" with a "scripts" section containing "start": "node index.js" (or similar).
4. For WEB projects, ALWAYS include an "index.html" as the entry point.
5. The structure for files MUST be: {"filename": {"file": {"contents": "full code here"}}}
6. Do NOT use numeric keys like "0", "1".
7. Ensure all code is COMPLETE and functional. No placeholders like "// code here".

IMPORTANT: The "text" field should explain what you built and how to run it.

Example for a basic app:
{
  "text": "I've created a basic web app for you. Click 'Run' to start.",
  "fileTree": {
    "index.html": {
      "file": {
        "contents": "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>"
      }
    },
    "package.json": {
      "file": {
        "contents": "{\n  \"name\": \"basic-app\",\n  \"scripts\": {\n    \"start\": \"serve .\"\n  }\n}"
      }
    }
  }
}
`;

const taskAssistantInstruction = `You are an AI Task Assistant for a Project Management System. Your job is to help with task management.

When asked to generate subtasks:
- Return an array of subtask objects with title and optional description
- Example: { "subtasks": [ { "title": "Set up project repository", "description": "Initialize git repo and add .gitignore" }, { "title": "Install dependencies", "description": "Install npm packages" } ] }

When asked to suggest deadlines:
- Consider the task complexity and current date
- Return deadline in ISO format
- Example: { "deadline": "2024-01-15T17:00:00.000Z", "reason": "Based on task complexity, 3 days is reasonable" }

When asked to recommend assignees:
- Consider past performance and skill set
- Example: { "recommendedAssignee": "userId123", "reason": "Has similar completed tasks with 95% on-time rate" }

Always return valid JSON.`;

const ollamaGenerate = async (prompt, system) => {
    try {
        console.log(`🤖 AI Request: ${prompt.substring(0, 100)}...`);
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: `${system}\n\nUser: ${prompt}`,
            stream: false,
            format: "json"
        }, {
            timeout: 180000 // 3 minute timeout for local generation
        });
        
        return response.data.response;
    } catch (error) {
        console.error("❌ Ollama error:", error.message);
        throw error;
    }
};

const ollamaGenerateStream = async (prompt, system, onChunk) => {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: `${system}\n\nUser: ${prompt}`,
            stream: true,
            format: "json"
        }, {
            responseType: 'stream',
            timeout: 300000
        });

        response.data.on('data', chunk => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        onChunk(json.response);
                    }
                    if (json.done) {
                        onChunk(null, true);
                    }
                } catch (e) {
                    // Incomplete JSON chunk, ignore
                }
            }
        });
    } catch (error) {
        console.error("❌ Ollama stream error:", error.message);
        throw error;
    }
};

export const generateResult = async (prompt, fileTree = {}) => {
    const fileList = Object.keys(fileTree).join(", ");
    const contextTree = {};
    Object.keys(fileTree).forEach(key => {
        if (fileTree[key].file) {
            contextTree[key] = {
                content: fileTree[key].file.contents.substring(0, 5000)
            };
        } else {
            contextTree[key] = { type: "directory" };
        }
    });

    const contextStr = `Existing Files: ${fileList}\n\nCurrent File Contents:\n${JSON.stringify(contextTree, null, 2)}\n\n`;
    const fullPrompt = `${contextStr}User Request: ${prompt}\n\nINSTRUCTIONS:\n1. Respond with a valid JSON object.\n2. Include a "text" field for your explanation.\n3. Include a "fileTree" field ONLY for files you want to CREATE or MODIFY.\n4. Do NOT include files that don't need changes.\n5. Ensure all code in "fileTree" is complete and functional.`;
    
    return await ollamaGenerate(fullPrompt, systemInstruction);
};

export const generateResultStream = async (prompt, fileTree = {}, onChunk) => {
    const fileList = Object.keys(fileTree).join(", ");
    const contextTree = {};
    Object.keys(fileTree).forEach(key => {
        if (fileTree[key].file) {
            contextTree[key] = {
                content: fileTree[key].file.contents.substring(0, 5000)
            };
        } else {
            contextTree[key] = { type: "directory" };
        }
    });

    const contextStr = `Existing Files: ${fileList}\n\nCurrent File Contents:\n${JSON.stringify(contextTree, null, 2)}\n\n`;
    const fullPrompt = `${contextStr}User Request: ${prompt}\n\nINSTRUCTIONS:\n1. Respond with a valid JSON object.\n2. Include a "text" field for your explanation.\n3. Include a "fileTree" field ONLY for files you want to CREATE or MODIFY.\n4. Do NOT include files that don't need changes.\n5. Ensure all code in "fileTree" is complete and functional.`;
    
    return await ollamaGenerateStream(fullPrompt, systemInstruction, onChunk);
};

export const generateSubtasks = async (taskDescription) => {
    const prompt = `Generate subtasks for this task: "${taskDescription}". Return only JSON.`;
    return await ollamaGenerate(prompt, taskAssistantInstruction);
};

export const suggestDeadline = async (taskTitle, complexity = 'medium') => {
    const prompt = `Suggest a deadline for this task: "${taskTitle}" with ${complexity} complexity. Consider today's date is ${new Date().toISOString()}. Return only JSON.`;
    return await ollamaGenerate(prompt, taskAssistantInstruction);
};

export const summarizeMeeting = async (meetingNotes) => {
    const instruction = `You are an AI Meeting Summarizer. Given meeting notes, extract:
1. Summary of the meeting
2. Action items with assignee and deadline
3. Tasks to create

Return JSON with: { "summary": "string", "actionItems": [ { "task": "string", "assignee": "string", "deadline": "string" } ], "tasksToCreate": [ { "title": "string", "description": "string" } ] }`;
    return await ollamaGenerate(meetingNotes, instruction);
};

export const predictRisks = async (projectData) => {
    const instruction = `You are an AI Risk Predictor. Given project data, predict:
1. Delayed tasks/projects
2. Budget overruns
3. Overloaded employees

Return JSON with: { "delayedTasks": [ { "taskId": "string", "reason": "string" } ], "budgetRisk": { "riskLevel": "low|medium|high", "explanation": "string" }, "overloadedEmployees": [ { "userId": "string", "reason": "string" } ] }`;
    return await ollamaGenerate(JSON.stringify(projectData), instruction);
};

export const divideTasksFromDocument = async (documentContent, projectContext) => {
    const instruction = `You are a project manager. Analyze the following document content and project context. 
    Break down the project into granular tasks. 
    For each task, provide: title, description, priority (low, medium, high, urgent), and suggested status (todo).
    
    Project Context: ${JSON.stringify(projectContext)}
    
    Return a JSON array of task objects.`;
    
    const responseText = await ollamaGenerate(documentContent, instruction);
    try {
        const tasks = JSON.parse(responseText);
        return Array.isArray(tasks) ? tasks : tasks.tasks || [];
    } catch (e) {
        console.error("Failed to parse AI response:", e);
        return [];
    }
};