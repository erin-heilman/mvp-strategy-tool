// MVP Strategic Planning Tool - ENHANCED VERSION
console.log('MVP Tool Starting - Enhanced Version with TIN Analysis...');

// Configuration
const SHEET_ID = '1CHs8cP3mDQkwG-XL-B7twFVukRxcB4umn9VX9ZK2VqM';

// Global state
let clinicians = [];
let mvps = [];
let measures = [];
let benchmarks = [];
let assignments = {};
let mvpSelections = {};
let mvpPerformance = {};
let selectedClinicians = new Set();
let currentMVP = null;
let currentMode = 'tin-analysis'; // Start with TIN Analysis
let savedScenarios = {};
let currentScenarioName = 'Default';

// New state for enhanced features
let selectedSpecialties = new Set();
let measureEstimates = {}; // Store single estimate per measure instead of per clinician
let measureConfigurations = {}; // Store enhanced measure configurations
let yearlyPlan = {
    2025: { mvps: [], measures: [], focus: 'Foundation - High readiness measures' },
    2026: { mvps: [], measures: [], focus: 'Expansion - Add specialty MVPs' },
    2027: { mvps: [], measures: [], focus: 'Integration - Cross-specialty coordination' },
    2028: { mvps: [], measures: [], focus: 'Optimization - Performance improvement' },
    2029: { mvps: [], measures: [], focus: 'Excellence - Full MVP implementation' }
};
let currentYear = 2025;

// MVP recommendations based on specialty
const mvpRecommendations = {
    'Family Practice': 'Value in Primary Care MVP',
    'Family Medicine': 'Value in Primary Care MVP',
    'Internal Medicine': 'Value in Primary Care MVP',
    'Emergency Medicine': 'Adopting Best Practices and Promoting Patient Safety within Emergency Medicine MVP',
    'Orthopedic Surgery': 'Improving Care for Lower Extremity Joint Repair MVP',
    'Anesthesiology': 'Patient Safety and Support of Positive Experiences with Anesthesia MVP',
    'General Surgery': 'Surgical Care MVP',
    'Cardiology': 'Advancing Care for Heart Disease MVP',
    'Neurology': 'Optimal Care for Patients with Episodic Neurological Conditions MVP',
    'Ophthalmology': 'Optimizing Cataract Surgery and Refractive Outcomes MVP',
    'Gastroenterology': 'Gastric and Esophageal Treatment MVP',
    'Rheumatology': 'Rheumatology Care MVP',
    'Pulmonology': 'Pulmonary Disease Management MVP',
    'Nephrology': 'Kidney Care MVP'
};

// Initialize the application
async function init() {
    console.log('Initializing Enhanced MVP tool...');
    const statusEl = document.getElementById('connection-status');
    
    try {
        statusEl.textContent = 'Loading data from Google Sheets...';
        statusEl.className = 'status-loading';
        
        await loadData();
        
        statusEl.textContent = `Connected! Loaded ${clinicians.length} clinicians and ${mvps.length} MVPs`;
        statusEl.className = 'status-success';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
            document.getElementById('nav-tabs').style.display = 'block';
        }, 3000);
        
        document.getElementById('main-app').style.display = 'block';
        
        // Load saved scenarios from localStorage
        loadSavedScenarios();
        
        setupInterface();
        
        // Start with TIN Analysis
        switchToMode('tin-analysis');
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusEl.textContent = `Error: ${error.message}. Please refresh the page.`;
        statusEl.className = 'status-error';
    }
}

// Keep existing loadData function as is
async function loadData() {
    console.log('Loading data from API...');
    
    try {
        // Load clinicians using /api/sheets/clinicians format
        console.log('Fetching clinicians from /api/sheets/clinicians...');
        const response = await fetch('/api/sheets/clinicians');
        
        if (!response.ok) {
            throw new Error(`Failed to load clinicians: ${response.status}`);
        }
        
        const cliniciansData = await response.json();
        console.log(`Loaded ${cliniciansData.length} clinicians`);
        
        // Process clinicians data
        clinicians = cliniciansData.map(row => {
            let name = 'Unknown';
            
            // Try different name field combinations
            if (row['first_name'] && row['last_name']) {
                name = `${row['first_name']} ${row['last_name']}`.trim();
            } else if (row['First Name'] && row['Last Name']) {
                name = `${row['First Name']} ${row['Last Name']}`.trim();
            } else if (row['full_name']) {
                name = row['full_name'].trim();
            } else if (row['Full Name']) {
                name = row['Full Name'].trim();
            } else if (row['name']) {
                name = row['name'].trim();
            } else if (row['Name']) {
                name = row['Name'].trim();
            }
            
            return {
                npi: row.npi || row.NPI || '',
                name: name,
                specialty: row.specialty || row.Specialty || 'Unknown',
                tin: row.tin || row.TIN || '',
                separate_ehr: row.separate_ehr || row['Separate EHR'] || 'No'
            };
        });
        
        // Load MVPs
        console.log('Fetching MVPs from /api/sheets/mvps...');
        const mvpsResponse = await fetch('/api/sheets/mvps');
        
        if (mvpsResponse.ok) {
            const mvpsData = await mvpsResponse.json();
            
            mvps = mvpsData.map(row => ({
                mvp_id: row.mvp_id || row['MVP ID'] || '',
                mvp_name: row.mvp_name || row['MVP Name'] || '',
                specialties: row.eligible_specialties || row['Eligible Specialties'] || '',
                available_measures: row.available_measures || row['Available Measures'] || ''
            }));
            
            console.log(`Loaded ${mvps.length} MVPs`);
        }
        
        // Load measures with enhanced configuration fields
        console.log('Fetching measures from /api/sheets/measures...');
        const measuresResponse = await fetch('/api/sheets/measures');
        
        if (measuresResponse.ok) {
            const measuresData = await measuresResponse.json();
            
            measures = measuresData.map(row => ({
                measure_id: row.measure_id || row['Measure ID'] || '',
                measure_name: row.measure_name || row['Measure Name'] || '',
                is_activated: row.is_activated || row['Is Activated'] || 'N',
                collection_types: row.collection_types || row['Collection Types'] || 'MIPS CQM',
                difficulty: row.difficulty || row['Difficulty'] || 'Medium',
                is_inverse: row.is_inverse || row['Is Inverse'] || 'N',
                setup_time: row.setup_time || row['Setup Time'] || '3 months',
                readiness: parseInt(row.readiness || row['Readiness'] || '3'),
                prerequisites: row.prerequisites || row['Prerequisites'] || '',
                median_benchmark: parseFloat(row.median_benchmark || row['Median Benchmark'] || '75')
            }));
            
            console.log(`Loaded ${measures.length} measures`);
        }
        
        // Load benchmarks
        console.log('Fetching benchmarks from /api/sheets/benchmarks...');
        const benchmarksResponse = await fetch('/api/sheets/benchmarks');
        
        if (benchmarksResponse.ok) {
            const benchmarksData = await benchmarksResponse.json();
            
            benchmarks = benchmarksData.map(row => ({
                benchmark_year: row.benchmark_year || row['Benchmark Year'] || '2025',
                measure_id: row.measure_id || row['Measure ID'] || '',
                collection_type: row.collection_type || row['Collection Type'] || '',
                is_inverse: row.is_inverse || row['Is Inverse'] || 'N',
                mean_performance: parseFloat(row.mean_performance || row['Mean Performance'] || 0),
                median_performance: parseFloat(row.median_performance || row['Median Performance'] || row.decile_5 || 75),
                decile_1: parseFloat(row.decile_1 || row['Decile 1'] || 0),
                decile_2: parseFloat(row.decile_2 || row['Decile 2'] || 0),
                decile_3: parseFloat(row.decile_3 || row['Decile 3'] || 0),
                decile_4: parseFloat(row.decile_4 || row['Decile 4'] || 0),
                decile_5: parseFloat(row.decile_5 || row['Decile 5'] || 0),
                decile_6: parseFloat(row.decile_6 || row['Decile 6'] || 0),
                decile_7: parseFloat(row.decile_7 || row['Decile 7'] || 0),
                decile_8: parseFloat(row.decile_8 || row['Decile 8'] || 0),
                decile_9: parseFloat(row.decile_9 || row['Decile 9'] || 0),
                decile_10: parseFloat(row.decile_10 || row['Decile 10'] || 100)
            }));
            
            console.log(`Loaded ${benchmarks.length} benchmarks`);
        } else {
            console.log('No benchmarks loaded, using defaults');
            benchmarks = [];
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Unable to load data. Using demo data.');
        
        // Demo data
        clinicians = [
            { npi: '1234567890', name: 'John Smith', specialty: 'Family Practice', tin: '123456789' },
            { npi: '0987654321', name: 'Jane Doe', specialty: 'Emergency Medicine', tin: '123456789' },
            { npi: '1111111111', name: 'Bob Johnson', specialty: 'Orthopedic Surgery', tin: '123456789' },
            { npi: '2222222222', name: 'Alice Williams', specialty: 'Anesthesiology', tin: '123456789' },
            { npi: '3333333333', name: 'Charlie Brown', specialty: 'Cardiology', tin: '123456789' }
        ];
        
        mvps = [
            { mvp_id: 'MVP001', mvp_name: 'Value in Primary Care MVP', specialties: 'Family Medicine', available_measures: 'Q001,Q112,Q113,Q134' },
            { mvp_id: 'MVP002', mvp_name: 'Adopting Best Practices and Promoting Patient Safety within Emergency Medicine MVP', specialties: 'Emergency Medicine', available_measures: 'Q065,Q116,Q254,Q255' }
        ];
        
        measures = [
            { measure_id: 'Q001', measure_name: 'Diabetes Control', is_activated: 'Y', collection_types: 'eCQM, MIPS CQM', difficulty: 'Easy', is_inverse: 'Y', setup_time: '2 months', readiness: 4, prerequisites: 'EHR integration', median_benchmark: 72 },
            { measure_id: 'Q112', measure_name: 'Breast Cancer Screening', is_activated: 'Y', collection_types: 'eCQM, MIPS CQM', difficulty: 'Medium', setup_time: '3 months', readiness: 3, prerequisites: 'Registry setup', median_benchmark: 68 },
            { measure_id: 'Q113', measure_name: 'Colorectal Cancer Screening', is_activated: 'N', collection_types: 'MIPS CQM', difficulty: 'Hard', setup_time: '6 months', readiness: 2, prerequisites: 'Complex workflow', median_benchmark: 65 }
        ];
        
        benchmarks = [];
    }
    
    updateStats();
}

// TIN Analysis Functions
function renderTINAnalysis() {
    console.log('Rendering TIN Analysis...');
    
    // Calculate specialty distribution
    const specialtyCount = {};
    const specialtyClinicians = {};
    
    clinicians.forEach(clinician => {
        const spec = clinician.specialty || 'Unspecified';
        specialtyCount[spec] = (specialtyCount[spec] || 0) + 1;
        if (!specialtyClinicians[spec]) {
            specialtyClinicians[spec] = [];
        }
        specialtyClinicians[spec].push(clinician);
    });
    
    // Update TIN overview cards
    document.getElementById('tin-total').textContent = clinicians.length;
    document.getElementById('tin-specialties').textContent = Object.keys(specialtyCount).length;
    
    // Count recommended MVPs
    const recommendedMVPs = new Set();
    Object.keys(specialtyCount).forEach(specialty => {
        if (mvpRecommendations[specialty]) {
            recommendedMVPs.add(mvpRecommendations[specialty]);
        }
    });
    document.getElementById('tin-mvps').textContent = recommendedMVPs.size;
    
    // Render specialty cards
    const specialtyGrid = document.getElementById('specialty-grid');
    specialtyGrid.innerHTML = '';
    
    // Sort specialties by count (descending)
    const sortedSpecialties = Object.entries(specialtyCount).sort((a, b) => b[1] - a[1]);
    
    sortedSpecialties.forEach(([specialty, count]) => {
        const card = document.createElement('div');
        card.className = 'specialty-card';
        if (selectedSpecialties.has(specialty)) {
            card.classList.add('selected');
        }
        card.dataset.specialty = specialty;
        
        const recommendedMVP = mvpRecommendations[specialty];
        const mvp = mvps.find(m => m.mvp_name === recommendedMVP);
        
        card.innerHTML = `
            <div class="specialty-header">
                <div class="specialty-name">${specialty}</div>
                <div class="clinician-count">${count}</div>
            </div>
            ${recommendedMVP && mvp ? `
                <div class="mvp-recommendation">
                    <strong>Recommended:</strong><br>
                    ${recommendedMVP}
                </div>
            ` : `
                <div style="color: #6c757d; font-style: italic; margin-top: 10px;">
                    No specific MVP recommendation
                </div>
            `}
            <div class="clinician-preview">
                ${specialtyClinicians[specialty].slice(0, 3).map(c => c.name).join('<br>')}
                ${count > 3 ? `<br>... and ${count - 3} more` : ''}
            </div>
        `;
        
        card.onclick = () => toggleSpecialtySelection(specialty);
        specialtyGrid.appendChild(card);
    });
}

function toggleSpecialtySelection(specialty) {
    if (selectedSpecialties.has(specialty)) {
        selectedSpecialties.delete(specialty);
    } else {
        selectedSpecialties.add(specialty);
    }
    
    const card = document.querySelector(`[data-specialty="${specialty}"]`);
    if (card) {
        card.classList.toggle('selected');
    }
}

function autoGenerateRecommendations() {
    // Clear current selections
    selectedSpecialties.clear();
    document.querySelectorAll('.specialty-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Select specialties with MVP recommendations
    Object.keys(mvpRecommendations).forEach(specialty => {
        const hasSpecialty = clinicians.some(c => c.specialty === specialty);
        if (hasSpecialty) {
            selectedSpecialties.add(specialty);
            const card = document.querySelector(`[data-specialty="${specialty}"]`);
            if (card) {
                card.classList.add('selected');
            }
        }
    });
    
    alert(`Auto-selected ${selectedSpecialties.size} specialties with MVP recommendations`);
}

function createSubgroups() {
    if (selectedSpecialties.size === 0) {
        alert('Please select at least one specialty to create subgroups');
        return;
    }
    
    // Create MVP assignments for selected specialties
    selectedSpecialties.forEach(specialty => {
        const recommendedMVP = mvpRecommendations[specialty];
        if (recommendedMVP) {
            const mvp = mvps.find(m => m.mvp_name === recommendedMVP);
            if (mvp) {
                if (!assignments[mvp.mvp_id]) {
                    assignments[mvp.mvp_id] = [];
                }
                // Assign clinicians of this specialty to the MVP
                clinicians.forEach(clinician => {
                    if (clinician.specialty === specialty && !assignments[mvp.mvp_id].includes(clinician.npi)) {
                        assignments[mvp.mvp_id].push(clinician.npi);
                    }
                });
            }
        }
    });
    
    // Switch to planning mode
    switchToMode('planning');
    alert(`Created ${Object.keys(assignments).length} MVP subgroups`);
}

// Performance Estimation Functions (Simplified)
function renderPerformanceEstimation() {
    const container = document.getElementById('performance-cards');
    if (!container) return;
    
    container.innerHTML = '';
    
    const activeMVPs = mvps.filter(mvp => 
        assignments[mvp.mvp_id]?.length > 0 && 
        mvpSelections[mvp.mvp_id]?.measures.length > 0
    );
    
    if (activeMVPs.length === 0) {
        container.innerHTML = '<div class="empty-state">Please assign clinicians and select measures for at least one MVP first.</div>';
        return;
    }
    
    activeMVPs.forEach(mvp => {
        const card = document.createElement('div');
        card.className = 'mvp-performance-card';
        
        let html = `
            <div class="mvp-performance-header">${mvp.mvp_name}</div>
            <div style="color: #6c757d; margin-bottom: 15px;">
                ${assignments[mvp.mvp_id].length} clinicians assigned
            </div>
        `;
        
        const selections = mvpSelections[mvp.mvp_id];
        if (selections && selections.measures.length > 0) {
            selections.measures.forEach(measureId => {
                const measure = measures.find(m => m.measure_id === measureId);
                if (!measure) return;
                
                // Get median benchmark from measure or benchmarks
                const benchmark = benchmarks.find(b => 
                    b.measure_id === measureId && 
                    b.collection_type === (selections.configs[measureId]?.collectionType || 'MIPS CQM')
                );
                const medianBenchmark = benchmark?.median_performance || measure.median_benchmark || 75;
                
                html += `
                    <div class="measure-estimation">
                        <div class="measure-name">${measureId}: ${measure.measure_name}</div>
                        <input type="number" 
                               class="estimation-input" 
                               min="0" max="100" 
                               value="${measureEstimates[`${mvp.mvp_id}_${measureId}`] || ''}"
                               placeholder="Est %"
                               onchange="updateMeasureEstimate('${mvp.mvp_id}', '${measureId}', this.value)">
                        <div class="benchmark-value">Benchmark: ${medianBenchmark.toFixed(0)}%</div>
                        <div id="score-${mvp.mvp_id}-${measureId}" style="text-align: center; font-weight: bold;">
                            --
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
            <div class="score-summary" id="mvp-score-${mvp.mvp_id}">
                <div style="font-size: 14px; color: #6c757d;">Composite Score</div>
                <div style="font-size: 32px; font-weight: bold; color: #667eea;">--</div>
            </div>
        `;
        
        card.innerHTML = html;
        container.appendChild(card);
    });
}

function updateMeasureEstimate(mvpId, measureId, value) {
    const key = `${mvpId}_${measureId}`;
    measureEstimates[key] = parseFloat(value) || 0;
    
    // Calculate score for this measure
    const score = calculateSimplifiedScore(measureId, value);
    const scoreEl = document.getElementById(`score-${mvpId}-${measureId}`);
    if (scoreEl) {
        scoreEl.textContent = `${score.toFixed(1)} pts`;
    }
    
    // Update MVP composite score
    updateMVPCompositeScore(mvpId);
}

function calculateSimplifiedScore(measureId, performanceRate) {
    // Simple scoring: divide performance into deciles
    const rate = parseFloat(performanceRate) || 0;
    
    if (rate >= 95) return 10.0;
    if (rate >= 90) return 9.0;
    if (rate >= 85) return 8.0;
    if (rate >= 80) return 7.0;
    if (rate >= 75) return 6.0;
    if (rate >= 70) return 5.0;
    if (rate >= 60) return 4.0;
    if (rate >= 50) return 3.0;
    if (rate >= 40) return 2.0;
    return 1.0;
}

function updateMVPCompositeScore(mvpId) {
    const selections = mvpSelections[mvpId];
    if (!selections || selections.measures.length === 0) return;
    
    let totalScore = 0;
    let count = 0;
    
    selections.measures.forEach(measureId => {
        const estimate = measureEstimates[`${mvpId}_${measureId}`];
        if (estimate !== undefined && estimate !== null) {
            totalScore += calculateSimplifiedScore(measureId, estimate);
            count++;
        }
    });
    
    const compositeScore = count > 0 ? totalScore / count : 0;
    
    const scoreEl = document.getElementById(`mvp-score-${mvpId}`);
    if (scoreEl) {
        scoreEl.innerHTML = `
            <div style="font-size: 14px; color: #6c757d;">Composite Score</div>
            <div style="font-size: 32px; font-weight: bold; color: #667eea;">${compositeScore.toFixed(1)}</div>
        `;
    }
}

function calculateTotalScores() {
    // Calculate all MVP scores
    const activeMVPs = mvps.filter(mvp => 
        assignments[mvp.mvp_id]?.length > 0 && 
        mvpSelections[mvp.mvp_id]?.measures.length > 0
    );
    
    activeMVPs.forEach(mvp => {
        updateMVPCompositeScore(mvp.mvp_id);
    });
    
    alert('Scores calculated! Review the composite scores for each MVP.');
}

// Executive Dashboard Functions
function renderExecutiveDashboard() {
    // Create yearly plan based on MVP readiness
    const activeMVPs = Object.keys(assignments);
    
    if (activeMVPs.length > 0) {
        // Distribute MVPs across years
        const mvpsPerYear = Math.ceil(activeMVPs.length / 3);
        
        yearlyPlan[2025].mvps = activeMVPs.slice(0, mvpsPerYear);
        yearlyPlan[2026].mvps = activeMVPs.slice(mvpsPerYear, mvpsPerYear * 2);
        yearlyPlan[2027].mvps = activeMVPs.slice(mvpsPerYear * 2);
        yearlyPlan[2028].mvps = activeMVPs;
        yearlyPlan[2029].mvps = activeMVPs;
        
        // Calculate measures per year
        Object.keys(yearlyPlan).forEach(year => {
            yearlyPlan[year].measures = [];
            yearlyPlan[year].mvps.forEach(mvpId => {
                if (mvpSelections[mvpId]) {
                    yearlyPlan[year].measures.push(...mvpSelections[mvpId].measures);
                }
            });
        });
    }
    
    selectYear(2025);
}

function selectYear(year) {
    currentYear = year;
    
    // Update active state
    document.querySelectorAll('.year-item').forEach(item => {
        item.classList.remove('active');
        if (item.querySelector('.year-number').textContent == year) {
            item.classList.add('active');
        }
    });
    
    // Render year details
    const detailsContainer = document.getElementById('year-details');
    const plan = yearlyPlan[year];
    
    let html = `
        <div class="year-details">
            <h3>Year ${year} Implementation Plan</h3>
            <p style="color: #6c757d; margin-bottom: 20px;">
                <strong>Focus:</strong> ${plan.focus}
            </p>
            
            <div class="implementation-grid">
                <div class="implementation-card">
                    <h4>Active MVPs (${plan.mvps.length})</h4>
                    <ul style="list-style: none; padding: 0;">
                        ${plan.mvps.map(mvpId => {
                            const mvp = mvps.find(m => m.mvp_id === mvpId);
                            return mvp ? `<li style="padding: 5px 0;">${mvp.mvp_name}</li>` : '';
                        }).join('')}
                    </ul>
                </div>
                
                <div class="implementation-card">
                    <h4>Measures (${plan.measures.length})</h4>
                    <p>Implementing ${plan.measures.length} quality measures</p>
                    <ul style="list-style: none; padding: 0;">
                        ${plan.measures.slice(0, 5).map(measureId => {
                            const measure = measures.find(m => m.measure_id === measureId);
                            return measure ? `<li style="padding: 5px 0;">${measureId}: ${measure.measure_name}</li>` : '';
                        }).join('')}
                        ${plan.measures.length > 5 ? `<li style="padding: 5px 0; font-style: italic;">... and ${plan.measures.length - 5} more</li>` : ''}
                    </ul>
                </div>
                
                <div class="implementation-card">
                    <h4>Key Milestones</h4>
                    <ul style="list-style: none; padding: 0;">
                        <li style="padding: 5px 0;">Q1: Staff training and system preparation</li>
                        <li style="padding: 5px 0;">Q2: Initial measure implementation</li>
                        <li style="padding: 5px 0;">Q3: Performance monitoring</li>
                        <li style="padding: 5px 0;">Q4: Year-end review</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    detailsContainer.innerHTML = html;
}

// Switch between major modes
function switchToMode(mode) {
    console.log('Switching to mode:', mode);
    
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Find and activate the correct tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.textContent.toLowerCase().includes(mode.replace('-', ' '))) {
            tab.classList.add('active');
        }
    });
    
    // Hide all modes
    document.getElementById('tin-analysis').style.display = 'none';
    document.getElementById('planning-mode').style.display = 'none';
    document.getElementById('review-mode').style.display = 'none';
    document.getElementById('performance-estimation').style.display = 'none';
    document.getElementById('executive-dashboard').style.display = 'none';
    
    // Show selected mode
    switch(mode) {
        case 'tin-analysis':
            document.getElementById('tin-analysis').style.display = 'block';
            renderTINAnalysis();
            break;
        case 'planning':
            document.getElementById('planning-mode').style.display = 'block';
            renderPlanningMode();
            break;
        case 'performance':
            document.getElementById('performance-estimation').style.display = 'block';
            renderPerformanceEstimation();
            break;
        case 'executive':
            document.getElementById('executive-dashboard').style.display = 'block';
            renderExecutiveDashboard();
            break;
    }
    
    currentMode = mode;
}

// Enhanced measure configuration in planning mode
function renderEnhancedMeasuresTab(mvp) {
    const container = document.getElementById('mvp-details');
    if (!container) return;
    
    const selections = mvpSelections[mvp.mvp_id] || { measures: [], configs: {} };
    const availableMeasureIds = mvp.available_measures ? 
        mvp.available_measures.split(',').map(m => m.trim()) : [];
    
    if (availableMeasureIds.length === 0) {
        container.innerHTML = `
            <h3>${mvp.mvp_name}</h3>
            <p class="empty-state">No measures configured for this MVP.</p>
        `;
        return;
    }
    
    let html = `
        <h3>${mvp.mvp_name} - Measure Selection</h3>
        <p class="measure-requirement">Select exactly 4 measures. ${selections.measures.length}/4 selected.</p>
        <div class="measures-grid">
    `;
    
    availableMeasureIds.forEach(measureId => {
        const measure = measures.find(m => m.measure_id === measureId);
        if (!measure) return;
        
        const isSelected = selections.measures.includes(measureId);
        const isActivated = measure.is_activated === 'Y';
        const config = measureConfigurations[`${mvp.mvp_id}_${measureId}`] || {};
        
        html += `
            <div class="measure-card ${isSelected ? 'selected' : ''} ${isActivated ? 'activated' : ''}">
                <label>
                    <input type="checkbox" 
                           value="${measureId}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleMeasure('${mvp.mvp_id}', '${measureId}')">
                    <div class="measure-content">
                        <div class="measure-header">
                            <span class="measure-id">${measureId}</span>
                            <span class="measure-name">${measure.measure_name}</span>
                        </div>
                        <div class="measure-meta">
                            <span class="collection-types">Available: ${measure.collection_types}</span>
                            <span class="difficulty difficulty-${(measure.difficulty || 'Medium').toLowerCase()}">
                                ${measure.difficulty || 'Medium'} Implementation
                            </span>
                        </div>
                        ${isActivated ? '<span class="badge activated">Already Activated</span>' : '<span class="badge new">New Measure</span>'}
                        ${measure.is_inverse === 'Y' ? '<span class="badge" style="background: #ffeeba; color: #856404;">Inverse Measure</span>' : ''}
                        <div style="margin-top: 8px; font-size: 12px; color: #6c757d;">
                            Median Benchmark: ${measure.median_benchmark}%
                        </div>
                    </div>
                </label>
                ${isSelected ? `
                    <div class="measure-config">
                        <div class="config-item">
                            <label class="config-label">Setup Time</label>
                            <input type="text" class="config-input" 
                                   value="${config.setupTime || measure.setup_time || '3 months'}"
                                   onchange="updateMeasureConfig('${mvp.mvp_id}', '${measureId}', 'setupTime', this.value)">
                        </div>
                        <div class="config-item">
                            <label class="config-label">Readiness (1-5)</label>
                            <div class="readiness-scale">
                                ${[1,2,3,4,5].map(r => `
                                    <button class="readiness-btn ${(config.readiness || measure.readiness) == r ? 'selected' : ''}"
                                            onclick="updateMeasureConfig('${mvp.mvp_id}', '${measureId}', 'readiness', ${r})">
                                        ${r}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="config-item full-width">
                            <label class="config-label">Prerequisites/Dependencies</label>
                            <textarea class="config-textarea"
                                      onchange="updateMeasureConfig('${mvp.mvp_id}', '${measureId}', 'prerequisites', this.value)">${config.prerequisites || measure.prerequisites || ''}</textarea>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Update measure configuration
function updateMeasureConfig(mvpId, measureId, field, value) {
    const key = `${mvpId}_${measureId}`;
    if (!measureConfigurations[key]) {
        measureConfigurations[key] = {};
    }
    measureConfigurations[key][field] = value;
    
    // Update UI if needed
    if (field === 'readiness') {
        document.querySelectorAll(`.readiness-btn`).forEach(btn => {
            const btnValue = parseInt(btn.textContent);
            if (btn.onclick.toString().includes(measureId)) {
                btn.classList.toggle('selected', btnValue === value);
            }
        });
    }
}

// Export enhanced plan
function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        scenario: currentScenarioName,
        tin_analysis: {
            total_clinicians: clinicians.length,
            specialties: [...new Set(clinicians.map(c => c.specialty))].length,
            selected_specialties: Array.from(selectedSpecialties)
        },
        assignments: assignments,
        selections: mvpSelections,
        measure_configurations: measureConfigurations,
        performance_estimates: measureEstimates,
        yearly_plan: yearlyPlan,
        summary: {
            total_clinicians: clinicians.length,
            assigned: Object.values(assignments).flat().length,
            active_mvps: Object.keys(assignments).filter(id => assignments[id]?.length > 0).length
        }
    };
    
    // Create CSV for Excel
    let csvContent = "Year,MVP,Clinicians,Measures,Setup Time,Readiness,Focus\n";
    
    Object.entries(yearlyPlan).forEach(([year, plan]) => {
        plan.mvps.forEach(mvpId => {
            const mvp = mvps.find(m => m.mvp_id === mvpId);
            const clinicianCount = assignments[mvpId]?.length || 0;
            const measureCount = mvpSelections[mvpId]?.measures.length || 0;
            
            csvContent += `${year},"${mvp?.mvp_name || mvpId}",${clinicianCount},${measureCount},,"${plan.focus}"\n`;
        });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-strategic-plan-${currentScenarioName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Keep all existing functions from original app.js
// (setupInterface, renderPlanningMode, renderClinicians, renderMVPs, etc.)
// Just update renderMeasuresTab to use renderEnhancedMeasuresTab

function setupInterface() {
    setupFilters();
    setupEventHandlers();
}

function setupFilters() {
    const specialties = [...new Set(clinicians.map(c => c.specialty))].filter(s => s && s !== 'Unknown').sort();
    
    const filterContainer = document.getElementById('filter-container');
    if (!filterContainer) return;
    
    const mvpOptions = mvps.map(mvp => 
        `<option value="${mvp.mvp_id}">${mvp.mvp_name}</option>`
    ).join('');
    
    filterContainer.innerHTML = `
        <div class="filter-row">
            <input type="text" id="search-box" placeholder="Search by name or NPI..." onkeyup="filterClinicians()">
            <select id="specialty-filter" onchange="filterClinicians()">
                <option value="">All Specialties (${clinicians.length})</option>
                ${specialties.map(s => {
                    const count = clinicians.filter(c => c.specialty === s).length;
                    return `<option value="${s}">${s} (${count})</option>`;
                }).join('')}
            </select>
            <button onclick="selectAllVisible()" class="btn-select">Select All</button>
            <button onclick="clearSelection()" class="btn-clear">Clear Selection</button>
            <div class="assignment-controls">
                <select id="mvp-selector">
                    <option value="">Choose MVP...</option>
                    ${mvpOptions}
                </select>
                <button onclick="assignSelectedToMVP()" class="btn-assign">Assign Selected</button>
            </div>
        </div>
        <div class="scenario-controls">
            <select id="scenario-selector" onchange="loadScenario(this.value)">
                <option value="Default">Default Scenario</option>
                ${Object.keys(savedScenarios).map(name => 
                    `<option value="${name}">${name}</option>`
                ).join('')}
            </select>
            <button onclick="saveScenario()" class="btn-save">Save Scenario</button>
            <button onclick="saveAsNewScenario()" class="btn-save-as">Save As...</button>
            <button onclick="resetScenario()" class="btn-reset">Reset Scenario</button>
        </div>
    `;
}

function renderPlanningMode() {
    currentMode = 'planning';
    
    const planningEl = document.getElementById('planning-mode');
    const reviewEl = document.getElementById('review-mode');
    
    if (planningEl) planningEl.style.display = 'block';
    if (reviewEl) reviewEl.style.display = 'none';
    
    renderClinicians();
    renderMVPs();
    renderDetails();
}

// Keep all other existing functions from original app.js
// (renderClinicians, renderMVPs, renderDetails, renderCliniciansTab, renderWorkTab, etc.)

function renderClinicians() {
    const container = document.getElementById('clinician-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    
    if (unassigned.length === 0) {
        container.innerHTML = '<div class="empty-state">All clinicians assigned!</div>';
        return;
    }
    
    unassigned.forEach(clinician => {
        const div = document.createElement('div');
        div.className = 'clinician-item';
        if (selectedClinicians.has(clinician.npi)) {
            div.classList.add('selected');
        }
        div.dataset.npi = clinician.npi;
        
        div.innerHTML = `
            <input type="checkbox" 
                   ${selectedClinicians.has(clinician.npi) ? 'checked' : ''} 
                   onclick="event.stopPropagation(); toggleSelection('${clinician.npi}')">
            <div class="clinician-info">
                <strong>${clinician.name}</strong>
                <small>${clinician.specialty}</small>
                <small class="npi">NPI: ${clinician.npi}</small>
            </div>
        `;
        
        div.onclick = () => toggleSelection(clinician.npi);
        container.appendChild(div);
    });
}

function renderMVPs() {
    const container = document.getElementById('mvp-cards');
    if (!container) return;
    
    container.innerHTML = '';
    
    const activeMVPs = mvps.filter(mvp => assignments[mvp.mvp_id]?.length > 0);
    
    if (activeMVPs.length === 0) {
        container.innerHTML = `
            <div class="empty-mvp-state">
                <h3>No Active MVPs</h3>
                <p>Select clinicians and assign them to an MVP using the dropdown above.</p>
                <p>Or go to TIN Analysis to auto-create subgroups.</p>
            </div>
        `;
        return;
    }
    
    activeMVPs.forEach(mvp => {
        const assigned = assignments[mvp.mvp_id] || [];
        const selections = mvpSelections[mvp.mvp_id];
        
        const div = document.createElement('div');
        div.className = 'mvp-card';
        if (currentMVP === mvp.mvp_id) {
            div.classList.add('active');
        }
        div.onclick = () => selectMVP(mvp.mvp_id);
        
        div.innerHTML = `
            <h4>${mvp.mvp_name}</h4>
            <div class="mvp-meta">
                <span>Clinicians: ${assigned.length}</span>
                ${selections ? `<span>Measures: ${selections.measures.length}/4</span>` : ''}
            </div>
            <div class="mvp-specialties">${mvp.specialties}</div>
            <div class="mvp-clinician-list">
                ${assigned.slice(0, 3).map(npi => {
                    const c = clinicians.find(cl => cl.npi === npi);
                    return c ? `<div class="mini-clinician">${c.name}</div>` : '';
                }).join('')}
                ${assigned.length > 3 ? `<div class="more">+${assigned.length - 3} more</div>` : ''}
            </div>
            <button onclick="event.stopPropagation(); removeAllFromMVP('${mvp.mvp_id}')" class="remove-mvp">Remove All</button>
        `;
        
        container.appendChild(div);
    });
}

function renderDetails() {
    if (!currentMVP) {
        const measuresEl = document.getElementById('mvp-details');
        const cliniciansEl = document.getElementById('clinicians-details');
        
        if (measuresEl) measuresEl.innerHTML = '<div class="empty-state">Select an MVP to configure</div>';
        if (cliniciansEl) cliniciansEl.innerHTML = '<div class="empty-state">Select an MVP to view clinicians</div>';
        return;
    }
    
    const mvp = mvps.find(m => m.mvp_id === currentMVP);
    if (!mvp) return;
    
    renderEnhancedMeasuresTab(mvp);
    renderCliniciansTab(mvp);
}

function renderCliniciansTab(mvp) {
    const container = document.getElementById('clinicians-details');
    if (!container) return;
    
    const assigned = assignments[mvp.mvp_id] || [];
    
    let html = `
        <h3>Assigned Clinicians (${assigned.length})</h3>
        <div class="clinician-table">
    `;
    
    assigned.forEach(npi => {
        const clinician = clinicians.find(c => c.npi === npi);
        if (!clinician) return;
        
        html += `
            <div class="clinician-row">
                <div>${clinician.name}</div>
                <div>${clinician.specialty}</div>
                <div>${clinician.npi}</div>
                <button onclick="removeFromMVP('${npi}', '${mvp.mvp_id}')" class="btn-remove">Remove</button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Keep all Review Mode functions from original
function renderReviewMode() {
    currentMode = 'review';
    
    const planningEl = document.getElementById('planning-mode');
    const reviewEl = document.getElementById('review-mode');
    
    if (planningEl) planningEl.style.display = 'none';
    if (reviewEl) reviewEl.style.display = 'block';
    
    // Use original renderReviewMode logic here
    // ... (keep all the original review mode code)
}

// Keep all helper functions from original
function toggleSelection(npi) {
    if (selectedClinicians.has(npi)) {
        selectedClinicians.delete(npi);
    } else {
        selectedClinicians.add(npi);
    }
    renderClinicians();
    filterClinicians();
}

function selectAllVisible() {
    const searchTerm = document.getElementById('search-box')?.value.toLowerCase() || '';
    const specialty = document.getElementById('specialty-filter')?.value || '';
    
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    
    unassigned.forEach(clinician => {
        const matchesSearch = !searchTerm || 
            clinician.name.toLowerCase().includes(searchTerm) ||
            clinician.npi.includes(searchTerm);
        
        const matchesSpecialty = !specialty || clinician.specialty === specialty;
        
        if (matchesSearch && matchesSpecialty) {
            selectedClinicians.add(clinician.npi);
        }
    });
    
    renderClinicians();
    filterClinicians();
}

function clearSelection() {
    selectedClinicians.clear();
    renderClinicians();
    filterClinicians();
}

function filterClinicians() {
    const searchTerm = document.getElementById('search-box')?.value.toLowerCase() || '';
    const specialty = document.getElementById('specialty-filter')?.value || '';
    
    const items = document.querySelectorAll('.clinician-item');
    items.forEach(item => {
        const clinician = clinicians.find(c => c.npi === item.dataset.npi);
        if (!clinician) return;
        
        const matchesSearch = !searchTerm || 
            clinician.name.toLowerCase().includes(searchTerm) ||
            clinician.npi.includes(searchTerm);
        
        const matchesSpecialty = !specialty || clinician.specialty === specialty;
        
        item.style.display = matchesSearch && matchesSpecialty ? 'flex' : 'none';
    });
}

function assignSelectedToMVP() {
    const mvpId = document.getElementById('mvp-selector')?.value;
    
    if (!mvpId) {
        alert('Please select an MVP from the dropdown');
        return;
    }
    
    if (selectedClinicians.size === 0) {
        alert('Please select clinicians to assign');
        return;
    }
    
    if (!assignments[mvpId]) {
        assignments[mvpId] = [];
    }
    
    selectedClinicians.forEach(npi => {
        // Remove from any other MVP
        for (let id in assignments) {
            assignments[id] = assignments[id].filter(n => n !== npi);
        }
        // Add to selected MVP
        assignments[mvpId].push(npi);
    });
    
    selectedClinicians.clear();
    renderClinicians();
    renderMVPs();
    updateStats();
    filterClinicians();
}

function selectMVP(mvpId) {
    currentMVP = mvpId;
    renderMVPs();
    renderDetails();
}

function removeAllFromMVP(mvpId) {
    if (confirm('Remove all clinicians from this MVP?')) {
        delete assignments[mvpId];
        delete mvpSelections[mvpId];
        delete mvpPerformance[mvpId];
        
        if (currentMVP === mvpId) {
            currentMVP = null;
        }
        
        renderClinicians();
        renderMVPs();
        renderDetails();
        updateStats();
    }
}

function removeFromMVP(npi, mvpId) {
    assignments[mvpId] = assignments[mvpId].filter(n => n !== npi);
    
    if (assignments[mvpId].length === 0) {
        delete assignments[mvpId];
        delete mvpSelections[mvpId];
        
        if (currentMVP === mvpId) {
            currentMVP = null;
        }
    }
    
    renderClinicians();
    renderMVPs();
    renderDetails();
    updateStats();
}

function toggleMeasure(mvpId, measureId) {
    if (!mvpSelections[mvpId]) {
        mvpSelections[mvpId] = { measures: [], configs: {} };
    }
    
    const selections = mvpSelections[mvpId];
    const index = selections.measures.indexOf(measureId);
    
    if (index === -1) {
        if (selections.measures.length >= 4) {
            alert('You can only select 4 measures per MVP');
            event.target.checked = false;
            return;
        }
        
        const measure = measures.find(m => m.measure_id === measureId);
        const availableTypes = measure?.collection_types ? 
            measure.collection_types.split(',').map(t => t.trim()) : ['MIPS CQM'];
        
        selections.measures.push(measureId);
        selections.configs[measureId] = {
            collectionType: availableTypes[0],
            difficulty: measure?.difficulty || 'Medium'
        };
    } else {
        selections.measures.splice(index, 1);
        delete selections.configs[measureId];
    }
    
    renderDetails();
}

function setCollectionType(mvpId, measureId, value) {
    if (!mvpSelections[mvpId]) {
        mvpSelections[mvpId] = { measures: [], configs: {} };
    }
    
    if (!mvpSelections[mvpId].configs[measureId]) {
        mvpSelections[mvpId].configs[measureId] = {};
    }
    
    mvpSelections[mvpId].configs[measureId].collectionType = value;
}

// Scenario Management
function saveScenario() {
    const scenarioData = {
        name: currentScenarioName,
        timestamp: new Date().toISOString(),
        assignments: assignments,
        selections: mvpSelections,
        performance: mvpPerformance,
        measureEstimates: measureEstimates,
        measureConfigurations: measureConfigurations,
        yearlyPlan: yearlyPlan
    };
    
    savedScenarios[currentScenarioName] = scenarioData;
    localStorage.setItem('mvp_scenarios', JSON.stringify(savedScenarios));
    
    alert(`Scenario "${currentScenarioName}" saved successfully!`);
    setupFilters();
}

function saveAsNewScenario() {
    const name = prompt('Enter a name for this scenario:');
    if (!name) return;
    
    currentScenarioName = name;
    saveScenario();
}

function loadScenario(name) {
    if (!savedScenarios[name]) {
        if (name !== 'Default') {
            alert('Scenario not found');
        }
        return;
    }
    
    const scenario = savedScenarios[name];
    currentScenarioName = name;
    assignments = scenario.assignments || {};
    mvpSelections = scenario.selections || {};
    mvpPerformance = scenario.performance || {};
    measureEstimates = scenario.measureEstimates || {};
    measureConfigurations = scenario.measureConfigurations || {};
    yearlyPlan = scenario.yearlyPlan || yearlyPlan;
    
    renderPlanningMode();
    updateStats();
}

function resetScenario() {
    if (!confirm('Are you sure you want to reset the current scenario? This will clear all assignments and selections.')) {
        return;
    }
    
    assignments = {};
    mvpSelections = {};
    mvpPerformance = {};
    measureEstimates = {};
    measureConfigurations = {};
    selectedClinicians.clear();
    selectedSpecialties.clear();
    currentMVP = null;
    
    renderTINAnalysis();
    updateStats();
}

function loadSavedScenarios() {
    const saved = localStorage.getItem('mvp_scenarios');
    if (saved) {
        try {
            savedScenarios = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading saved scenarios:', e);
            savedScenarios = {};
        }
    }
}

// Utility functions
function isClinicianAssigned(npi) {
    for (let mvpId in assignments) {
        if (assignments[mvpId].includes(npi)) {
            return true;
        }
    }
    return false;
}

function updateStats() {
    const assignedCount = Object.values(assignments).flat().length;
    const activeMVPs = Object.keys(assignments).filter(id => assignments[id]?.length > 0).length;
    
    const clinCountEl = document.getElementById('clinician-count');
    const assignedEl = document.getElementById('assigned-count');
    const mvpCountEl = document.getElementById('mvp-count');
    const activeEl = document.getElementById('active-mvps');
    const measureEl = document.getElementById('measure-count');
    
    if (clinCountEl) clinCountEl.textContent = clinicians.length;
    if (assignedEl) assignedEl.textContent = assignedCount;
    if (mvpCountEl) mvpCountEl.textContent = mvps.length;
    if (activeEl) activeEl.textContent = activeMVPs;
    if (measureEl) measureEl.textContent = measures.length;
}

function toggleMode() {
    if (currentMode === 'planning') {
        renderReviewMode();
    } else {
        renderPlanningMode();
    }
}

function switchDetailTab(tab) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
        const tabEl = document.getElementById(`${tab}-tab`);
        if (tabEl) tabEl.classList.add('active');
    }
}

function setupEventHandlers() {
    // Any additional event handlers can go here
}

// Export functions for global access
window.switchToMode = switchToMode;
window.toggleSpecialtySelection = toggleSpecialtySelection;
window.autoGenerateRecommendations = autoGenerateRecommendations;
window.createSubgroups = createSubgroups;
window.selectYear = selectYear;
window.updateMeasureEstimate = updateMeasureEstimate;
window.calculateTotalScores = calculateTotalScores;
window.updateMeasureConfig = updateMeasureConfig;
window.toggleSelection = toggleSelection;
window.selectAllVisible = selectAllVisible;
window.clearSelection = clearSelection;
window.assignSelectedToMVP = assignSelectedToMVP;
window.filterClinicians = filterClinicians;
window.selectMVP = selectMVP;
window.removeAllFromMVP = removeAllFromMVP;
window.removeFromMVP = removeFromMVP;
window.toggleMeasure = toggleMeasure;
window.setCollectionType = setCollectionType;
window.toggleMode = toggleMode;
window.switchDetailTab = switchDetailTab;
window.exportPlan = exportPlan;
window.saveScenario = saveScenario;
window.saveAsNewScenario = saveAsNewScenario;
window.loadScenario = loadScenario;
window.resetScenario = resetScenario;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
