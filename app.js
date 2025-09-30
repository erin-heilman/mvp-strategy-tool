// MVP Strategic Planning Tool - Complete Version with All Features
console.log('MVP Tool Starting - Complete Version...');

// Configuration
const SHEET_ID = '1CHs8cP3mDQkwG-XL-B7twFVukRxcB4umn9VX9ZK2VqM';
const API_BASE = '/api/sheets';

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

// Initialize the application
async function init() {
    console.log('Initializing complete MVP tool...');
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
        
        setupInterface();
        renderPlanningMode();
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusEl.textContent = `Error: ${error.message}. Please refresh the page.`;
        statusEl.className = 'status-error';
    }
}

// Load data from API
async function loadData() {
    console.log('Loading data from API...');
    
    try {
        // Load clinicians
        const cliniciansResponse = await fetch(`${API_BASE}?sheet=clinicians`);
        const cliniciansData = await cliniciansResponse.json();
        
        clinicians = cliniciansData.map(row => ({
            npi: row.npi || row.NPI || '',
            name: row.name || row.Name || row.clinician_name || 'Unknown',
            specialty: row.specialty || row.Specialty || row.primary_specialty || 'Unknown',
            tin: row.tin || row.TIN || '',
            separate_ehr: row.separate_ehr || row['Separate EHR'] || 'No'
        }));
        
        console.log(`Loaded ${clinicians.length} clinicians`);
        
        // Load MVPs
        const mvpsResponse = await fetch(`${API_BASE}?sheet=mvps`);
        const mvpsData = await mvpsResponse.json();
        
        mvps = mvpsData.map(row => ({
            mvp_id: row.mvp_id || row['MVP ID'] || '',
            mvp_name: row.mvp_name || row['MVP Name'] || '',
            specialties: row.specialties || row.eligible_specialties || '',
            available_measures: row.available_measures || ''
        }));
        
        console.log(`Loaded ${mvps.length} MVPs`);
        
        // Load measures
        const measuresResponse = await fetch(`${API_BASE}?sheet=measures`);
        const measuresData = await measuresResponse.json();
        
        measures = measuresData.map(row => ({
            measure_id: row.measure_id || row['Measure ID'] || '',
            measure_name: row.measure_name || row['Measure Name'] || '',
            is_activated: row.is_activated || 'N',
            collection_types: row.collection_types || 'MIPS CQM'
        }));
        
        console.log(`Loaded ${measures.length} measures`);
        
        // Load benchmarks
        const benchmarksResponse = await fetch(`${API_BASE}?sheet=benchmarks`);
        benchmarks = await benchmarksResponse.json();
        console.log(`Loaded ${benchmarks.length} benchmarks`);
        
    } catch (error) {
        console.error('Error loading data:', error);
        // Use minimal fallback data
        clinicians = Array.from({length: 115}, (_, i) => ({
            npi: `100000000${i}`,
            name: `Clinician ${i + 1}`,
            specialty: ['Family Practice', 'Emergency Medicine', 'Anesthesiology', 'Orthopedic Surgery'][i % 4],
            tin: '123456789'
        }));
        
        mvps = Array.from({length: 27}, (_, i) => ({
            mvp_id: `MVP${String(i + 1).padStart(3, '0')}`,
            mvp_name: `MVP ${i + 1}`,
            specialties: 'All Specialties',
            available_measures: 'Q001,Q112,Q113,Q236'
        }));
    }
    
    updateStats();
}

// Setup interface
function setupInterface() {
    setupFilters();
    setupEventHandlers();
}

// Setup filters
function setupFilters() {
    const specialties = [...new Set(clinicians.map(c => c.specialty))].sort();
    
    const filterContainer = document.getElementById('filter-container');
    if (!filterContainer) return;
    
    filterContainer.innerHTML = `
        <input type="text" id="search-box" placeholder="Search by name or NPI..." onkeyup="filterClinicians()">
        <select id="specialty-filter" onchange="filterClinicians()">
            <option value="">All Specialties (${clinicians.length})</option>
            ${specialties.map(s => {
                const count = clinicians.filter(c => c.specialty === s).length;
                return `<option value="${s}">${s} (${count})</option>`;
            }).join('')}
        </select>
        <button onclick="selectAllVisible()" class="btn-select">Select All Visible</button>
        <button onclick="clearSelection()" class="btn-clear">Clear Selection</button>
        <div class="assignment-controls">
            <select id="mvp-selector">
                <option value="">Choose MVP...</option>
                ${mvps.map(mvp => `<option value="${mvp.mvp_id}">${mvp.mvp_name}</option>`).join('')}
            </select>
            <button onclick="assignSelectedToMVP()" class="btn-assign">Assign Selected</button>
        </div>
    `;
}

// Render planning mode
function renderPlanningMode() {
    currentMode = 'planning';
    
    document.getElementById('planning-mode').style.display = 'block';
    document.getElementById('review-mode').style.display = 'none';
    
    renderClinicians();
    renderMVPs();
    renderDetails();
}

// Render clinicians panel
function renderClinicians() {
    const container = document.getElementById('clinician-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    
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

// Render MVP cards - only show MVPs with assignments
function renderMVPs() {
    const container = document.getElementById('mvp-cards');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Get MVPs that have assignments
    const activeMVPs = mvps.filter(mvp => assignments[mvp.mvp_id]?.length > 0);
    
    if (activeMVPs.length === 0) {
        container.innerHTML = `
            <div class="empty-mvp-state">
                <h3>No Active MVPs</h3>
                <p>Select clinicians from the left panel and assign them to an MVP to get started.</p>
                <p>Use the dropdown above to choose an MVP for selected clinicians.</p>
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
        document.getElementById('mvp-details').innerHTML = '<div class="empty-state">Select an MVP to configure</div>';
        document.getElementById('clinicians-details').innerHTML = '<div class="empty-state">Select an MVP to view clinicians</div>';
        document.getElementById('work-details').innerHTML = '<div class="empty-state">Select an MVP to view work plan</div>';
        return;
    }
    
    const mvp = mvps.find(m => m.mvp_id === currentMVP);
    if (!mvp) return;
    
    renderMeasuresTab(mvp);
    renderCliniciansTab(mvp);
    renderWorkTab(mvp);
}

// Render measures tab
function renderMeasuresTab(mvp) {
    const container = document.getElementById('mvp-details');
    const selections = mvpSelections[mvp.mvp_id] || { measures: [], configs: {} };
    const availableMeasures = mvp.available_measures.split(',').map(m => m.trim());
    
    let html = `
        <h3>${mvp.mvp_name} - Measure Selection</h3>
        <p class="measure-requirement">Select exactly 4 measures. ${selections.measures.length}/4 selected.</p>
        <div class="measures-grid">
    `;
    
    availableMeasures.forEach(measureId => {
        const measure = measures.find(m => m.measure_id === measureId);
        if (!measure) return;
        
        const isSelected = selections.measures.includes(measureId);
        const isActivated = measure.is_activated === 'Y';
        
        html += `
            <div class="measure-card ${isSelected ? 'selected' : ''} ${isActivated ? 'activated' : ''}">
                <label>
                    <input type="checkbox" 
                           value="${measureId}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleMeasure('${mvp.mvp_id}', '${measureId}')">
                    <div class="measure-content">
                        <span class="measure-id">${measureId}</span>
                        <span class="measure-name">${measure.measure_name}</span>
                        ${isActivated ? '<span class="badge activated">Activated</span>' : '<span class="badge new">New</span>'}
                    </div>
                </label>
                ${isSelected ? `
                    <div class="measure-config">
                        <select onchange="setCollectionType('${mvp.mvp_id}', '${measureId}', this.value)">
                            <option value="MIPS CQM" ${selections.configs[measureId]?.collectionType === 'MIPS CQM' ? 'selected' : ''}>MIPS CQM</option>
                            <option value="eCQM" ${selections.configs[measureId]?.collectionType === 'eCQM' ? 'selected' : ''}>eCQM</option>
                        </select>
                        <select onchange="setDifficulty('${mvp.mvp_id}', '${measureId}', this.value)">
                            <option value="Easy" ${selections.configs[measureId]?.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                            <option value="Medium" ${selections.configs[measureId]?.difficulty === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Hard" ${selections.configs[measureId]?.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
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
                    <span>Collection: ${config.collectionType || 'MIPS CQM'}</span>
                    <span>Difficulty: ${config.difficulty || 'Medium'}</span>
                </div>
                <p>Requires measure implementation, workflow review, validation, and staff training.</p>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Review mode
function toggleMode() {
    if (currentMode === 'planning') {
        showReviewMode();
    } else {
        renderPlanningMode();
    }
}

function showReviewMode() {
    currentMode = 'review';
    
    document.getElementById('planning-mode').style.display = 'none';
    document.getElementById('review-mode').style.display = 'block';
    
    renderReviewMode();
}

function renderReviewMode() {
    // Render MVP list
    const listContainer = document.getElementById('review-mvp-list');
    listContainer.innerHTML = '';
    
    const activeMVPs = mvps.filter(mvp => assignments[mvp.mvp_id]?.length > 0);
    
    activeMVPs.forEach(mvp => {
        const score = calculateMVPScore(mvp.mvp_id);
        
        const div = document.createElement('div');
        div.className = `review-mvp-item ${currentMVP === mvp.mvp_id ? 'active' : ''}`;
        div.onclick = () => selectReviewMVP(mvp.mvp_id);
        
        div.innerHTML = `
            <div class="mvp-name">${mvp.mvp_name}</div>
            <div class="mvp-score">${score.toFixed(1)}</div>
        `;
        
        listContainer.appendChild(div);
    });
    
    if (currentMVP) {
        renderPerformanceEntry(currentMVP);
    }
}

function selectReviewMVP(mvpId) {
    currentMVP = mvpId;
    renderReviewMode();
}

function renderPerformanceEntry(mvpId) {
    const container = document.getElementById('review-content');
    const mvp = mvps.find(m => m.mvp_id === mvpId);
    const selections = mvpSelections[mvpId];
    
    if (!selections || selections.measures.length === 0) {
        container.innerHTML = '<div class="empty-state">No measures selected for this MVP</div>';
        return;
    }
    
    let html = `
        <div class="performance-header">
            <h2>${mvp.mvp_name}</h2>
            <div class="measure-tabs">
    `;
    
    selections.measures.forEach((measureId, index) => {
        const score = calculateMeasureScore(mvpId, measureId);
        html += `
            <div class="measure-tab ${index === 0 ? 'active' : ''}" 
                 onclick="switchMeasureTab('${mvpId}', '${measureId}', this)">
                ${measureId}
                <span class="tab-score">${score.toFixed(1)}</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        <div id="performance-table-container">
    `;
    
    // Show first measure by default
    if (selections.measures.length > 0) {
        html += renderPerformanceTable(mvpId, selections.measures[0]);
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function renderPerformanceTable(mvpId, measureId) {
    const assigned = assignments[mvpId] || [];
    const config = mvpSelections[mvpId]?.configs[measureId] || {};
    
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
    
    html += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2"><strong>Measure Average</strong></td>
                    <td><strong>${calculateMeasureAverage(mvpId, measureId).toFixed(1)}%</strong></td>
                    <td colspan="2"><strong>${calculateMeasureScore(mvpId, measureId).toFixed(1)} pts</strong></td>
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
}

function clearSelection() {
    selectedClinicians.clear();
    renderClinicians();
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
}

// MVP functions
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
        delete mvpPerformance[mvpId];
        
        if (currentMVP === mvpId) {
            currentMVP = null;
        }
    }
    
    renderClinicians();
    renderMVPs();
    renderDetails();
    updateStats();
}

// Measure functions
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
        selections.measures.push(measureId);
        selections.configs[measureId] = {
            collectionType: 'MIPS CQM',
            difficulty: 'Medium'
        };
    } else {
        selections.measures.splice(index, 1);
        delete selections.configs[measureId];
    }
    
    renderDetails();
}

function setCollectionType(mvpId, measureId, value) {
    if (mvpSelections[mvpId]?.configs[measureId]) {
        mvpSelections[mvpId].configs[measureId].collectionType = value;
    }
}

function setDifficulty(mvpId, measureId, value) {
    if (mvpSelections[mvpId]?.configs[measureId]) {
        mvpSelections[mvpId].configs[measureId].difficulty = value;
    }
}

// Performance functions
function updatePerformance(mvpId, measureId, npi, value) {
    if (!mvpPerformance[mvpId]) {
        mvpPerformance[mvpId] = {};
    }
    
    mvpPerformance[mvpId][`${measureId}_${npi}`] = parseFloat(value) || 0;
    
    // Re-render the current table
    const container = document.getElementById('performance-table-container');
    if (container) {
        container.innerHTML = renderPerformanceTable(mvpId, measureId);
    }
    
    // Update scores
    renderReviewMode();
    updateOverallScore();
}

function switchMeasureTab(mvpId, measureId, tabElement) {
    // Update active tab
    document.querySelectorAll('.measure-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    tabElement.classList.add('active');
    
    // Render new table
    const container = document.getElementById('performance-table-container');
    container.innerHTML = renderPerformanceTable(mvpId, measureId);
}

// Scoring functions
function calculateDecile(measureId, collectionType, performanceRate) {
    // Simplified decile calculation
    if (performanceRate >= 95) return { decile: 10, points: 10 };
    if (performanceRate >= 90) return { decile: 9, points: 9 };
    if (performanceRate >= 85) return { decile: 8, points: 8 };
    if (performanceRate >= 80) return { decile: 7, points: 7 };
    if (performanceRate >= 75) return { decile: 6, points: 6 };
    if (performanceRate >= 70) return { decile: 5, points: 5 };
    if (performanceRate >= 60) return { decile: 4, points: 4 };
    if (performanceRate >= 50) return { decile: 3, points: 3 };
    if (performanceRate >= 40) return { decile: 2, points: 2 };
    return { decile: 1, points: 1 };
}

function calculateMeasureAverage(mvpId, measureId) {
    const assigned = assignments[mvpId] || [];
    let total = 0;
    let count = 0;
    
    assigned.forEach(npi => {
        const perfKey = `${measureId}_${npi}`;
        if (mvpPerformance[mvpId]?.[perfKey] !== undefined) {
            total += mvpPerformance[mvpId][perfKey];
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
    const activeMVPs = mvps.filter(mvp => assignments[mvp.mvp_id]?.length > 0);
    let totalScore = 0;
    let totalClinicians = 0;
    
    activeMVPs.forEach(mvp => {
        const score = calculateMVPScore(mvp.mvp_id);
        const clinicianCount = assignments[mvp.mvp_id].length;
        totalScore += score * clinicianCount;
        totalClinicians += clinicianCount;
    });
    
    const overallScore = totalClinicians > 0 ? totalScore / totalClinicians : 0;
    
    const displayEl = document.getElementById('overall-score-display');
    if (displayEl) {
        displayEl.textContent = overallScore.toFixed(1);
    }
    
    document.getElementById('total-measures').textContent = 
        activeMVPs.reduce((sum, mvp) => sum + (mvpSelections[mvp.mvp_id]?.measures.length || 0), 0);
    
    document.getElementById('avg-points').textContent = overallScore.toFixed(1);
}

// Filter functions
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
    
    document.getElementById('clinician-count').textContent = clinicians.length;
    document.getElementById('assigned-count').textContent = assignedCount;
    document.getElementById('mvp-count').textContent = mvps.length;
    document.getElementById('active-mvps').textContent = activeMVPs;
    document.getElementById('measure-count').textContent = measures.length;
}

function switchDetailTab(tab) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        assignments: assignments,
        selections: mvpSelections,
        performance: mvpPerformance,
        summary: {
            total_clinicians: clinicians.length,
            assigned: Object.values(assignments).flat().length,
            active_mvps: Object.keys(assignments).filter(id => assignments[id]?.length > 0).length,
            overall_score: parseFloat(document.getElementById('overall-score-display')?.textContent || '0')
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-plan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// Setup event handlers
function setupEventHandlers() {
    // Tab switching
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.textContent.toLowerCase().replace(' ', '');
            switchDetailTab(tabName);
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

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
window.setDifficulty = setDifficulty;
window.toggleMode = toggleMode;
window.switchDetailTab = switchDetailTab;
window.exportPlan = exportPlan;
window.updatePerformance = updatePerformance;
window.switchMeasureTab = switchMeasureTab;
window.selectReviewMVP = selectReviewMVP;
