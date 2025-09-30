// MVP Strategic Planning Tool - Main Application
console.log('MVP Tool Starting...');

// Configuration
const SHEET_ID = '1vFT3DeUtUQhqyMZGiUJST8bQMzD2YmP1IkmSoeH3vFc';
const API_BASE = '/api/sheets';

// Global state
let clinicians = [];
let mvps = [];
let measures = [];
let assignments = {};

// Initialize the application
async function init() {
    console.log('Initializing application...');
    const statusEl = document.getElementById('connection-status');
    
    try {
        statusEl.textContent = 'Loading clinicians...';
        statusEl.className = 'status-loading';
        
        // Load all data
        await loadData();
        
        statusEl.textContent = `Connected! Loaded ${clinicians.length} clinicians and ${mvps.length} MVPs`;
        statusEl.className = 'status-success';
        
        // Show main app
        document.getElementById('main-app').style.display = 'block';
        
        // Render the interface
        renderClinicians();
        renderMVPs();
        
        // Enable drag and drop
        enableDragDrop();
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusEl.textContent = `Error: ${error.message}. Please refresh the page.`;
        statusEl.className = 'status-error';
    }
}

// Load data from API
async function loadData() {
    console.log('Loading data from API...');
    
    // Load clinicians
    const cliniciansResponse = await fetch(`${API_BASE}/clinicians`);
    if (!cliniciansResponse.ok) throw new Error('Failed to load clinicians');
    clinicians = await cliniciansResponse.json();
    console.log(`Loaded ${clinicians.length} clinicians`);
    
    // Load MVPs
    const mvpsResponse = await fetch(`${API_BASE}/mvps`);
    if (!mvpsResponse.ok) throw new Error('Failed to load MVPs');
    mvps = await mvpsResponse.json();
    console.log(`Loaded ${mvps.length} MVPs`);
    
    // Load measures
    const measuresResponse = await fetch(`${API_BASE}/measures`);
    if (!measuresResponse.ok) throw new Error('Failed to load measures');
    measures = await measuresResponse.json();
    console.log(`Loaded ${measures.length} measures`);
    
    // Update stats
    document.getElementById('clinician-count').textContent = clinicians.length;
    document.getElementById('mvp-count').textContent = mvps.length;
    document.getElementById('measure-count').textContent = measures.length;
}

// Render clinicians list
function renderClinicians() {
    const container = document.getElementById('clinician-list');
    container.innerHTML = '';
    
    // Filter out already assigned clinicians
    const unassigned = clinicians.filter(c => !isClinicianAssigned(c.npi));
    
    unassigned.forEach(clinician => {
        const div = document.createElement('div');
        div.className = 'clinician-item';
        div.draggable = true;
        div.dataset.npi = clinician.npi;
        div.innerHTML = `
            <strong>${clinician.name || 'Unknown'}</strong><br>
            <small>${clinician.specialty || 'No specialty'}</small><br>
            <small>NPI: ${clinician.npi}</small>
        `;
        container.appendChild(div);
    });
}

// Render MVP cards
function renderMVPs() {
    const container = document.getElementById('mvp-grid');
    container.innerHTML = '';
    
    mvps.forEach(mvp => {
        const div = document.createElement('div');
        div.className = 'mvp-card';
        div.dataset.mvpId = mvp.mvp_id;
        
        // Get clinicians assigned to this MVP
        const assignedClinicians = assignments[mvp.mvp_id] || [];
        
        // Get measures for this MVP
        const mvpMeasures = getMeasuresForMVP(mvp.mvp_id);
        
        div.innerHTML = `
            <h3>${mvp.mvp_name}</h3>
            <div>
                <small>Clinicians: ${assignedClinicians.length}</small><br>
                <small>Measures: ${mvpMeasures.length}</small>
            </div>
            <div class="mvp-clinicians" data-mvp="${mvp.mvp_id}">
                ${assignedClinicians.map(npi => {
                    const c = clinicians.find(cl => cl.npi === npi);
                    return c ? `<div class="clinician-item" draggable="true" data-npi="${npi}">${c.name}</div>` : '';
                }).join('')}
            </div>
        `;
        container.appendChild(div);
    });
}

// Get measures for an MVP (simplified)
function getMeasuresForMVP(mvpId) {
    // This would normally filter based on MVP-measure relationships
    // For now, return a subset of measures
    return measures.slice(0, 5);
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

// Enable drag and drop
function enableDragDrop() {
    let draggedElement = null;
    
    // Make clinicians draggable
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('clinician-item')) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        }
    });
    
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('clinician-item')) {
            e.target.style.opacity = '';
        }
    });
    
    // Make MVP areas droppable
    document.addEventListener('dragover', (e) => {
        if (e.target.classList.contains('mvp-clinicians')) {
            e.preventDefault();
            e.target.style.background = '#e7f3ff';
        }
    });
    
    document.addEventListener('dragleave', (e) => {
        if (e.target.classList.contains('mvp-clinicians')) {
            e.target.style.background = '';
        }
    });
    
    document.addEventListener('drop', (e) => {
        if (e.target.classList.contains('mvp-clinicians') && draggedElement) {
            e.preventDefault();
            e.target.style.background = '';
            
            const mvpId = e.target.dataset.mvp;
            const npi = draggedElement.dataset.npi;
            
            // Add to assignments
            if (!assignments[mvpId]) {
                assignments[mvpId] = [];
            }
            assignments[mvpId].push(npi);
            
            // Re-render
            renderClinicians();
            renderMVPs();
        }
    });
}

// Start the application when page loads
document.addEventListener('DOMContentLoaded', init);
