const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

// API Keys for AI Explanations (Hosted server-side for CORS compliance and security)
const GEMINI_API_KEY = "AIzaSyBHKqvrZRyiXBT1ALHov77NdbS_B5T4kQ0";
const GROQ_API_KEY = "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";
const OPENROUTER_API_KEY = "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";

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

let dbPool = null;

// Initialize MySQL database, create tables, and seed default questions if empty
async function initDB() {
    try {
        console.log("[MySQL] Connecting to local MySQL server...");
        // 1. Initial connection without database selection
        const tempConn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '1021'
        });
        
        // 2. Ensure database exists
        await tempConn.query('CREATE DATABASE IF NOT EXISTS psc_db');
        await tempConn.end();
        
        // 3. Establish persistent pool
        dbPool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: '1021',
            database: 'psc_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        
        console.log("[MySQL] Connected to database: psc_db");
        
        // 4. Create questions table
        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                answer VARCHAR(10) NOT NULL,
                source VARCHAR(50) NOT NULL,
                topic VARCHAR(100),
                posting VARCHAR(100) DEFAULT 'Fire & Rescue Officer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Dynamically ALTER table to add posting column if table already exists
        try {
            await dbPool.query("ALTER TABLE questions ADD COLUMN posting VARCHAR(100) DEFAULT 'Fire & Rescue Officer'");
            console.log("[MySQL] Added 'posting' column to existing schema.");
        } catch (alterErr) {
            // Column already exists, ignore
        }
        
        console.log("[MySQL] Verified questions table schema.");
        
        // 5. Seed default questions from questions.js if table is empty
        const [rows] = await dbPool.query('SELECT COUNT(*) as count FROM questions');
        if (rows[0].count === 0) {
            console.log("[MySQL] Table is empty. Seeding default questions from questions.js...");
            const qjsPath = path.resolve(__dirname, 'questions.js');
            if (fs.existsSync(qjsPath)) {
                let content = fs.readFileSync(qjsPath, 'utf8').trim();
                // Strip "const QUESTIONS = " prefix
                content = content.replace(/const\s+QUESTIONS\s*=\s*/, '');
                // Slice up to the first closing bracket of the array to strip comments/semicolons
                const endIdx = content.indexOf('];');
                if (endIdx !== -1) {
                    content = content.substring(0, endIdx + 1).trim();
                }
                
                // Parse questions array using safe eval context
                const parsedQ = eval(`(${content})`);
                if (Array.isArray(parsedQ)) {
                    for (const q of parsedQ) {
                        await dbPool.query(
                            'INSERT INTO questions (question, option_a, option_b, option_c, option_d, answer, source, topic, posting) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [
                                q.question,
                                q.options.A,
                                q.options.B,
                                q.options.C,
                                q.options.D,
                                q.answer,
                                'default',
                                q.topic || 'General Knowledge',
                                'Fire & Rescue Officer'
                            ]
                        );
                    }
                    console.log(`[MySQL] Successfully seeded ${parsedQ.length} default questions into database.`);
                }
            } else {
                console.warn("[MySQL] questions.js not found. Skipping seeding.");
            }
        }
        // Trigger background subject classification migration for existing/seeded questions
        updateExistingQuestions();
    } catch (err) {
        console.error("[MySQL] Connection/init failed. Ensure MySQL server is running on localhost with password 1021.", err);
    }
}

// Call DB Init
initDB();

// API Helper Calls for AI
async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini HTTP ${response.status}: ${text}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callGroq(prompt) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }]
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${text}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

async function callOpenRouter(prompt) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }]
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${text}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

async function requestAIExplanationServer(prompt) {
    try {
        console.log("[Node Server] Trying Gemini API...");
        return await callGemini(prompt);
    } catch (e) {
        console.warn("[Node Server] Gemini failed, trying Groq...", e.message);
        try {
            return await callGroq(prompt);
        } catch (groqErr) {
            console.warn("[Node Server] Groq failed, trying OpenRouter...", groqErr.message);
            try {
                return await callOpenRouter(prompt);
            } catch (orErr) {
                console.error("[Node Server] All AI pipelines failed.");
                throw new Error(`Failed. Errors: Gemini(${e.message}) | Groq(${groqErr.message}) | OpenRouter(${orErr.message})`);
            }
        }
    }
}

// Batch categorizer: Takes a list of questions and calls the AI to assign subjects
async function categorizeQuestionsBatch(questions) {
    if (questions.length === 0) return [];
    
    console.log(`[Categorization] Querying AI for batch of ${questions.length} questions...`);
    const questionsText = questions.map((q, idx) => `ID: ${idx} (Posting: ${q.posting || 'General'})\nQuestion: ${q.question}`).join('\n\n');
    
    const prompt = `You are an expert Kerala PSC exam classifier.
Your task is to categorize each of the exam questions below into exactly one of these allowed categories:
- subject_specialization (Job-specific or posting-specific vocational questions directly related to the posting's duties. For example, if the posting is related to Fireman or Fire & Rescue, categorize questions about firefighting, extinguishing fire, rescue gear, first aid for burns, fire safety, or fire chemistry as 'subject_specialization'. For other postings, categorize questions about their specific vocational duties here.)
- language_english (English grammar, vocabulary, usage)
- language_malayalam (Malayalam grammar, vocabulary, literature)
- history (Indian History, Kerala History, World History, historical dates/treaties/movements)
- mathematics (Maths, mental ability, calculations, arithmetic, averages, profit/loss, sequences)
- chemistry (Chemicals, elements, reactions, compounds, metals, gases - NOT related to firefighting/fire extinguishing if posting is Fireman)
- physics (Mechanics, optics, thermodynamics, units, forces, electricity)
- biology (Human body, botany, zoology, diseases, vitamins, environment)
- geography (Mountains, rivers, states, maps, space, weather)
- constitution_and_civics (Indian Constitution, human rights, laws, governance)
- current_affairs (Recent events, news, awards)
- general_knowledge (General facts not covered by other subjects)

Questions list:
${questionsText}

Respond ONLY as a valid JSON object mapping each question's ID string to its category string, like this:
{
  "0": "subject_specialization",
  "1": "mathematics"
}
Do not include any markdown formatting, no \`\`\`json block, and no other text wrapper.`;

    try {
        let responseText = await requestAIExplanationServer(prompt);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const mapping = JSON.parse(responseText);
        
        const results = [];
        for (let i = 0; i < questions.length; i++) {
            const cat = mapping[String(i)] || 'general_knowledge';
            results.push({ id: questions[i].id, category: cat });
        }
        return results;
    } catch (err) {
        console.error("[Categorization] Batch failed, falling back:", err.message);
        return questions.map(q => ({ id: q.id, category: 'general_knowledge' }));
    }
}

// Background Migration: Classifies uncategorized and posting-specific questions already in the database
async function updateExistingQuestions() {
    if (!dbPool) return;
    try {
        // Retrieve questions that are currently uncategorized OR are in broad classes that could contain posting-specific firefighting/first-aid questions
        const [rows] = await dbPool.query(`
            SELECT id, question, posting FROM questions 
            WHERE topic IN ('general_knowledge', 'chemistry', 'physics', 'biology', 'default', 'General Knowledge', 'Custom Upload')
               OR topic IS NULL
        `);
        
        if (rows.length === 0) {
            console.log("[Categorization] All eligible database questions are already classified.");
            return;
        }
        
        console.log(`[Categorization] Found ${rows.length} questions to check/re-categorize. Starting background task...`);
        
        const batchSize = 25;
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            console.log(`[Categorization] Analyzing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(rows.length / batchSize)}...`);
            const classifications = await categorizeQuestionsBatch(batch);
            
            for (const item of classifications) {
                await dbPool.query('UPDATE questions SET topic = ? WHERE id = ?', [item.category, item.id]);
            }
            if (i + batchSize < rows.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // sleep 2s
            }
        }
        console.log("[Categorization] Database subject classification check completed successfully.");
    } catch (err) {
        console.error("[Categorization] Database subject classification check error:", err);
    }
}

// Background Task: Generate 5 similar questions based on the topic of the question just answered
async function generate5SimilarQuestions(qObj) {
    console.log(`[AI Ingestion] Triggering background generation of 5 similar questions for topic: ${qObj.topic}...`);
    
    const prompt = `You are an expert examiner writing questions for the Kerala PSC Fire & Rescue Officer exam.
Analyze the following question that a candidate just answered:
Question: ${qObj.question.replace(/<br>/g, '\n')}
Options:
A: ${qObj.option_a}
B: ${qObj.option_b}
C: ${qObj.option_c}
D: ${qObj.option_d}
Correct Answer: Option ${qObj.answer}
Topic: ${qObj.topic || 'General Knowledge'}

Generate exactly 5 new similar practice questions testing the same concept, category, or related facts.
- The new questions must have different wording, values, or target details.
- If the original question is in Malayalam, the new questions must be in Malayalam (using Malayalam script). If in English, they must be in English.
- Each question must have exactly 4 choices (A, B, C, D) and 1 correct answer (A, B, C, or D).

Output your response ONLY as a valid JSON array of objects, containing no markdown formatting, no \`\`\`json blocks, and no surrounding text wrappers.
JSON structure:
[
  {
    "question": "Question text...",
    "options": {
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    },
    "answer": "A",
    "topic": "${qObj.topic || 'General Knowledge'}"
  },
  ...
]`;

    try {
        let responseText = await requestAIExplanationServer(prompt);
        // Clean markdown blocks if returned
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const newQuestions = JSON.parse(responseText);
        if (Array.isArray(newQuestions) && dbPool) {
            for (const q of newQuestions) {
                await dbPool.query(
                    'INSERT INTO questions (question, option_a, option_b, option_c, option_d, answer, source, topic, posting) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        q.question,
                        q.options.A,
                        q.options.B,
                        q.options.C,
                        q.options.D,
                        q.answer,
                        'ai_generated',
                        q.topic || qObj.topic || 'General Knowledge',
                        qObj.posting || 'Fire & Rescue Officer'
                    ]
                );
            }
            console.log(`[AI Ingestion] Successfully generated and inserted 5 similar questions into database.`);
        }
    } catch (err) {
        console.error("[AI Ingestion] Failed to generate similar questions in background:", err.message);
    }
}

const server = http.createServer((req, res) => {
    const decodedUrl = decodeURIComponent(req.url);
    
    // 1. API Endpoint: AI Explanation Proxy
    if (decodedUrl.startsWith('/api/explain') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { prompt } = JSON.parse(body);
                const explanation = await requestAIExplanationServer(prompt);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ explanation }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // 2. API Endpoint: Save Ingested Questions from PDF/Image Uploads
    if (decodedUrl.startsWith('/api/save-questions') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                if (!dbPool) throw new Error("Database not connected.");
                const { questions, source, posting } = JSON.parse(body);
                
                console.log(`[Categorization] Classifying ${questions.length} uploaded questions in batches before save...`);
                const batchSize = 25;
                const categorizedQuestions = [];
                
                for (let i = 0; i < questions.length; i += batchSize) {
                    const batch = questions.slice(i, i + batchSize);
                    const batchFormatted = batch.map((q, idx) => ({ id: idx, question: q.question, posting: posting }));
                    
                    const classifications = await categorizeQuestionsBatch(batchFormatted);
                    
                    batch.forEach((q, idx) => {
                        q.topic = classifications[idx]?.category || 'general_knowledge';
                        categorizedQuestions.push(q);
                    });
                    
                    if (i + batchSize < questions.length) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
                
                for (const q of categorizedQuestions) {
                    await dbPool.query(
                        'INSERT INTO questions (question, option_a, option_b, option_c, option_d, answer, source, topic, posting) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            q.question,
                            q.options.A,
                            q.options.B,
                            q.options.C,
                            q.options.D,
                            q.answer,
                            source || 'pdf_upload',
                            q.topic,
                            posting || 'Fire & Rescue Officer'
                        ]
                    );
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: questions.length }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // 2.5 API Endpoint: Flag/Correct Wrong Answer Key in Database
    if (decodedUrl.startsWith('/api/flag-question') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                if (!dbPool) throw new Error("Database not connected.");
                const { questionId, questionText, correctOption, reason } = JSON.parse(body);
                
                let query = '';
                let params = [];
                
                if (questionId) {
                    query = 'UPDATE questions SET answer = ? WHERE id = ?';
                    params = [correctOption, questionId];
                } else if (questionText) {
                    query = 'UPDATE questions SET answer = ? WHERE question = ?';
                    params = [correctOption, questionText];
                } else {
                    throw new Error("No identifier (id or text) provided for correction.");
                }
                
                const [result] = await dbPool.query(query, params);
                console.log(`[MySQL Flag] Updated correct key for question ID ${questionId || 'text'} to: ${correctOption}. Reason: ${reason || 'None'}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, affectedRows: result.affectedRows }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // 3. API Endpoint: Fetch random question for Infinite Practice Mode
    if (decodedUrl.startsWith('/api/get-infinite-question') && req.method === 'GET') {
        (async () => {
            try {
                if (!dbPool) throw new Error("Database not initialized.");
                
                // Fetch a random question from our MySQL database
                const [rows] = await dbPool.query('SELECT * FROM questions ORDER BY RAND() LIMIT 1');
                
                if (rows.length > 0) {
                    const q = rows[0];
                    const qFormatted = {
                        id: q.id,
                        question: q.question,
                        options: {
                            A: q.option_a,
                            B: q.option_b,
                            C: q.option_c,
                            D: q.option_d
                        },
                        answer: q.answer,
                        source: q.source,
                        topic: q.topic || 'General Knowledge',
                        posting: q.posting || 'Fire & Rescue Officer'
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ question: qFormatted }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "No questions found in database." }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        })();
        return;
    }
    
    // 4. API Endpoint: Log answer submission and trigger 5x AI generation in the background
    if (decodedUrl.startsWith('/api/answer-question') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                if (!dbPool) throw new Error("Database not initialized.");
                const { questionId } = JSON.parse(body);
                
                // Fetch the question details from database
                const [rows] = await dbPool.query('SELECT * FROM questions WHERE id = ?', [questionId]);
                
                if (rows.length > 0) {
                    const qObj = rows[0];
                    // Trigger the 5x question generation asynchronously in the background
                    generate5SimilarQuestions(qObj);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: "Response received. Generating 5 similar questions in background." }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Question not found." }));
                }
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }
    
    // Static Files Server route
    let filePath = decodedUrl === '/' ? './index.html' : '.' + decodedUrl;
    filePath = path.resolve(__dirname, filePath);
    
    // Safety check to prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.statusCode = 404;
                res.end('404 Not Found');
            } else {
                res.statusCode = 500;
                res.end('500 Internal Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
