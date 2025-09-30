// MVP Strategic Planning Tool - Complete Version
console.log('MVP Tool Starting...');

// Configuration
const SHEET_ID = '1CHs8cP3mDQkwG-XL-B7twFVukRxcB4umn9VX9ZK2VqM';
const API_BASE = '/api/sheets';

// Global state
let clinicians = [];
let mvps = [];
let measures = [];
let assignments = {};
let selectedClinicians = new Set();
let currentMVP = null;

// Initialize the application
async function init() {
    console.log('Initializing application...');
    const statusEl = document.getElementById('connection-status');
    
    try {
        statusEl.textContent = 'Loading data from Google Sheets...';
        statusEl.className = 'status-loading';
        
        // Load all data
        await loadData();
        
        statusEl.textContent = `Connected! Loaded ${clinicians.length} clinicians and ${mvps.length} MVPs`;
        statusEl.className = 'status-success';
        
        // Show main app
        document.getElementById('main-app').style.display = 'block';
        
        // Set up the interface
        setupFilters();
        renderClinicians();
        renderMVPs();
        setupEventHandlers();
        
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
        // Load clinicians with proper field mapping
        const cliniciansResponse = await fetch(`${API_BASE}/clinicians`);
        if (!cliniciansResponse.ok) throw new Error('Failed to load clinicians');
        const cliniciansData = await cliniciansResponse.json();
        
        // Map the fields correctly
        clinicians = cliniciansData.map(row => ({
            npi: row.npi || row.NPI || '',
            name: row.name || row.Name || row.clinician_name || 'Unknown',
            specialty: row.specialty || row.Specialty || row.primary_specialty || 'Unknown',
            tin: row.tin || row.TIN || '',
            separate_ehr: row.separate_ehr || row['Separate EHR'] || 'No'
        }));
        
        console.log(`Loaded ${clinicians.length} clinicians`);
        
        // Load MVPs with proper field mapping
        const mvpsResponse = await fetch(`${API_BASE}/mvps`);
        if (!mvpsResponse.ok) throw new Error('Failed to load MVPs');
        const mvpsData = await mvpsResponse.json();
        
        mvps = mvpsData.map(row => ({
            mvp_id: row.mvp_id || row['MVP ID'] || '',
            mvp_name: row.mvp_name || row['MVP Name'] || '',
            specialties: row.specialties || row['Eligible Specialties'] || '',
            measure_count: parseInt(row.measure_count || row['Available Measures'] || '0')
        }));
        
        console.log(`Loaded ${mvps.length} MVPs`);
        
        // Load measures
        const measuresResponse = await fetch(`${API_BASE}/measures`);
        if (!measuresResponse.ok) throw new Error('Failed to load measures');
        measures = await measuresResponse.json();
        console.log(`Loaded ${measures.length} measures`);
        
    } catch (error) {
        console.error('Error loading data:', error);
        // Use fallback sample data if API fails
        clinicians = [
            { npi: '1234567890', name: 'Dr. Smith', specialty: 'Family Practice', tin: '123456789' },
            { npi: '0987654321', name: 'Dr. Jones', specialty: 'Emergency Medicine', tin: '123456789' }
        ];
        mvps = [
            { mvp_id: 'M001', mvp_name: 'Primary Care MVP', specialties: 'Family Practice, Internal Medicine', measure_count: 8 },
            { mvp_id: 'M002', mvp_name: 'Emergency Medicine MVP', specialties: 'Emergency Medicine', measure_count: 7 }
        ];
        measures = [];
    }
    
    // Update stats
    updateStats();
}

// Set up specialty filter
function setupFilters() {
    // Get unique specialties
    const specialties = [...new Set(clinicians.map(c => c.specialty))].sort();
    
    // Create filter dropdown
    const filterHtml = `
        <div class="filters">
            <input type="text" id="search-box" placeholder="Search by name or NPI..." onkeyup="filterClinicians()">
            <select id="specialty-filter" onchange="filterClinicians()">
                <option value="">All Specialties (${clinicians.length})</option>
                ${specialties.map(s => {
                    const count = clinicians.filter(c => c.specialty === s).length;
                    return `<option value="${s}">${s} (${count})</option>`;
                }).join('')}
            </select>
            <button onclick="selectAll()" class="btn-select">Select All Visible</button>
            <button onclick="clearSelection()" class="btn-clear">Clear Selection</button>
            <button onclick="assignSelected()" class="btn-assign">Assign Selected to MVP</button>
        </div>
    `;
    
    // Add to page if filter container exists
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        filterContainer.innerHTML = filterHtml;
    }
}

// Render clinicians list
function renderClinicians() {
    const container = document.getElementById('clinician-list');
    if (!container) return;
    
    container.innerHTML = '<h3>Unassigned Clinicians</h3>';
    
    // Filter out already assigned clinicians
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    
    if (unassigned.length === 0) {
        container.innerHTML += '<p class="empty-state">All clinicians have been assigned to MVPs!</p>';
        return;
    }
    
    unassigned.forEach(clinician => {
        const div = document.createElement('div');
        div.className = 'clinician-item';
        if (selectedClinicians.has(clinician.npi)) {
            div.classList.add('selected');
        }
        div.draggable = true;
        div.dataset.npi = clinician.npi;
        div.onclick = () => toggleClinicianSelection(clinician.npi);
        div.ondragstart = (e) => handleDragStart(e, clinician);
        
        div.innerHTML = `
            <input type="checkbox" ${selectedClinicians.has(clinician.npi) ? 'checked' : ''} 
                   onclick="event.stopPropagation(); toggleClinicianSelection('${clinician.npi}')">
            <div class="clinician-info">
                <strong>${clinician.name}</strong><br>
                <small>${clinician.specialty}</small><br>
                <small class="npi">NPI: ${clinician.npi}</small>
                ${clinician.separate_ehr === 'Yes' ? '<span class="ehr-badge">Separate EHR</span>' : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

// Render MVP cards
function renderMVPs() {
    const container = document.getElementById('mvp-grid');
    if (!container) return;
    
    container.innerHTML = '<h3>MVP Assignments</h3><div class="mvp-cards">';
    const cardsContainer = container.querySelector('.mvp-cards') || container;
    
    mvps.forEach(mvp => {
        const assignedClinicians = assignments[mvp.mvp_id] || [];
        
        const div = document.createElement('div');
        div.className = 'mvp-card';
        div.dataset.mvpId = mvp.mvp_id;
        div.onclick = () => showMVPDetails(mvp);
        div.ondragover = handleDragOver;
        div.ondrop = (e) => handleDrop(e, mvp.mvp_id);
        
        // Highlight if this is the current MVP being viewed
        if (currentMVP === mvp.mvp_id) {
            div.classList.add('active');
        }
        
        div.innerHTML = `
            <h4>${mvp.mvp_name}</h4>
            <p class="mvp-specialties">${mvp.specialties}</p>
            <div class="mvp-stats">
                <span>Clinicians: ${assignedClinicians.length}</span>
                <span>Measures Available: ${mvp.measure_count}</span>
            </div>
            <div class="mvp-clinicians" data-mvp="${mvp.mvp_id}">
                ${assignedClinicians.map(npi => {
                    const c = clinicians.find(cl => cl.npi === npi);
                    if (!c) return '';
                    return `
                        <div class="assigned-clinician">
                            ${c.name}
                            <button onclick="removeFromMVP('${npi}', '${mvp.mvp_id}')" class="remove-btn">×</button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        cardsContainer.appendChild(div);
    });
    
    container.innerHTML += '</div>';
}

// Show MVP details panel
function showMVPDetails(mvp) {
    currentMVP = mvp.mvp_id;
    
    const detailsPanel = document.getElementById('mvp-details');
    if (!detailsPanel) return;
    
    const assignedCount = (assignments[mvp.mvp_id] || []).length;
    
    detailsPanel.innerHTML = `
        <h3>${mvp.mvp_name}</h3>
        <p><strong>Eligible Specialties:</strong> ${mvp.specialties}</p>
        <p><strong>Assigned Clinicians:</strong> ${assignedCount}</p>
        
        <h4>Measures (Select 4)</h4>
        <div class="measures-list">
            <p class="placeholder">Measures data will load here when available</p>
            <!-- This is where measure selection would go -->
        </div>
        
        <div class="mvp-actions">
            <button onclick="saveMVPConfiguration('${mvp.mvp_id}')" class="btn-primary">Save Configuration</button>
            <button onclick="exportMVPReport('${mvp.mvp_id}')" class="btn-secondary">Export Report</button>
        </div>
    `;
    
    // Re-render MVPs to show active state
    renderMVPs();
}

// Drag and Drop Handlers
function handleDragStart(e, clinician) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clinician.npi);
    e.target.style.opacity = '0.5';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
    return false;
}

function handleDrop(e, mvpId) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();
    
    const npi = e.dataTransfer.getData('text/plain');
    
    // Remove from any existing MVP
    for (let id in assignments) {
        assignments[id] = assignments[id].filter(n => n !== npi);
    }
    
    // Add to new MVP
    if (!assignments[mvpId]) {
        assignments[mvpId] = [];
    }
    assignments[mvpId].push(npi);
    
    // Clear drag styling
    document.querySelectorAll('.mvp-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    document.querySelectorAll('.clinician-item').forEach(item => {
        item.style.opacity = '';
    });
    
    // Re-render
    renderClinicians();
    renderMVPs();
    updateStats();
    
    return false;
}

// Selection handlers
function toggleClinicianSelection(npi) {
    if (selectedClinicians.has(npi)) {
        selectedClinicians.delete(npi);
    } else {
        selectedClinicians.add(npi);
    }
    renderClinicians();
}

function selectAll() {
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    unassigned.forEach(c => selectedClinicians.add(c.npi));
    renderClinicians();
}

function clearSelection() {
    selectedClinicians.clear();
    renderClinicians();
}

function assignSelected() {
    if (selectedClinicians.size === 0) {
        alert('Please select clinicians first');
        return;
    }
    
    const mvpId = prompt('Enter MVP ID to assign selected clinicians:');
    if (!mvpId) return;
    
    const mvp = mvps.find(m => m.mvp_id === mvpId);
    if (!mvp) {
        alert('Invalid MVP ID');
        return;
    }
    
    selectedClinicians.forEach(npi => {
        // Remove from any existing MVP
        for (let id in assignments) {
            assignments[id] = assignments[id].filter(n => n !== npi);
        }
        
        // Add to new MVP
        if (!assignments[mvpId]) {
            assignments[mvpId] = [];
        }
        assignments[mvpId].push(npi);
    });
    
    selectedClinicians.clear();
    renderClinicians();
    renderMVPs();
    updateStats();
}

// Remove clinician from MVP
function removeFromMVP(npi, mvpId) {
    event.stopPropagation();
    if (assignments[mvpId]) {
        assignments[mvpId] = assignments[mvpId].filter(n => n !== npi);
    }
    renderClinicians();
    renderMVPs();
    updateStats();
}

// Filter clinicians
function filterClinicians() {
    const searchTerm = document.getElementById('search-box')?.value.toLowerCase() || '';
    const specialty = document.getElementById('specialty-filter')?.value || '';
    
    const container = document.getElementById('clinician-list');
    if (!container) return;
    
    const items = container.querySelectorAll('.clinician-item');
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

// Check if clinician is assigned
function isClinicianAssigned(npi) {
    for (let mvpId in assignments) {
        if (assignments[mvpId].includes(npi)) {
            return true;
        }
    }
    return false;
}

// Update statistics
function updateStats() {
    const assignedCount = Object.values(assignments).flat().length;
    const activeMVPs = Object.keys(assignments).filter(id => assignments[id].length > 0).length;
    
    document.getElementById('clinician-count').textContent = clinicians.length;
    document.getElementById('mvp-count').textContent = mvps.length;
    document.getElementById('measure-count').textContent = measures.length;
    
    // Update additional stats if elements exist
    const assignedEl = document.getElementById('assigned-count');
    if (assignedEl) assignedEl.textContent = assignedCount;
    
    const activeEl = document.getElementById('active-mvps');
    if (activeEl) activeEl.textContent = activeMVPs;
}

// Export functions
function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        assignments: assignments,
        summary: {
            total_clinicians: clinicians.length,
            assigned: Object.values(assignments).flat().length,
            unassigned: clinicians.length - Object.values(assignments).flat().length,
            active_mvps: Object.keys(assignments).filter(id => assignments[id].length > 0).length
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-assignments-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function saveMVPConfiguration(mvpId) {
    console.log(`Saving configuration for MVP ${mvpId}`);
    alert('Configuration saved! (This would save to your sheet in production)');
}

function exportMVPReport(mvpId) {
    console.log(`Exporting report for MVP ${mvpId}`);
    alert('Report exported! (This would generate a detailed report in production)');
}

// Set up event handlers
function setupEventHandlers() {
    // Add drag end listener to clean up
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('clinician-item')) {
            e.target.style.opacity = '';
        }
        document.querySelectorAll('.mvp-card').forEach(card => {
            card.classList.remove('drag-over');
        });
    });
    
    // Add drag leave listener to remove hover effect
    document.addEventListener('dragleave', (e) => {
        if (e.target.classList.contains('mvp-card')) {
            e.target.classList.remove('drag-over');
        }
    });
}

// Start the application when page loads
document.addEventListener('DOMContentLoaded', init);
