import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

const codeModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
    },
    systemInstruction: `You are an expert in MERN and Development. You have an experience of 10 years in the development. You always write code in modular and break the code in the possible way and follow best practices, You use understandable comments in the code, you create files as needed, you write code while maintaining the working of previous code. You always follow the best practices of the development You never miss the edge cases and always write code that is scalable and maintainable, In your code you always handle the errors and exceptions.
    
    Examples: 

    <example>
 
    response: {

    "text": "this is you fileTree structure of the express server",
    "fileTree": {
        "app.js": {
            file: {
                contents: "
                const express = require('express');

                const app = express();


                app.get('/', (req, res) => {
                    res.send('Hello World!');
                });


                app.listen(3000, () => {
                    console.log('Server is running on port 3000');
                })
                "
            
        },
    },

        "package.json": {
            file: {
                contents: "

                {
                    "name": "temp-server",
                    "version": "1.0.0",
                    "main": "index.js",
                    "scripts": {
                        "test": "echo \"Error: no test specified\" && exit 1"
                    },
                    "keywords": [],
                    "author": "",
                    "license": "ISC",
                    "description": "",
                    "dependencies": {
                        "express": "^4.21.2"
                    }
}

                
                "
                
                

            },

        },

    },
    "buildCommand": {
        mainItem: "npm",
            commands: [ "install" ]
    },

    "startCommand": {
        mainItem: "node",
            commands: [ "app.js" ]
    }
}

    user:Create an express application 
   
    </example>


    
       <example>

       user:Hello 
       response:{
       "text":"Hello, How can I help you today?"
       }
       
       </example>
    
 IMPORTANT : don't use file name like routes/index.js
       
       
    `
});

const taskAssistantModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
    },
    systemInstruction: `You are an AI Task Assistant for a Project Management System. Your job is to help with task management.

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

Always return valid JSON.`
});

export const generateResult = async (prompt) => {
    const result = await codeModel.generateContent(prompt);
    return result.response.text();
};

export const generateSubtasks = async (taskDescription) => {
    const prompt = `Generate subtasks for this task: "${taskDescription}". Return only JSON.`;
    const result = await taskAssistantModel.generateContent(prompt);
    return result.response.text();
};

export const suggestDeadline = async (taskTitle, complexity = 'medium') => {
    const prompt = `Suggest a deadline for this task: "${taskTitle}" with ${complexity} complexity. Consider today's date is ${new Date().toISOString()}. Return only JSON.`;
    const result = await taskAssistantModel.generateContent(prompt);
    return result.response.text();
};

export const summarizeMeeting = async (meetingNotes) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        },
        systemInstruction: `You are an AI Meeting Summarizer. Given meeting notes, extract:
1. Summary of the meeting
2. Action items with assignee and deadline
3. Tasks to create

Return JSON with: { "summary": "string", "actionItems": [ { "task": "string", "assignee": "string", "deadline": "string" } ], "tasksToCreate": [ { "title": "string", "description": "string" } ] }`
    });
    const result = await model.generateContent(meetingNotes);
    return result.response.text();
};

export const predictRisks = async (projectData) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        },
        systemInstruction: `You are an AI Risk Predictor. Given project data, predict:
1. Delayed tasks/projects
2. Budget overruns
3. Overloaded employees

Return JSON with: { "delayedTasks": [ { "taskId": "string", "reason": "string" } ], "budgetRisk": { "riskLevel": "low|medium|high", "explanation": "string" }, "overloadedEmployees": [ { "userId": "string", "reason": "string" } ] }`
    });
    const result = await model.generateContent(JSON.stringify(projectData));
    return result.response.text();
};