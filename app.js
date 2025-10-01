// MVP Strategic Planning Tool - Complete Working Version
console.log('MVP Tool Starting - Complete Version v3.0...');

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
let currentMode = 'planning';
let savedScenarios = {};
let currentScenarioName = 'Default';

// Initialize the application
async function init() {
    console.log('Initializing MVP tool...');
    const statusEl = document.getElementById('connection-status');
    
    try {
        statusEl.textContent = 'Loading data from Google Sheets...';
        statusEl.className = 'status-loading';
        
        await loadData();
        
        statusEl.textContent = `Connected! Loaded ${clinicians.length} clinicians and ${mvps.length} MVPs`;
        statusEl.className = 'status-success';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
        
        document.getElementById('main-app').style.display = 'block';
        
        // Load saved scenarios from localStorage
        loadSavedScenarios();
        
        setupInterface();
        renderPlanningMode();
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusEl.textContent = `Error: ${error.message}. Please refresh the page.`;
        statusEl.className = 'status-error';
    }
}

// Load data from API - Using correct [sheet].js format
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
        
        // Load measures
        console.log('Fetching measures from /api/sheets/measures...');
        const measuresResponse = await fetch('/api/sheets/measures');
        
        if (measuresResponse.ok) {
            const measuresData = await measuresResponse.json();
            
            measures = measuresData.map(row => ({
                measure_id: row.measure_id || row['Measure ID'] || '',
                measure_name: row.measure_name || row['Measure Name'] || '',
                is_activated: row.is_activated || row['Is Activated'] || 'N',
                collection_types: row.collection_types || row['Collection Types'] || 'MIPS CQM',
                difficulty: row.difficulty || row['Difficulty'] || 'Medium'
            }));
            
            console.log(`Loaded ${measures.length} measures`);
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Unable to load data. Using demo data.');
        
        // Demo data
        clinicians = [
            { npi: '1234567890', name: 'John Smith', specialty: 'Family Practice', tin: '123456789' },
            { npi: '0987654321', name: 'Jane Doe', specialty: 'Emergency Medicine', tin: '123456789' }
        ];
        
        mvps = [
            { mvp_id: 'MVP001', mvp_name: 'Primary Care MVP', specialties: 'Family Medicine', available_measures: 'Q001,Q112' }
        ];
    }
    
    updateStats();
}

// Setup interface
function setupInterface() {
    setupFilters();
    setupEventHandlers();
}

// Setup filters with scenario management
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

// Render planning mode
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

// Render clinicians
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

// Render MVP cards
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

// Render details panel
function renderDetails() {
    if (!currentMVP) {
        const measuresEl = document.getElementById('mvp-details');
        const cliniciansEl = document.getElementById('clinicians-details');
        const workEl = document.getElementById('work-details');
        
        if (measuresEl) measuresEl.innerHTML = '<div class="empty-state">Select an MVP to configure</div>';
        if (cliniciansEl) cliniciansEl.innerHTML = '<div class="empty-state">Select an MVP to view clinicians</div>';
        if (workEl) workEl.innerHTML = '<div class="empty-state">Select an MVP to view work plan</div>';
        return;
    }
    
    const mvp = mvps.find(m => m.mvp_id === currentMVP);
    if (!mvp) return;
    
    renderMeasuresTab(mvp);
    renderCliniciansTab(mvp);
    renderWorkTab(mvp);
}

// Render measures tab with collection types visible
function renderMeasuresTab(mvp) {
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
        const availableTypes = measure.collection_types ? 
            measure.collection_types.split(',').map(t => t.trim()) : ['MIPS CQM'];
        
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
                            <span class="collection-types">Available: ${availableTypes.join(', ')}</span>
                            <span class="difficulty difficulty-${(measure.difficulty || 'Medium').toLowerCase()}">
                                ${measure.difficulty || 'Medium'} Implementation
                            </span>
                        </div>
                        ${isActivated ? '<span class="badge activated">Already Activated</span>' : '<span class="badge new">New Measure</span>'}
                    </div>
                </label>
                ${isSelected && availableTypes.length > 1 ? `
                    <div class="measure-config">
                        <label>Select Collection Type:</label>
                        <select onchange="setCollectionType('${mvp.mvp_id}', '${measureId}', this.value)">
                            ${availableTypes.map(type => 
                                `<option value="${type}" ${selections.configs[measureId]?.collectionType === type ? 'selected' : ''}>${type}</option>`
                            ).join('')}
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Render clinicians tab
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

// Render work tab
function renderWorkTab(mvp) {
    const container = document.getElementById('work-details');
    if (!container) return;
    
    const selections = mvpSelections[mvp.mvp_id];
    
    if (!selections || selections.measures.length === 0) {
        container.innerHTML = '<div class="empty-state">Select measures to see work requirements</div>';
        return;
    }
    
    let html = `
        <h3>Implementation Work Plan</h3>
        <div class="work-items">
    `;
    
    selections.measures.forEach(measureId => {
        const measure = measures.find(m => m.measure_id === measureId);
        if (!measure || measure.is_activated === 'Y') return;
        
        const config = selections.configs[measureId] || {};
        
        html += `
            <div class="work-item">
                <h4>${measureId}: ${measure.measure_name}</h4>
                <div class="work-meta">
                    <span>Selected Type: ${config.collectionType}</span>
                    <span>Difficulty: ${measure.difficulty || 'Medium'}</span>
                </div>
                <p>Requires measure implementation, workflow review, validation, and staff training.</p>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Review Mode
// 1. Fix the renderReviewMode function to show better styling for MVP list
function renderReviewMode() {
    currentMode = 'review';
    
    const planningEl = document.getElementById('planning-mode');
    const reviewEl = document.getElementById('review-mode');
    
    if (planningEl) planningEl.style.display = 'none';
    if (reviewEl) reviewEl.style.display = 'block';
    
    const listContainer = document.getElementById('review-mvp-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const activeMVPs = mvps.filter(mvp => 
        assignments[mvp.mvp_id]?.length > 0 && 
        mvpSelections[mvp.mvp_id]?.measures.length > 0
    );
    
    if (activeMVPs.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No MVPs configured</div>';
        return;
    }
    
    activeMVPs.forEach(mvp => {
        const score = calculateMVPScore(mvp.mvp_id);
        
        const div = document.createElement('div');
        div.className = `review-mvp-item ${currentMVP === mvp.mvp_id ? 'active' : ''}`;
        div.onclick = () => selectReviewMVP(mvp.mvp_id);
        
        // Fixed: Better contrast for the text
        div.innerHTML = `
            <div>
                <div class="mvp-name">${mvp.mvp_name}</div>
                <div class="mvp-meta-small" style="color: #6c757d;">
                    ${assignments[mvp.mvp_id].length} clinicians, 
                    ${mvpSelections[mvp.mvp_id].measures.length} measures
                </div>
            </div>
            <div class="mvp-score">${score.toFixed(1)}</div>
        `;
        
        listContainer.appendChild(div);
    });
    
    if (!currentMVP && activeMVPs.length > 0) {
        selectReviewMVP(activeMVPs[0].mvp_id);
    }
    
    updateOverallScore();
}

function selectReviewMVP(mvpId) {
    currentMVP = mvpId;
    renderPerformanceEntry(mvpId);
}

function renderPerformanceEntry(mvpId) {
    const container = document.getElementById('review-content');
    if (!container) return;
    
    const mvp = mvps.find(m => m.mvp_id === mvpId);
    const selections = mvpSelections[mvpId];
    const assigned = assignments[mvpId] || [];
    
    if (!selections || selections.measures.length === 0 || assigned.length === 0) {
        container.innerHTML = '<div class="empty-state">No data to display</div>';
        return;
    }
    
    let html = `
        <div class="performance-header">
            <h2>${mvp.mvp_name}</h2>
            <div class="measure-tabs">
    `;
    
    selections.measures.forEach((measureId, index) => {
        const measure = measures.find(m => m.measure_id === measureId);
        html += `
            <div class="measure-tab ${index === 0 ? 'active' : ''}" 
                 onclick="switchMeasureTab('${mvpId}', '${measureId}', this)">
                ${measureId}
                <span class="tab-score">0.0</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        <div id="performance-table-container">
            ${renderPerformanceTable(mvpId, selections.measures[0])}
        </div>
    `;
    
    container.innerHTML = html;
}

// 2. Fix renderPerformanceEntry to show measure NAMES instead of IDs
function renderPerformanceEntry(mvpId) {
    const container = document.getElementById('review-content');
    if (!container) return;
    
    const mvp = mvps.find(m => m.mvp_id === mvpId);
    const selections = mvpSelections[mvpId];
    const assigned = assignments[mvpId] || [];
    
    if (!selections || selections.measures.length === 0 || assigned.length === 0) {
        container.innerHTML = '<div class="empty-state">No data to display</div>';
        return;
    }
    
    let html = `
        <div class="performance-header">
            <h2>${mvp.mvp_name}</h2>
            <div class="mvp-summary">
                <span>${assigned.length} Clinicians</span>
                <span>${selections.measures.length} Measures</span>
            </div>
            <div class="measure-tabs">
    `;
    
    selections.measures.forEach((measureId, index) => {
        const measure = measures.find(m => m.measure_id === measureId);
        const score = calculateMeasureScore(mvpId, measureId);
        
        // Show measure NAME instead of just ID
        const displayName = measure ? 
            `${measure.measure_name}` : 
            `${measureId}`;
        
        html += `
            <div class="measure-tab ${index === 0 ? 'active' : ''}" 
                 onclick="switchMeasureTab('${mvpId}', '${measureId}', this)"
                 title="${measureId}: ${measure?.measure_name || ''}">
                ${displayName}
                <span class="tab-score">${score.toFixed(1)}</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        <div id="performance-table-container">
            ${renderPerformanceTable(mvpId, selections.measures[0])}
        </div>
    `;
    
    container.innerHTML = html;
}
// 3. Fix renderPerformanceTable to properly initialize and calculate deciles
function renderPerformanceTable(mvpId, measureId) {
    const assigned = assignments[mvpId] || [];
    const config = mvpSelections[mvpId]?.configs[measureId] || {};
    
    if (assigned.length === 0) {
        return '<div class="empty-state">No clinicians assigned</div>';
    }
    
    // Initialize performance data if it doesn't exist
    if (!mvpPerformance[mvpId]) {
        mvpPerformance[mvpId] = {};
    }
    
    let html = `
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Clinician</th>
                    <th>Specialty</th>
                    <th>Performance Rate (%)</th>
                    <th>Decile</th>
                    <th>Points</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    assigned.forEach(npi => {
        const clinician = clinicians.find(c => c.npi === npi);
        if (!clinician) return;
        
        const perfKey = `${measureId}_${npi}`;
        const perfRate = mvpPerformance[mvpId]?.[perfKey] || 0;
        const decileInfo = calculateDecile(measureId, config.collectionType || 'MIPS CQM', perfRate);
        
        html += `
            <tr>
                <td>${clinician.name}</td>
                <td>${clinician.specialty}</td>
                <td>
                    <input type="number" 
                           value="${perfRate}" 
                           min="0" max="100" step="0.1"
                           onchange="updatePerformance('${mvpId}', '${measureId}', '${npi}', this.value)">
                </td>
                <td class="decile decile-${decileInfo.decile}">${decileInfo.decile}</td>
                <td class="points">${decileInfo.points.toFixed(1)}</td>
            </tr>
        `;
    });
    
    const avgPerf = calculateMeasureAverage(mvpId, measureId);
    const avgScore = calculateMeasureScore(mvpId, measureId);
    
    html += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2"><strong>Measure Average</strong></td>
                    <td><strong>${avgPerf.toFixed(1)}%</strong></td>
                    <td colspan="2"><strong>${avgScore.toFixed(1)} pts</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
    
    return html;
}
// Selection functions
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
        performance: mvpPerformance
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
        alert('Scenario not found');
        return;
    }
    
    const scenario = savedScenarios[name];
    currentScenarioName = name;
    assignments = scenario.assignments || {};
    mvpSelections = scenario.selections || {};
    mvpPerformance = scenario.performance || {};
    
    renderPlanningMode();
    updateStats();
}

function resetScenario() {
    if (!confirm('Are you sure you want to reset the current scenario?')) {
        return;
    }
    
    assignments = {};
    mvpSelections = {};
    mvpPerformance = {};
    selectedClinicians.clear();
    currentMVP = null;
    
    renderPlanningMode();
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

function switchMeasureTab(mvpId, measureId, tabElement) {
    document.querySelectorAll('.measure-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    tabElement.classList.add('active');
    
    const container = document.getElementById('performance-table-container');
    if (container) {
        container.innerHTML = renderPerformanceTable(mvpId, measureId);
    }
}

/ 4. Fix updatePerformance to properly refresh the display
function updatePerformance(mvpId, measureId, npi, value) {
    if (!mvpPerformance[mvpId]) {
        mvpPerformance[mvpId] = {};
    }
    
    mvpPerformance[mvpId][`${measureId}_${npi}`] = parseFloat(value) || 0;
    
    // Re-render the current table with updated values
    const container = document.getElementById('performance-table-container');
    if (container) {
        container.innerHTML = renderPerformanceTable(mvpId, measureId);
    }
    
    // Update the score in the sidebar
    const listItems = document.querySelectorAll('.review-mvp-item');
    listItems.forEach(item => {
        if (item.querySelector('.mvp-name')?.textContent === mvps.find(m => m.mvp_id === mvpId)?.mvp_name) {
            const score = calculateMVPScore(mvpId);
            const scoreEl = item.querySelector('.mvp-score');
            if (scoreEl) scoreEl.textContent = score.toFixed(1);
        }
    });
    
    // Update overall score
    updateOverallScore();
}
// 5. Fix calculateDecile with proper thresholds
function calculateDecile(measureId, collectionType, performanceRate) {
    // More realistic decile calculation
    if (performanceRate >= 95) return { decile: 10, points: 10 };
    if (performanceRate >= 90) return { decile: 9, points: 9.0 };
    if (performanceRate >= 85) return { decile: 8, points: 8.0 };
    if (performanceRate >= 80) return { decile: 7, points: 7.0 };
    if (performanceRate >= 75) return { decile: 6, points: 6.0 };
    if (performanceRate >= 70) return { decile: 5, points: 5.0 };
    if (performanceRate >= 60) return { decile: 4, points: 4.0 };
    if (performanceRate >= 50) return { decile: 3, points: 3.0 };
    if (performanceRate >= 40) return { decile: 2, points: 2.0 };
    return { decile: 1, points: 1.0 };
}
// 6. Fix calculation functions
function calculateMeasureAverage(mvpId, measureId) {
    const assigned = assignments[mvpId] || [];
    let total = 0;
    let count = 0;
    
    assigned.forEach(npi => {
        const perfKey = `${measureId}_${npi}`;
        const perfRate = mvpPerformance[mvpId]?.[perfKey];
        if (perfRate !== undefined && perfRate !== null) {
            total += perfRate;
            count++;
        }
    });
    
    return count > 0 ? total / count : 0;
}
function calculateMeasureScore(mvpId, measureId) {
    const avg = calculateMeasureAverage(mvpId, measureId);
    const config = mvpSelections[mvpId]?.configs[measureId] || {};
    const decileInfo = calculateDecile(measureId, config.collectionType || 'MIPS CQM', avg);
    return decileInfo.points;
}
function calculateMVPScore(mvpId) {
    const selections = mvpSelections[mvpId];
    if (!selections || selections.measures.length === 0) return 0;
    
    let totalScore = 0;
    selections.measures.forEach(measureId => {
        totalScore += calculateMeasureScore(mvpId, measureId);
    });
    
    return selections.measures.length > 0 ? totalScore / selections.measures.length : 0;
}
function updateOverallScore() {
    const activeMVPs = mvps.filter(mvp => 
        assignments[mvp.mvp_id]?.length > 0 && 
        mvpSelections[mvp.mvp_id]?.measures.length > 0
    );
    
    let totalScore = 0;
    let totalClinicians = 0;
    let totalMeasures = 0;
    
    activeMVPs.forEach(mvp => {
        const score = calculateMVPScore(mvp.mvp_id);
        const clinicianCount = assignments[mvp.mvp_id].length;
        totalScore += score * clinicianCount;
        totalClinicians += clinicianCount;
        
        if (mvpSelections[mvp.mvp_id]) {
            totalMeasures += mvpSelections[mvp.mvp_id].measures.length;
        }
    });
    
    const overallScore = totalClinicians > 0 ? totalScore / totalClinicians : 0;
    
    const displayEl = document.getElementById('overall-score-display');
    if (displayEl) {
        displayEl.textContent = overallScore.toFixed(1);
    }
    
    const measuresEl = document.getElementById('total-measures');
    if (measuresEl) {
        measuresEl.textContent = totalMeasures;
    }
    
    const pointsEl = document.getElementById('avg-points');
    if (pointsEl) {
        pointsEl.textContent = overallScore.toFixed(1);
    }
}
function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        scenario: currentScenarioName,
        assignments: assignments,
        selections: mvpSelections,
        performance: mvpPerformance
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-plan-${currentScenarioName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function setupEventHandlers() {
    // Any additional event handlers can go here
}

// Export functions for global access
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
window.updatePerformance = updatePerformance;
window.switchMeasureTab = switchMeasureTab;
window.selectReviewMVP = selectReviewMVP;
window.saveScenario = saveScenario;
window.saveAsNewScenario = saveAsNewScenario;
window.loadScenario = loadScenario;
window.resetScenario = resetScenario;
window.renderReviewMode = renderReviewMode;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
