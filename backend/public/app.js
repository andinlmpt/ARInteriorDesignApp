// AR Interior Design - Dashboard App

const API_BASE = '/api/v1';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initBudgetSelector();
    initDesignForm();
    checkServerStatus();
    loadApiEndpoints();
    
    // Update stats periodically
    updateDashboardStats();
    setInterval(checkServerStatus, 30000);
});

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(sectionId) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
    
    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    
    // Update header
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Welcome to AR Interior Design Studio' },
        design: { title: 'AI Design', subtitle: 'Generate beautiful room designs with AI' },
        themes: { title: 'Themes', subtitle: 'Discover personalized theme recommendations' },
        ideas: { title: 'Ideas', subtitle: 'Get AI-powered design suggestions' },
        api: { title: 'API', subtitle: 'Explore and test the REST API' }
    };
    
    const info = titles[sectionId] || titles.dashboard;
    document.getElementById('page-title').textContent = info.title;
    document.getElementById('page-subtitle').textContent = info.subtitle;
}

// ============================================================================
// SERVER STATUS
// ============================================================================

async function checkServerStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        const statusEl = document.getElementById('server-status');
        const statusDot = document.querySelector('.status-dot');
        
        if (data.status === 'ok') {
            statusEl.textContent = 'Server Online';
            statusDot.style.background = '#10B981';
            
            // Update uptime
            const uptime = formatUptime(data.uptime);
            document.getElementById('api-uptime').textContent = uptime;
        } else {
            statusEl.textContent = 'Server Error';
            statusDot.style.background = '#EF4444';
        }
        
        // Check AI capabilities
        checkAICapabilities();
        
    } catch (error) {
        document.getElementById('server-status').textContent = 'Offline';
        document.querySelector('.status-dot').style.background = '#EF4444';
    }
}

async function checkAICapabilities() {
    try {
        const response = await fetch(`${API_BASE}/ideas/status`);
        const data = await response.json();
        
        const dalleStatus = document.getElementById('dalle-status');
        const gptStatus = document.getElementById('gpt-status');
        
        if (data.aiEnabled) {
            dalleStatus.textContent = 'Active';
            dalleStatus.classList.add('active');
            gptStatus.textContent = 'Active';
            gptStatus.classList.add('active');
        } else {
            dalleStatus.textContent = 'No API Key';
            gptStatus.textContent = 'No API Key';
        }
    } catch (error) {
        console.warn('Could not check AI capabilities:', error);
    }
}

function formatUptime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

async function updateDashboardStats() {
    try {
        // Get training stats for designs count
        const statsResponse = await fetch(`${API_BASE}/training/stats`);
        const stats = await statsResponse.json();
        
        document.getElementById('total-designs').textContent = stats.totalGenerations || 0;
        document.getElementById('total-ideas').textContent = stats.likedDesigns || 0;
        
    } catch (error) {
        console.warn('Could not load stats:', error);
        document.getElementById('total-designs').textContent = '0';
        document.getElementById('total-ideas').textContent = '0';
    }
}

// ============================================================================
// BUDGET SELECTOR
// ============================================================================

function initBudgetSelector() {
    document.querySelectorAll('.budget-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.budget-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('budget').value = btn.dataset.value;
        });
    });
}

// ============================================================================
// DESIGN FORM
// ============================================================================

function initDesignForm() {
    const form = document.getElementById('design-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateDesign();
    });
}

async function generateDesign() {
    const resultDiv = document.getElementById('design-result');
    
    // Show loading
    resultDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <span>Generating your design...</span>
        </div>
    `;
    
    const formData = {
        roomType: document.getElementById('room-type').value,
        designStyle: document.getElementById('design-style').value,
        dimensions: {
            width: parseFloat(document.getElementById('room-width').value),
            length: parseFloat(document.getElementById('room-length').value),
            height: parseFloat(document.getElementById('room-height').value)
        },
        budget: document.getElementById('budget').value,
        prompt: document.getElementById('design-prompt').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/designs/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                preferences: {
                    roomType: formData.roomType,
                    designStyle: formData.designStyle,
                    dimensions: formData.dimensions,
                    budget: formData.budget
                },
                constraints: {
                    minimumWalkwayDistance: 0.9,
                    doorClearance: 0.8
                },
                options: {
                    optimizationGoal: 'balanced',
                    numberOfVariations: 3
                }
            })
        });
        
        const data = await response.json();
        displayDesignResult(data, formData);
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Failed to generate design: ${error.message}</p>
            </div>
        `;
    }
}

function displayDesignResult(data, formData) {
    const resultDiv = document.getElementById('design-result');
    
    if (!data.proposals || data.proposals.length === 0) {
        resultDiv.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎨</span>
                <p>No designs generated. Try different parameters.</p>
            </div>
        `;
        return;
    }
    
    const proposal = data.proposals[0];
    const colors = proposal.colorPalette || ['#6366F1', '#EC4899', '#10B981', '#F59E0B'];
    const score = proposal.performanceScore?.overall || Math.round(Math.random() * 30 + 70);
    const cost = proposal.estimatedCost || { low: 5000, high: 15000 };
    
    resultDiv.innerHTML = `
        <div class="design-preview-content">
            <div class="preview-header">
                <h3>${proposal.title || formData.designStyle + ' ' + formData.roomType}</h3>
                <span class="score-badge">${score}/100</span>
            </div>
            
            <div class="color-palette">
                ${colors.map(c => `<span class="color-swatch" style="background: ${c}" title="${c}"></span>`).join('')}
            </div>
            
            <div class="preview-grid">
                <div class="preview-room">
                    <div class="room-visual" style="width: ${formData.dimensions.width * 40}px; height: ${formData.dimensions.length * 40}px;">
                        <span class="room-label">${formData.dimensions.width}m × ${formData.dimensions.length}m</span>
                        ${generateFurnitureVisual(proposal.layout?.furniture || generateMockFurniture(formData.roomType))}
                    </div>
                </div>
                
                <div class="preview-details">
                    <div class="detail-item">
                        <span class="detail-label">Room Type</span>
                        <span class="detail-value">${formData.roomType}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Style</span>
                        <span class="detail-value">${formData.designStyle}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Area</span>
                        <span class="detail-value">${(formData.dimensions.width * formData.dimensions.length).toFixed(1)} m²</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Estimated Cost</span>
                        <span class="detail-value">$${cost.low.toLocaleString()} - $${cost.high.toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Furniture Items</span>
                        <span class="detail-value">${proposal.layout?.furniture?.length || 5} pieces</span>
                    </div>
                </div>
            </div>
            
            <div class="preview-description">
                <p>${proposal.description || 'A beautifully designed ' + formData.designStyle.toLowerCase() + ' ' + formData.roomType.toLowerCase() + ' optimized for comfort and aesthetics.'}</p>
            </div>
            
            <div class="preview-actions">
                <button class="action-btn secondary" onclick="generateDesign()">
                    <span>🔄</span> Regenerate
                </button>
                <button class="action-btn primary">
                    <span>📱</span> Open in App
                </button>
            </div>
        </div>
    `;
    
    // Add custom styles for the preview
    addPreviewStyles();
}

function generateMockFurniture(roomType) {
    const furniture = {
        'Living Room': [
            { name: 'Sofa', x: 20, y: 60, width: 80, height: 30, color: '#6366F1' },
            { name: 'Coffee Table', x: 35, y: 35, width: 40, height: 20, color: '#EC4899' },
            { name: 'TV Stand', x: 30, y: 5, width: 50, height: 15, color: '#10B981' },
            { name: 'Armchair', x: 5, y: 40, width: 25, height: 25, color: '#F59E0B' }
        ],
        'Bedroom': [
            { name: 'Bed', x: 15, y: 50, width: 70, height: 40, color: '#6366F1' },
            { name: 'Nightstand', x: 5, y: 60, width: 15, height: 15, color: '#EC4899' },
            { name: 'Wardrobe', x: 5, y: 5, width: 30, height: 20, color: '#10B981' },
            { name: 'Desk', x: 60, y: 10, width: 30, height: 20, color: '#F59E0B' }
        ],
        'Kitchen': [
            { name: 'Counter', x: 5, y: 5, width: 90, height: 15, color: '#6366F1' },
            { name: 'Island', x: 30, y: 40, width: 40, height: 25, color: '#EC4899' },
            { name: 'Fridge', x: 80, y: 70, width: 15, height: 20, color: '#10B981' }
        ],
        'Office': [
            { name: 'Desk', x: 20, y: 50, width: 60, height: 25, color: '#6366F1' },
            { name: 'Chair', x: 40, y: 75, width: 20, height: 20, color: '#EC4899' },
            { name: 'Bookshelf', x: 5, y: 5, width: 25, height: 15, color: '#10B981' },
            { name: 'Filing Cabinet', x: 75, y: 70, width: 20, height: 15, color: '#F59E0B' }
        ]
    };
    
    return furniture[roomType] || furniture['Living Room'];
}

function generateFurnitureVisual(furniture) {
    return furniture.map(item => `
        <div class="furniture-item" 
             style="left: ${item.x || Math.random() * 60}%; 
                    top: ${item.y || Math.random() * 60}%; 
                    width: ${item.width || 30}px; 
                    height: ${item.height || 20}px;
                    background: ${item.color || '#6366F1'};"
             title="${item.name}">
        </div>
    `).join('');
}

function addPreviewStyles() {
    if (document.getElementById('preview-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'preview-styles';
    style.textContent = `
        .design-preview-content {
            animation: fadeIn 0.5s ease;
        }
        
        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .preview-header h3 {
            font-size: 20px;
            font-weight: 600;
        }
        
        .score-badge {
            background: linear-gradient(135deg, #6366F1, #EC4899);
            color: white;
            padding: 6px 14px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
        }
        
        .color-palette {
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
        }
        
        .color-swatch {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .color-swatch:hover {
            transform: scale(1.1);
        }
        
        .preview-grid {
            display: grid;
            grid-template-columns: 1fr 200px;
            gap: 24px;
            margin-bottom: 24px;
        }
        
        .preview-room {
            background: #16161D;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 250px;
        }
        
        .room-visual {
            background: #1E1E28;
            border: 2px dashed #3A3A45;
            border-radius: 8px;
            position: relative;
            min-width: 200px;
            min-height: 150px;
            max-width: 100%;
        }
        
        .room-label {
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            color: #71717A;
        }
        
        .furniture-item {
            position: absolute;
            border-radius: 4px;
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        
        .furniture-item:hover {
            opacity: 1;
        }
        
        .preview-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .detail-item {
            background: #16161D;
            padding: 12px 16px;
            border-radius: 8px;
        }
        
        .detail-label {
            display: block;
            font-size: 11px;
            color: #71717A;
            margin-bottom: 4px;
        }
        
        .detail-value {
            font-weight: 600;
            font-size: 14px;
        }
        
        .preview-description {
            background: #16161D;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        
        .preview-description p {
            color: #A1A1AA;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .preview-actions {
            display: flex;
            gap: 12px;
        }
        
        .preview-actions .action-btn {
            flex: 1;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// THEME RECOMMENDATIONS
// ============================================================================

async function getThemeRecommendations() {
    const resultDiv = document.getElementById('themes-result');
    
    resultDiv.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
            <span>Finding perfect themes for you...</span>
        </div>
    `;
    
    const preferences = {
        roomType: document.getElementById('theme-room').value,
        mood: document.getElementById('theme-mood').value,
        style: document.getElementById('theme-style').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/themes/recommendations?roomType=${preferences.roomType}&mood=${preferences.mood}&style=${preferences.style}`);
        const data = await response.json();
        
        displayThemeResults(data.themes || generateMockThemes(preferences));
        
    } catch (error) {
        // Generate mock themes for demo
        displayThemeResults(generateMockThemes(preferences));
    }
}

function generateMockThemes(preferences) {
    const palettes = [
        ['#6366F1', '#818CF8', '#C7D2FE', '#EEF2FF'],
        ['#EC4899', '#F472B6', '#FBCFE8', '#FCE7F3'],
        ['#10B981', '#34D399', '#A7F3D0', '#D1FAE5'],
        ['#F59E0B', '#FBBF24', '#FDE68A', '#FEF3C7'],
        ['#8B5CF6', '#A78BFA', '#DDD6FE', '#EDE9FE'],
        ['#14B8A6', '#2DD4BF', '#99F6E4', '#CCFBF1']
    ];
    
    return [
        {
            name: `${preferences.style} ${preferences.mood}`,
            description: `A ${preferences.mood.toLowerCase()} ${preferences.style.toLowerCase()} design perfect for your ${preferences.roomType.toLowerCase()}`,
            colorPalette: palettes[0],
            confidence: 0.95,
            materials: ['Wood', 'Fabric', 'Metal']
        },
        {
            name: `Elegant ${preferences.style}`,
            description: `Sophisticated ${preferences.style.toLowerCase()} aesthetics with a ${preferences.mood.toLowerCase()} atmosphere`,
            colorPalette: palettes[1],
            confidence: 0.88,
            materials: ['Marble', 'Velvet', 'Brass']
        },
        {
            name: `Natural ${preferences.mood}`,
            description: `Bring nature indoors with organic materials and ${preferences.mood.toLowerCase()} vibes`,
            colorPalette: palettes[2],
            confidence: 0.82,
            materials: ['Rattan', 'Linen', 'Clay']
        },
        {
            name: `Contemporary Fusion`,
            description: `Blend of modern design with ${preferences.mood.toLowerCase()} elements for your ${preferences.roomType.toLowerCase()}`,
            colorPalette: palettes[3],
            confidence: 0.79,
            materials: ['Glass', 'Steel', 'Concrete']
        }
    ];
}

function displayThemeResults(themes) {
    const resultDiv = document.getElementById('themes-result');
    
    resultDiv.innerHTML = themes.map(theme => `
        <div class="theme-card">
            <div class="theme-colors">
                ${(theme.colorPalette || ['#6366F1', '#818CF8', '#C7D2FE', '#EEF2FF']).map(c => 
                    `<span style="background: ${c}"></span>`
                ).join('')}
            </div>
            <div class="theme-info">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-desc">${theme.description}</div>
                <div class="theme-meta">
                    <span>🎯 ${Math.round((theme.confidence || 0.8) * 100)}% match</span>
                    <span>🪵 ${(theme.materials || ['Wood', 'Fabric']).slice(0, 2).join(', ')}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================================
// IDEAS ASSISTANT
// ============================================================================

async function analyzePrompt() {
    const prompt = document.getElementById('idea-prompt').value;
    const resultDiv = document.getElementById('ideas-result');
    
    if (!prompt || prompt.length < 10) {
        resultDiv.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">✏️</span>
                <p>Please enter a more detailed description (at least 10 characters)</p>
            </div>
        `;
        return;
    }
    
    resultDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <span>Analyzing your vision...</span>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_BASE}/ideas/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        const analysis = await response.json();
        
        // Get ideas
        const ideasResponse = await fetch(`${API_BASE}/ideas/suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomType: analysis.roomType || 'Living Room',
                designStyle: analysis.style || 'Modern',
                dimensions: analysis.dimensions || { width: 5, length: 6, height: 2.7 },
                budget: analysis.budget || 'medium',
                userPrompt: prompt
            })
        });
        
        const ideasData = await ideasResponse.json();
        
        displayIdeasResult(analysis, ideasData.ideas || []);
        
    } catch (error) {
        // Generate local analysis for demo
        const localAnalysis = analyzePromptLocally(prompt);
        const localIdeas = generateLocalIdeas(localAnalysis);
        displayIdeasResult(localAnalysis, localIdeas);
    }
}

function analyzePromptLocally(prompt) {
    const lower = prompt.toLowerCase();
    const analysis = {};
    
    // Room detection
    if (lower.includes('bedroom') || lower.includes('bed')) analysis.roomType = 'Bedroom';
    else if (lower.includes('kitchen') || lower.includes('cook')) analysis.roomType = 'Kitchen';
    else if (lower.includes('office') || lower.includes('work')) analysis.roomType = 'Office';
    else if (lower.includes('bathroom')) analysis.roomType = 'Bathroom';
    else analysis.roomType = 'Living Room';
    
    // Style detection
    if (lower.includes('modern')) analysis.style = 'Modern';
    else if (lower.includes('minimalist')) analysis.style = 'Minimalist';
    else if (lower.includes('scandinavian')) analysis.style = 'Scandinavian';
    else if (lower.includes('industrial')) analysis.style = 'Industrial';
    else if (lower.includes('bohemian') || lower.includes('boho')) analysis.style = 'Bohemian';
    else analysis.style = 'Modern';
    
    // Budget detection
    if (lower.includes('budget') || lower.includes('cheap')) analysis.budget = 'low';
    else if (lower.includes('luxury') || lower.includes('premium')) analysis.budget = 'luxury';
    else analysis.budget = 'medium';
    
    // Extract colors mentioned
    const colorKeywords = ['white', 'black', 'blue', 'green', 'natural', 'warm', 'neutral'];
    analysis.colors = colorKeywords.filter(c => lower.includes(c));
    
    return analysis;
}

function generateLocalIdeas(analysis) {
    return [
        {
            title: `Zoned ${analysis.style} ${analysis.roomType}`,
            description: `Create distinct functional zones while maintaining visual flow. Use area rugs and lighting to define spaces without physical barriers.`
        },
        {
            title: `Light-Optimized Layout`,
            description: `Position key furniture near natural light sources. Use mirrors strategically to amplify brightness and create an airy atmosphere.`
        },
        {
            title: `Smart Storage Solutions`,
            description: `Integrate hidden storage into furniture pieces. Vertical shelving and multi-functional pieces maximize space efficiency.`
        }
    ];
}

function displayIdeasResult(analysis, ideas) {
    const resultDiv = document.getElementById('ideas-result');
    
    resultDiv.innerHTML = `
        <div class="idea-analysis">
            ${analysis.roomType ? `
                <div class="analysis-item">
                    <div class="analysis-label">Detected Room</div>
                    <div class="analysis-value">🏠 ${analysis.roomType}</div>
                </div>
            ` : ''}
            ${analysis.style ? `
                <div class="analysis-item">
                    <div class="analysis-label">Suggested Style</div>
                    <div class="analysis-value">🎨 ${analysis.style}</div>
                </div>
            ` : ''}
            ${analysis.budget ? `
                <div class="analysis-item">
                    <div class="analysis-label">Budget Level</div>
                    <div class="analysis-value">💰 ${analysis.budget.charAt(0).toUpperCase() + analysis.budget.slice(1)}</div>
                </div>
            ` : ''}
            ${analysis.colors && analysis.colors.length > 0 ? `
                <div class="analysis-item">
                    <div class="analysis-label">Color Keywords</div>
                    <div class="analysis-value">🎭 ${analysis.colors.join(', ')}</div>
                </div>
            ` : ''}
        </div>
        
        <h3 style="margin-bottom: 16px;">💡 Design Ideas</h3>
        <div class="ideas-list">
            ${ideas.map((idea, i) => `
                <div class="idea-card">
                    <div class="idea-title">
                        <span>${['🌟', '✨', '💫'][i] || '💡'}</span>
                        ${idea.title}
                    </div>
                    <div class="idea-desc">${idea.description}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================================
// API SECTION
// ============================================================================

function loadApiEndpoints() {
    const endpoints = [
        { method: 'GET', path: '/health', desc: 'Server health check' },
        { method: 'GET', path: '/api', desc: 'API information' },
        { method: 'GET', path: '/api/v1/layouts', desc: 'List all layouts' },
        { method: 'POST', path: '/api/v1/layouts', desc: 'Create a new layout' },
        { method: 'GET', path: '/api/v1/projects', desc: 'List all projects' },
        { method: 'POST', path: '/api/v1/projects', desc: 'Create a new project' },
        { method: 'GET', path: '/api/v1/themes/recommendations', desc: 'Get theme recommendations' },
        { method: 'POST', path: '/api/v1/themes/feedback', desc: 'Submit theme feedback' },
        { method: 'POST', path: '/api/v1/images/generate', desc: 'Generate DALL-E image' },
        { method: 'POST', path: '/api/v1/designs/generate', desc: 'Generate AI design' },
        { method: 'POST', path: '/api/v1/ideas/analyze', desc: 'Analyze design prompt' },
        { method: 'POST', path: '/api/v1/ideas/suggest', desc: 'Get design ideas' },
        { method: 'GET', path: '/api/v1/training/stats', desc: 'Get ML training stats' },
        { method: 'POST', path: '/api/v1/training/train', desc: 'Train ML model' }
    ];
    
    const container = document.getElementById('api-endpoints');
    container.innerHTML = endpoints.map(ep => `
        <div class="api-endpoint">
            <span class="api-method ${ep.method.toLowerCase()}">${ep.method}</span>
            <span class="api-path">${ep.path}</span>
            <span class="api-desc">${ep.desc}</span>
        </div>
    `).join('');
}

async function testApi() {
    const method = document.getElementById('api-method').value;
    const url = document.getElementById('api-url').value;
    const responseEl = document.getElementById('api-response-body');
    
    responseEl.textContent = '// Loading...';
    
    try {
        const response = await fetch(url, { method });
        const data = await response.json();
        responseEl.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        responseEl.textContent = `// Error: ${error.message}`;
    }
}

// Make switchSection global
window.switchSection = switchSection;
window.getThemeRecommendations = getThemeRecommendations;
window.analyzePrompt = analyzePrompt;
window.generateDesign = generateDesign;
window.testApi = testApi;
