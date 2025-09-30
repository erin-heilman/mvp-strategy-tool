// MVP Strategic Planning Tool - Fixed Data Loading Version
console.log('MVP Tool Starting - Loading from Google Sheets...');

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
        // Load clinicians - try the /api/sheets/clinicians format
        console.log('Fetching clinicians...');
        let response = await fetch('/api/sheets/clinicians');
        
        if (!response.ok) {
            // If that doesn't work, try the query parameter format
            console.log('Trying alternate API format...');
            response = await fetch('/api/sheets?sheet=clinicians');
        }
        
        if (!response.ok) {
            throw new Error(`Failed to load clinicians: ${response.status}`);
        }
        
        const cliniciansData = await response.json();
        console.log('Raw clinicians data:', cliniciansData);
        
        // Process clinicians data with multiple field mappings
        clinicians = cliniciansData.map(row => {
            const clinician = {
                npi: row.NPI || row.npi || row.Npi || '',
                name: row.Name || row.name || row['Clinician Name'] || row.clinician_name || 'Unknown',
                specialty: row.Specialty || row.specialty || row['Primary Specialty'] || row.primary_specialty || 'Unknown',
                tin: row.TIN || row.tin || row.Tin || '',
                separate_ehr: row['Separate EHR'] || row.separate_ehr || row.Separate_EHR || 'No'
            };
            
            // Log first few for debugging
            if (clinicians.length < 3) {
                console.log('Processed clinician:', clinician);
            }
            
            return clinician;
        });
        
        console.log(`Loaded ${clinicians.length} clinicians`);
        
        // Load MVPs
        console.log('Fetching MVPs...');
        const mvpsResponse = await fetch('/api/sheets/mvps');
        
        if (mvpsResponse.ok) {
            const mvpsData = await mvpsResponse.json();
            console.log('Raw MVP data sample:', mvpsData[0]);
            
            mvps = mvpsData.map(row => ({
                mvp_id: row['MVP ID'] || row.mvp_id || row.MVP_ID || '',
                mvp_name: row['MVP Name'] || row.mvp_name || row.MVP_Name || '',
                specialties: row['Eligible Specialties'] || row.eligible_specialties || row.specialties || '',
                available_measures: row['Available Measures'] || row.available_measures || ''
            }));
            
            console.log(`Loaded ${mvps.length} MVPs`);
        } else {
            console.error('Failed to load MVPs');
            // Use fallback MVPs
            mvps = [
                { mvp_id: 'MVP001', mvp_name: 'Primary Care MVP', specialties: 'Family Medicine', available_measures: 'Q001,Q112,Q113,Q236' },
                { mvp_id: 'MVP002', mvp_name: 'Emergency Medicine MVP', specialties: 'Emergency Medicine', available_measures: 'Q065,Q116,Q317' }
            ];
        }
        
        // Load measures
        console.log('Fetching measures...');
        const measuresResponse = await fetch('/api/sheets/measures');
        
        if (measuresResponse.ok) {
            const measuresData = await measuresResponse.json();
            console.log('Raw measures data sample:', measuresData[0]);
            
            measures = measuresData.map(row => ({
                measure_id: row['Measure ID'] || row.measure_id || row.Measure_ID || '',
                measure_name: row['Measure Name'] || row.measure_name || row.Measure_Name || '',
                is_activated: row['Is Activated'] || row.is_activated || row.Is_Activated || 'N',
                collection_types: row['Collection Types'] || row.collection_types || 'MIPS CQM'
            }));
            
            console.log(`Loaded ${measures.length} measures`);
        } else {
            console.error('Failed to load measures');
            measures = [];
        }
        
        // Try to load benchmarks
        const benchmarksResponse = await fetch('/api/sheets/benchmarks');
        if (benchmarksResponse.ok) {
            benchmarks = await benchmarksResponse.json();
            console.log(`Loaded ${benchmarks.length} benchmarks`);
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        
        // Use complete fallback data if API fails
        alert('Unable to load data from Google Sheets. Please check:\n1. The sheet is shared as "Anyone with link can view"\n2. The API is deployed correctly\n\nUsing demo data for now.');
        
        clinicians = [
            { npi: '1234567890', name: 'Dr. John Smith', specialty: 'Family Practice', tin: '123456789' },
            { npi: '0987654321', name: 'Dr. Jane Doe', specialty: 'Emergency Medicine', tin: '123456789' },
            { npi: '5555555555', name: 'Dr. Bob Johnson', specialty: 'Anesthesiology', tin: '123456789' }
        ];
        
        mvps = [
            { mvp_id: 'MVP001', mvp_name: 'Primary Care MVP', specialties: 'Family Medicine', available_measures: 'Q001,Q112,Q113' },
            { mvp_id: 'MVP002', mvp_name: 'Emergency Medicine MVP', specialties: 'Emergency Medicine', available_measures: 'Q065,Q116' }
        ];
        
        measures = [
            { measure_id: 'Q001', measure_name: 'Diabetes: Hemoglobin A1c', is_activated: 'Y', collection_types: 'eCQM, MIPS CQM' },
            { measure_id: 'Q112', measure_name: 'Breast Cancer Screening', is_activated: 'Y', collection_types: 'eCQM, MIPS CQM' },
            { measure_id: 'Q113', measure_name: 'Colorectal Cancer Screening', is_activated: 'N', collection_types: 'MIPS CQM' },
            { measure_id: 'Q065', measure_name: 'Appropriate Treatment for URI', is_activated: 'Y', collection_types: 'eCQM, MIPS CQM' },
            { measure_id: 'Q116', measure_name: 'Avoidance of Antibiotic Treatment', is_activated: 'N', collection_types: 'MIPS CQM' }
        ];
    }
    
    updateStats();
}

// Setup interface with better MVP selector
function setupFilters() {
    const specialties = [...new Set(clinicians.map(c => c.specialty))].filter(s => s && s !== 'Unknown').sort();
    
    const filterContainer = document.getElementById('filter-container');
    if (!filterContainer) return;
    
    // Build MVP options with names, not IDs
    const mvpOptions = mvps.map(mvp => 
        `<option value="${mvp.mvp_id}">${mvp.mvp_name}</option>`
    ).join('');
    
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
                ${mvpOptions}
            </select>
            <button onclick="assignSelectedToMVP()" class="btn-assign">Assign Selected</button>
        </div>
    `;
}

// Continue with all the other functions from the complete version...
// [Rest of the code remains the same as the complete version]

// Setup interface
function setupInterface() {
    setupFilters();
    setupEventHandlers();
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

// Render clinicians panel with actual names
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
        
        // Make sure we show the actual name
        const displayName = clinician.name || 'Unknown Clinician';
        const displaySpecialty = clinician.specialty || 'Unknown Specialty';
        const displayNPI = clinician.npi || 'No NPI';
        
        div.innerHTML = `
            <input type="checkbox" 
                   ${selectedClinicians.has(clinician.npi) ? 'checked' : ''} 
                   onclick="event.stopPropagation(); toggleSelection('${clinician.npi}')">
            <div class="clinician-info">
                <strong>${displayName}</strong>
                <small>${displaySpecialty}</small>
                <small class="npi">NPI: ${displayNPI}</small>
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

// Render measures tab with actual measures
function renderMeasuresTab(mvp) {
    const container = document.getElementById('mvp-details');
    const selections = mvpSelections[mvp.mvp_id] || { measures: [], configs: {} };
    
    // Parse available measures from the MVP
    const availableMeasureIds = mvp.available_measures ? 
        mvp.available_measures.split(',').map(m => m.trim()) : [];
    
    if (availableMeasureIds.length === 0) {
        container.innerHTML = `
            <h3>${mvp.mvp_name}</h3>
            <p class="empty-state">No measures configured for this MVP in the spreadsheet.</p>
        `;
        return;
    }
    
    let html = `
        <h3>${mvp.mvp_name} - Measure Selection</h3>
        <p class="measure-requirement">Select exactly 4 measures. ${selections.measures.length}/4 selected.</p>
        <div class="measures-grid">
    `;
    
    availableMeasureIds.forEach(measureId => {
        // Find the measure details
        const measure = measures.find(m => m.measure_id === measureId);
        const isSelected = selections.measures.includes(measureId);
        const isActivated = measure?.is_activated === 'Y';
        
        html += `
            <div class="measure-card ${isSelected ? 'selected' : ''} ${isActivated ? 'activated' : ''}">
                <label>
                    <input type="checkbox" 
                           value="${measureId}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleMeasure('${mvp.mvp_id}', '${measureId}')">
                    <div class="measure-content">
                        <span class="measure-id">${measureId}</span>
                        <span class="measure-name">${measure ? measure.measure_name : 'Measure details not loaded'}</span>
                        ${isActivated ? '<span class="badge activated">Activated</span>' : '<span class="badge new">New</span>'}
                    </div>
                </label>
                ${isSelected ? `
                    <div class="measure-config">
                        <select onchange="setCollectionType('${mvp.mvp_id}', '${measureId}', this.value)">
                            <option value="MIPS CQM">MIPS CQM</option>
                            <option value="eCQM">eCQM</option>
                        </select>
                        <select onchange="setDifficulty('${mvp.mvp_id}', '${measureId}', this.value)">
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// All the other functions remain the same...
// [Include all remaining functions from the complete version]

// Helper functions
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

// Assignment functions
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

// Other UI functions
function switchDetailTab(tab) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

function toggleMode() {
    if (currentMode === 'planning') {
        currentMode = 'review';
        document.getElementById('planning-mode').style.display = 'none';
        document.getElementById('review-mode').style.display = 'block';
    } else {
        currentMode = 'planning';
        document.getElementById('planning-mode').style.display = 'block';
        document.getElementById('review-mode').style.display = 'none';
    }
}

function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        assignments: assignments,
        selections: mvpSelections,
        summary: {
            total_clinicians: clinicians.length,
            assigned: Object.values(assignments).flat().length
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-plan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
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

function setupEventHandlers() {
    // Tab switching is already handled inline
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
window.setDifficulty = setDifficulty;
window.toggleMode = toggleMode;
window.switchDetailTab = switchDetailTab;
window.exportPlan = exportPlan;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
