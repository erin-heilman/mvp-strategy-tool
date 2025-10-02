// MVP Strategic Planning Tool - PROFESSIONAL VERSION WITH ALL FIXES
console.log('MVP Tool Starting - Professional Version with Corrected Functionality...');

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
let currentMode = 'tin-analysis';
let savedScenarios = {};
let currentScenarioName = 'Default';

// New state for enhanced features
let selectedSpecialties = new Set();
let measureEstimates = {};
let measureConfigurations = {};
let yearlyPlan = {
    2025: { mvps: [], measures: [], focus: 'Foundation - High readiness measures' },
    2026: { mvps: [], measures: [], focus: 'Expansion - Add specialty MVPs' },
    2027: { mvps: [], measures: [], focus: 'Integration - Cross-specialty coordination' },
    2028: { mvps: [], measures: [], focus: 'Optimization - Performance improvement' },
    2029: { mvps: [], measures: [], focus: 'Excellence - Full MVP implementation' }
};
let currentYear = 2025;
let globalTINNumber = '123456789'; // Default TIN, will be updated from sheet

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
    console.log('Initializing Professional MVP tool...');
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
        
        loadSavedScenarios();
        setupInterface();
        switchToMode('tin-analysis');
        
    } catch (error) {
        console.error('Initialization error:', error);
        statusEl.textContent = `Error: ${error.message}. Please refresh the page.`;
        statusEl.className = 'status-error';
    }
}

// Load data from API with proper benchmark loading
async function loadData() {
    console.log('Loading data from API...');
    
    try {
        // Load clinicians
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
            
            // Get TIN from first clinician if available
            if (row.tin || row.TIN) {
                globalTINNumber = row.tin || row.TIN;
            }
            
            return {
                npi: row.npi || row.NPI || '',
                name: name,
                specialty: row.specialty || row.Specialty || 'Unknown',
                tin: row.tin || row.TIN || '',
                separate_ehr: row.separate_ehr || row['Separate EHR'] || 'No'
            };
        });
        
        // Update TIN display
        updateTINNumber(globalTINNumber);
        
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
                difficulty: row.difficulty || row['Difficulty'] || 'Medium',
                is_inverse: row.is_inverse || row['Is Inverse'] || 'N',
                setup_time: row.setup_time || row['Setup Time'] || '3 months',
                readiness: parseInt(row.readiness || row['Readiness'] || '3'),
                prerequisites: row.prerequisites || row['Prerequisites'] || '',
                median_benchmark: parseFloat(row.median_benchmark || row['Median Benchmark'] || '75')
            }));
            
            console.log(`Loaded ${measures.length} measures`);
        }
        
        // LOAD BENCHMARKS - CRITICAL FOR SCORING!
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
                // The median is typically at decile_5 (50th percentile)
                median_performance: parseFloat(row.decile_5 || row['Decile 5'] || row.median_performance || row['Median Performance'] || 50),
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
            
            // Log sample benchmark to verify median is loading correctly
            if (benchmarks.length > 0) {
                const q416Benchmark = benchmarks.find(b => b.measure_id === 'Q416');
                if (q416Benchmark) {
                    console.log('Q416 Benchmark median:', q416Benchmark.median_performance, 'Decile 5:', q416Benchmark.decile_5);
                }
            }
            
            // Update measures with median benchmark from benchmarks if available
            measures.forEach(measure => {
                const benchmark = benchmarks.find(b => b.measure_id === measure.measure_id);
                if (benchmark) {
                    // Use decile_5 as the median (50th percentile)
                    measure.median_benchmark = benchmark.decile_5 || benchmark.median_performance || 75;
                    console.log(`${measure.measure_id}: Setting median to ${measure.median_benchmark}`);
                }
            });
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
            { mvp_id: 'MVP002', mvp_name: 'Emergency Medicine MVP', specialties: 'Emergency Medicine', available_measures: 'Q065,Q116,Q254,Q255' }
        ];
        
        measures = [
            { measure_id: 'Q001', measure_name: 'Diabetes Control', is_activated: 'Y', collection_types: 'eCQM,MIPS CQM', difficulty: 'Easy', is_inverse: 'Y', setup_time: '2 months', readiness: 4, prerequisites: 'EHR integration', median_benchmark: 72 }
        ];
        
        benchmarks = [];
    }
    
    updateStats();
}

// TIN Analysis Functions
function renderTINAnalysis() {
    console.log('Rendering TIN Analysis...');
    
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
    
    // Auto-select specialties with MVP recommendations
    sortedSpecialties.forEach(([specialty, count]) => {
        const recommendedMVP = mvpRecommendations[specialty];
        const mvp = mvps.find(m => m.mvp_name === recommendedMVP);
        
        // Auto-select if has recommendation
        if (recommendedMVP && mvp) {
            selectedSpecialties.add(specialty);
        }
        
        const card = document.createElement('div');
        card.className = 'specialty-card';
        if (selectedSpecialties.has(specialty)) {
            card.classList.add('selected');
        }
        card.dataset.specialty = specialty;
        
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
                <div style="color: #586069; font-style: italic; margin-top: 10px;">
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

function updateTINNumber(value) {
    globalTINNumber = value;
    document.getElementById('tin-number').textContent = value;
    document.getElementById('tin-number-input').value = value;
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

// Performance Estimation with CORRECT decile calculation
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
            <div style="color: #586069; margin-bottom: 15px;">
                ${assignments[mvp.mvp_id].length} clinicians assigned
            </div>
        `;
        
        const selections = mvpSelections[mvp.mvp_id];
        if (selections && selections.measures.length > 0) {
            selections.measures.forEach(measureId => {
                const measure = measures.find(m => m.measure_id === measureId);
                if (!measure) return;
                
                // Get the actual median benchmark
                const config = selections.configs[measureId] || {};
                const collectionType = config.collectionType || 'MIPS CQM';
                const benchmark = benchmarks.find(b => 
                    b.measure_id === measureId && 
                    b.collection_type === collectionType
                );
                
                // Use decile_5 (50th percentile) as the median
                const medianBenchmark = benchmark?.decile_5 || benchmark?.median_performance || measure.median_benchmark || 75;
                
                const isInverse = benchmark?.is_inverse === 'Y' || benchmark?.is_inverse === 'Yes' || 
                                 measure.is_inverse === 'Y' || measure.is_inverse === 'Yes';
                
                html += `
                    <div class="measure-estimation">
                        <div class="measure-name">
                            ${measureId}: ${measure.measure_name}
                            ${isInverse ? '<span style="color: #dc3545; font-size: 11px;"> (Inverse)</span>' : ''}
                        </div>
                        <input type="number" 
                               class="estimation-input" 
                               min="0" max="100" step="0.01"
                               value="${measureEstimates[`${mvp.mvp_id}_${measureId}`] || ''}"
                               placeholder="Est %"
                               onchange="updateMeasureEstimate('${mvp.mvp_id}', '${measureId}', this.value)">
                        <div class="benchmark-value">Median: ${medianBenchmark.toFixed(2)}%</div>
                        <div id="score-${mvp.mvp_id}-${measureId}" class="score-value">--</div>
                    </div>
                `;
            });
        }
        
        html += `
            <div class="score-summary" id="mvp-score-${mvp.mvp_id}">
                <div style="font-size: 14px; color: #586069;">Total Points</div>
                <div class="composite-score">--</div>
            </div>
        `;
        
        card.innerHTML = html;
        container.appendChild(card);
        
        // Auto-calculate scores on load if there are estimates
        updateMVPTotalScore(mvp.mvp_id);
    });
}

function updateMeasureEstimate(mvpId, measureId, value) {
    const key = `${mvpId}_${measureId}`;
    measureEstimates[key] = parseFloat(value) || 0;
    
    // Calculate score using proper decile calculation
    const selections = mvpSelections[mvpId];
    const config = selections?.configs[measureId] || {};
    const decileInfo = calculateDecile(measureId, config.collectionType || 'MIPS CQM', parseFloat(value) || 0);
    
    const scoreEl = document.getElementById(`score-${mvpId}-${measureId}`);
    if (scoreEl) {
        scoreEl.textContent = `${decileInfo.points.toFixed(1)} pts`;
    }
    
    // Update MVP total score (sum, not average)
    updateMVPTotalScore(mvpId);
}

// CORRECT calculateDecile function from original
function calculateDecile(measureId, collectionType, performanceRate) {
    // Find the specific benchmark for this measure and collection type
    const benchmark = benchmarks.find(b => 
        b.measure_id === measureId && 
        b.collection_type === collectionType
    );
    
    if (!benchmark) {
        console.log(`No benchmark found for ${measureId} - ${collectionType}, using defaults`);
        // Fallback to simple calculation if no benchmark found
        if (performanceRate >= 95) return { decile: 10, points: 10.0 };
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
    
    // Check if this is an inverse measure
    const measure = measures.find(m => m.measure_id === measureId);
    const isInverse = benchmark.is_inverse === 'Y' || benchmark.is_inverse === 'Yes' || 
                     benchmark.is_inverse === true || benchmark.is_inverse === 'TRUE' ||
                     measure?.is_inverse === 'Y' || measure?.is_inverse === 'Yes';
    
    let decile = 1;
    let points = 1.0;
    
    if (isInverse) {
        // INVERSE MEASURE: Lower is better
        if (performanceRate <= benchmark.decile_10) {
            decile = 10;
            points = 10.0;
        } else if (performanceRate <= benchmark.decile_9) {
            decile = 9;
            points = 9.0;
        } else if (performanceRate <= benchmark.decile_8) {
            decile = 8;
            points = 8.0;
        } else if (performanceRate <= benchmark.decile_7) {
            decile = 7;
            points = 7.0;
        } else if (performanceRate <= benchmark.decile_6) {
            decile = 6;
            points = 6.0;
        } else if (performanceRate <= benchmark.decile_5) {
            decile = 5;
            points = 5.0;
        } else if (performanceRate <= benchmark.decile_4) {
            decile = 4;
            points = 4.0;
        } else if (performanceRate <= benchmark.decile_3) {
            decile = 3;
            points = 3.0;
        } else if (performanceRate <= benchmark.decile_2) {
            decile = 2;
            points = 2.0;
        } else {
            decile = 1;
            points = 1.0;
        }
    } else {
        // NORMAL MEASURE: Higher is better
        if (performanceRate >= benchmark.decile_10) {
            decile = 10;
            points = 10.0;
        } else if (performanceRate >= benchmark.decile_9) {
            decile = 9;
            points = 9.0;
        } else if (performanceRate >= benchmark.decile_8) {
            decile = 8;
            points = 8.0;
        } else if (performanceRate >= benchmark.decile_7) {
            decile = 7;
            points = 7.0;
        } else if (performanceRate >= benchmark.decile_6) {
            decile = 6;
            points = 6.0;
        } else if (performanceRate >= benchmark.decile_5) {
            decile = 5;
            points = 5.0;
        } else if (performanceRate >= benchmark.decile_4) {
            decile = 4;
            points = 4.0;
        } else if (performanceRate >= benchmark.decile_3) {
            decile = 3;
            points = 3.0;
        } else if (performanceRate >= benchmark.decile_2) {
            decile = 2;
            points = 2.0;
        } else {
            decile = 1;
            points = 1.0;
        }
    }
    
    // Add fractional points within decile (optional, from original)
    if (decile < 10 && decile > 0) {
        try {
            const currentThreshold = benchmark[`decile_${decile}`];
            const nextThreshold = benchmark[`decile_${Math.min(decile + 1, 10)}`];
            
            if (currentThreshold !== undefined && nextThreshold !== undefined) {
                let progress;
                
                if (isInverse) {
                    if (decile === 1) {
                        progress = 0;
                    } else {
                        const worseThreshold = decile === 1 ? 100 : benchmark[`decile_${decile - 1}`] || 100;
                        progress = (worseThreshold - performanceRate) / (worseThreshold - currentThreshold);
                    }
                } else {
                    if (decile === 1) {
                        progress = performanceRate / currentThreshold;
                    } else {
                        const lowerThreshold = benchmark[`decile_${decile - 1}`] || 0;
                        progress = (performanceRate - lowerThreshold) / (currentThreshold - lowerThreshold);
                    }
                }
                
                if (progress > 0 && progress <= 1) {
                    points = (decile - 1) + Math.min(progress, 1) * 0.9 + 0.1;
                }
            }
        } catch (e) {
            console.log('Error calculating fractional points:', e);
        }
    }
    
    return { 
        decile: decile, 
        points: parseFloat(points.toFixed(1))
    };
}

function updateMVPTotalScore(mvpId) {
    const selections = mvpSelections[mvpId];
    if (!selections || selections.measures.length === 0) return;
    
    let totalPoints = 0;
    let count = 0;
    
    selections.measures.forEach(measureId => {
        const estimate = measureEstimates[`${mvpId}_${measureId}`];
        if (estimate !== undefined && estimate !== null) {
            const config = selections.configs[measureId] || {};
            const decileInfo = calculateDecile(measureId, config.collectionType || 'MIPS CQM', estimate);
            totalPoints += decileInfo.points;
            count++;
        }
    });
    
    // Display TOTAL points, not average
    const scoreEl = document.getElementById(`mvp-score-${mvpId}`);
    if (scoreEl) {
        scoreEl.innerHTML = `
            <div style="font-size: 14px; color: #586069;">Total Points (${count} measures)</div>
            <div class="composite-score">${totalPoints.toFixed(1)}</div>
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
        updateMVPTotalScore(mvp.mvp_id);
    });
    
    alert('Scores calculated! Review the total points for each MVP.');
}

// Executive Dashboard with readiness-based planning
function renderExecutiveDashboard() {
    // Create yearly plan based on measure readiness and setup time
    const mvpData = [];
    
    // Analyze each MVP's implementation complexity
    Object.keys(assignments).forEach(mvpId => {
        if (!assignments[mvpId] || assignments[mvpId].length === 0) return;
        
        let totalSetupMonths = 0;
        let avgReadiness = 0;
        let newMeasureCount = 0;
        let activatedMeasureCount = 0;
        let measureDetails = [];
        
        if (mvpSelections[mvpId] && mvpSelections[mvpId].measures.length > 0) {
            mvpSelections[mvpId].measures.forEach(measureId => {
                const measure = measures.find(m => m.measure_id === measureId);
                const config = measureConfigurations[`${mvpId}_${measureId}`] || {};
                
                const readiness = config.readiness || measure?.readiness || 3;
                const isActivated = measure?.is_activated === 'Y';
                
                // Parse setup time
                let setupMonths = 0;
                if (!isActivated) {
                    const setupTime = config.setupTime || measure?.setup_time || '3 months';
                    if (setupTime.includes('month')) {
                        setupMonths = parseInt(setupTime) || 3;
                    } else if (setupTime.includes('year')) {
                        setupMonths = parseInt(setupTime) * 12 || 12;
                    } else if (setupTime === '0' || setupTime === '0 months') {
                        setupMonths = 0;
                    } else {
                        setupMonths = 3; // default
                    }
                }
                
                measureDetails.push({
                    measureId: measureId,
                    readiness: readiness,
                    setupMonths: setupMonths,
                    isActivated: isActivated
                });
                
                if (isActivated) {
                    activatedMeasureCount++;
                } else {
                    newMeasureCount++;
                    totalSetupMonths += setupMonths;
                }
                
                avgReadiness += readiness;
            });
            
            avgReadiness = avgReadiness / mvpSelections[mvpId].measures.length;
        }
        
        mvpData.push({
            mvpId: mvpId,
            totalSetupMonths: totalSetupMonths,
            avgReadiness: avgReadiness,
            newMeasureCount: newMeasureCount,
            activatedMeasureCount: activatedMeasureCount,
            measureDetails: measureDetails,
            // Priority score: Lower setup time and higher readiness = higher priority
            priorityScore: (avgReadiness * 10) - (totalSetupMonths * 2)
        });
    });
    
    // Sort MVPs by priority (highest priority first)
    // MVPs with all measures already activated (0 setup time) go first
    // Then by readiness and setup time
    mvpData.sort((a, b) => {
        // MVPs with 0 setup time (all measures activated) go first
        if (a.totalSetupMonths === 0 && b.totalSetupMonths > 0) return -1;
        if (b.totalSetupMonths === 0 && a.totalSetupMonths > 0) return 1;
        
        // Then by priority score
        return b.priorityScore - a.priorityScore;
    });
    
    // Initialize yearly tracking
    const yearMVPs = {
        2025: { all: new Set(), new: new Set() },
        2026: { all: new Set(), new: new Set() },
        2027: { all: new Set(), new: new Set() },
        2028: { all: new Set(), new: new Set() },
        2029: { all: new Set(), new: new Set() }
    };
    
    const yearMeasures = {
        2025: { new: [], improve: [] },
        2026: { new: [], improve: [] },
        2027: { new: [], improve: [] },
        2028: { new: [], improve: [] },
        2029: { new: [], improve: [] }
    };
    
    // Implementation capacity per year (in months)
    const yearCapacity = {
        2025: 12,
        2026: 12,
        2027: 12,
        2028: 12,
        2029: 12
    };
    
    const years = [2025, 2026, 2027, 2028, 2029];
    let currentYearIdx = 0;
    let remainingCapacity = yearCapacity[2025];
    
    // Track when each MVP is introduced
    const mvpIntroductionYear = {};
    
    // Phase 1: Add MVPs with all measures already activated (0 implementation time)
    mvpData.forEach(mvp => {
        if (mvp.totalSetupMonths === 0 && mvp.newMeasureCount === 0) {
            // This MVP requires no new implementation - add it to 2025
            mvpIntroductionYear[mvp.mvpId] = 2025;
            yearMVPs[2025].new.add(mvp.mvpId);
            
            // Add all its measures as "improve" measures
            mvp.measureDetails.forEach(m => {
                yearMeasures[2025].improve.push({
                    mvpId: mvp.mvpId,
                    measureId: m.measureId,
                    isActivated: true
                });
            });
        }
    });
    
    // Phase 2: Schedule MVPs with new measures based on capacity
    mvpData.forEach(mvp => {
        if (mvp.totalSetupMonths > 0 && !mvpIntroductionYear[mvp.mvpId]) {
            // Find the year with enough capacity
            while (currentYearIdx < years.length - 1 && remainingCapacity < mvp.totalSetupMonths) {
                currentYearIdx++;
                remainingCapacity = yearCapacity[years[currentYearIdx]];
            }
            
            const year = years[currentYearIdx];
            
            // Track MVP introduction
            mvpIntroductionYear[mvp.mvpId] = year;
            yearMVPs[year].new.add(mvp.mvpId);
            
            // Add measures
            mvp.measureDetails.forEach(m => {
                if (m.isActivated) {
                    // Already activated - add as improvement measure
                    yearMeasures[year].improve.push({
                        mvpId: mvp.mvpId,
                        measureId: m.measureId,
                        isActivated: true
                    });
                } else {
                    // New measure to implement
                    yearMeasures[year].new.push({
                        mvpId: mvp.mvpId,
                        measureId: m.measureId,
                        setupMonths: m.setupMonths,
                        readiness: m.readiness,
                        isActivated: false
                    });
                }
            });
            
            // Reduce capacity
            remainingCapacity -= mvp.totalSetupMonths;
        }
    });
    
    // Build cumulative MVP lists and propagate improvement measures
    let cumulativeMVPs = new Set();
    years.forEach(year => {
        // Add new MVPs for this year
        yearMVPs[year].new.forEach(mvpId => {
            cumulativeMVPs.add(mvpId);
        });
        // All cumulative MVPs are active
        yearMVPs[year].all = new Set(cumulativeMVPs);
        
        // For continuing MVPs, add their measures to improvement list
        cumulativeMVPs.forEach(mvpId => {
            if (!yearMVPs[year].new.has(mvpId)) {
                // This is a continuing MVP
                const mvp = mvpData.find(m => m.mvpId === mvpId);
                if (mvp) {
                    mvp.measureDetails.forEach(m => {
                        // Check if this measure is already in new or improve lists
                        const isInNew = yearMeasures[year].new.some(nm => 
                            nm.mvpId === mvpId && nm.measureId === m.measureId
                        );
                        const isInImprove = yearMeasures[year].improve.some(im => 
                            im.mvpId === mvpId && im.measureId === m.measureId
                        );
                        
                        if (!isInNew && !isInImprove) {
                            yearMeasures[year].improve.push({
                                mvpId: mvpId,
                                measureId: m.measureId,
                                isActivated: true
                            });
                        }
                    });
                }
            }
        });
    });
    
    // Update yearlyPlan
    Object.keys(yearlyPlan).forEach(year => {
        yearlyPlan[year].mvps = Array.from(yearMVPs[year].all);
        yearlyPlan[year].newMvps = Array.from(yearMVPs[year].new);
        yearlyPlan[year].newMeasures = [...new Set(yearMeasures[year].new.map(item => item.measureId))];
        yearlyPlan[year].improveMeasures = [...new Set(yearMeasures[year].improve.map(item => item.measureId))];
        
        // Update focus based on what's happening that year
        if (year == 2025 && yearMeasures[year].new.length === 0 && yearMeasures[year].improve.length > 0) {
            yearlyPlan[year].focus = 'Foundation - Optimize existing activated measures';
        } else if (year == 2029 && yearMeasures[year].new.length === 0) {
            yearlyPlan[year].focus = 'Excellence - Optimization and continuous improvement';
        }
    });
    
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
            <p style="color: #586069; margin-bottom: 20px;">
                <strong>Focus:</strong> ${plan.focus}
            </p>
            
            <div class="implementation-grid">
                <div class="implementation-card">
                    <h4>All Active MVPs (${plan.mvps.length})</h4>
                    <ul style="list-style: none; padding: 0;">
                        ${plan.mvps.map(mvpId => {
                            const mvp = mvps.find(m => m.mvp_id === mvpId);
                            const isNew = plan.newMvps && plan.newMvps.includes(mvpId);
                            return mvp ? `
                                <li style="padding: 5px 0; ${isNew ? 'font-weight: 600;' : ''}">
                                    ${mvp.mvp_name}
                                    ${isNew ? '<span style="color: #28a745; font-size: 12px; margin-left: 8px;">NEW</span>' : ''}
                                </li>` : '';
                        }).join('')}
                    </ul>
                </div>
                
                <div class="implementation-card">
                    <h4>New Measures to Implement (${plan.newMeasures ? plan.newMeasures.length : 0})</h4>
                    ${plan.newMeasures && plan.newMeasures.length > 0 ? `
                        <ul style="list-style: none; padding: 0;">
                            ${plan.newMeasures.slice(0, 3).map(measureId => {
                                const measure = measures.find(m => m.measure_id === measureId);
                                // Find the measure configuration for this measure
                                const mvpMeasureKey = Object.keys(measureConfigurations).find(k => k.includes(measureId));
                                const config = mvpMeasureKey ? measureConfigurations[mvpMeasureKey] : {};
                                // Use config readiness, then measure readiness, then default to 3
                                const readiness = config.readiness || measure?.readiness || 3;
                                return measure ? `
                                    <li style="padding: 5px 0;">
                                        ${measureId}: ${measure.measure_name}
                                        <span style="font-size: 12px; color: #586069;">(Readiness: ${readiness}/5)</span>
                                    </li>` : '';
                            }).join('')}
                            ${plan.newMeasures.length > 3 ? `
                                <li style="padding: 5px 0; font-style: italic; color: #004877; cursor: pointer;" 
                                    onclick="showMeasureDetails('${year}', 'new')">
                                    ... and ${plan.newMeasures.length - 3} more (click to view all)
                                </li>` : ''}
                        </ul>
                        </ul>
                    ` : '<p style="color: #586069; font-size: 14px;">No new measures this year</p>'}
                </div>
                
                <div class="implementation-card">
                    <h4>Measures to Improve (${plan.improveMeasures ? plan.improveMeasures.length : 0})</h4>
                    ${plan.improveMeasures && plan.improveMeasures.length > 0 ? `
                        <ul style="list-style: none; padding: 0;">
                            ${plan.improveMeasures.slice(0, 3).map(measureId => {
                                const measure = measures.find(m => m.measure_id === measureId);
                                return measure ? `
                                    <li style="padding: 5px 0; color: #586069;">
                                        ${measureId}: ${measure.measure_name}
                                    </li>` : '';
                            }).join('')}
                            ${plan.improveMeasures.length > 3 ? `
                                <li style="padding: 5px 0; font-style: italic; color: #004877; cursor: pointer;"
                                    onclick="showMeasureDetails('${year}', 'improve')">
                                    ... and ${plan.improveMeasures.length - 3} more (click to view all)
                                </li>` : ''}
                        </ul>
                    ` : '<p style="color: #586069; font-size: 14px;">No existing measures to improve</p>'}
                        </ul>
                    ` : '<p style="color: #586069; font-size: 14px;">No existing measures to improve</p>'}
                </div>
            </div>
            
            <div class="implementation-grid" style="margin-top: 20px;">
                <div class="implementation-card" style="grid-column: span 3;">
                    <h4>Key Milestones for ${year}</h4>
                    <ul style="list-style: none; padding: 0;">
                        ${plan.newMeasures && plan.newMeasures.length > 0 ? `
                            <li style="padding: 5px 0;">Q1: Implement all new measures (${plan.newMeasures.length} total)</li>
                            <li style="padding: 5px 0;">Q2: Performance improvement on existing measures</li>
                        ` : plan.improveMeasures && plan.improveMeasures.length > 0 ? `
                            <li style="padding: 5px 0;">Q1-Q2: Continuous performance improvement on existing measures</li>
                        ` : ''}
                        <li style="padding: 5px 0;">Q3: Review updates to available measures and MVPs for ${year + 1}</li>
                        <li style="padding: 5px 0;">Q4: Review new clinicians, update groupings, and incorporate new data elements</li>
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

// Enhanced measure configuration with collection type selector
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
        const availableTypes = measure.collection_types ? 
            measure.collection_types.split(',').map(t => t.trim()) : ['MIPS CQM'];
        
        // Get actual median benchmark
        const benchmark = benchmarks.find(b => 
            b.measure_id === measureId && 
            b.collection_type === (config.collectionType || availableTypes[0])
        );
        // Decile 5 is the median (50th percentile)
        const medianBenchmark = benchmark?.decile_5 || measure.median_benchmark || 75;
        
        const isInverse = benchmark?.is_inverse === 'Y' || measure.is_inverse === 'Y';
        
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
                                ${measure.difficulty || 'Medium'}
                            </span>
                        </div>
                        ${isActivated ? '<span class="badge activated">Already Activated</span>' : '<span class="badge new">New Measure</span>'}
                        ${isInverse ? '<span class="badge inverse">Inverse Measure</span>' : ''}
                        <div style="margin-top: 8px; font-size: 12px; color: #586069;">
                            Median Benchmark: ${medianBenchmark.toFixed(2)}%
                        </div>
                    </div>
                </label>
                ${isSelected ? `
                    <div class="measure-config">
                        ${availableTypes.length > 1 ? `
                            <div class="config-item">
                                <label class="config-label">Collection Type</label>
                                <select class="config-select" onchange="setCollectionType('${mvp.mvp_id}', '${measureId}', this.value)">
                                    ${availableTypes.map(type => 
                                        `<option value="${type}" ${selections.configs[measureId]?.collectionType === type ? 'selected' : ''}>${type}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        ` : ''}
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

// Keep all other functions from original (setupInterface, renderPlanningMode, etc.)
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
            <span style="font-weight: 500; margin-right: 10px;">Scenario:</span>
            <select id="scenario-selector" onchange="loadScenario(this.value)">
                <option value="Default">Default Scenario</option>
                ${Object.keys(savedScenarios).map(name => 
                    name !== 'Default' ? `<option value="${name}">${name}</option>` : ''
                ).join('')}
                <option value="new">+ Create New Scenario</option>
            </select>
            <button onclick="saveScenario()" class="btn-save" title="Save current scenario">Save</button>
            <button onclick="saveAsNewScenario()" class="btn-save-as" title="Save as new scenario">Save As...</button>
            <button onclick="deleteScenario()" class="btn-reset" title="Delete current scenario">Delete</button>
        </div>
    `;
    
    // Set the current scenario in the dropdown
    const selector = document.getElementById('scenario-selector');
    if (selector && currentScenarioName) {
        selector.value = currentScenarioName;
    }
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

// Helper functions
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
        
        // Clear measure configurations for this MVP
        Object.keys(measureConfigurations).forEach(key => {
            if (key.startsWith(mvpId)) {
                delete measureConfigurations[key];
            }
        });
        
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
        delete measureConfigurations[`${mvpId}_${measureId}`];
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
    console.log(`Set ${measureId} to ${value} for MVP ${mvpId}`);
    
    // Re-render to update benchmark display
    renderDetails();
}

// Scenario Management
function saveScenario() {
    // Don't allow saving over Default scenario
    if (currentScenarioName === 'Default') {
        const name = prompt('Default scenario cannot be modified. Enter a name for a new scenario:', 'Scenario ' + (Object.keys(savedScenarios).length + 1));
        if (!name || name.trim() === '') return;
        
        currentScenarioName = name.trim();
        
        // Update dropdown to show new scenario
        updateScenarioDropdown();
        document.getElementById('scenario-selector').value = currentScenarioName;
    }
    
    // Save to current scenario name
    const scenarioData = {
        name: currentScenarioName,
        timestamp: new Date().toISOString(),
        assignments: assignments,
        selections: mvpSelections,
        performance: mvpPerformance,
        measureEstimates: measureEstimates,
        measureConfigurations: measureConfigurations,
        yearlyPlan: yearlyPlan,
        tinNumber: globalTINNumber
    };
    
    savedScenarios[currentScenarioName] = scenarioData;
    localStorage.setItem('mvp_scenarios', JSON.stringify(savedScenarios));
    
    alert(`Scenario "${currentScenarioName}" saved successfully!`);
    
    // Refresh the scenario dropdown to show new scenarios
    updateScenarioDropdown();
}

function saveAsNewScenario() {
    const name = prompt('Enter a name for this scenario:', 'Scenario ' + (Object.keys(savedScenarios).length + 1));
    if (!name || name.trim() === '') return;
    
    currentScenarioName = name.trim();
    saveScenario();
    
    // Update the dropdown to show and select the new scenario
    updateScenarioDropdown();
    document.getElementById('scenario-selector').value = currentScenarioName;
}

function loadScenario(name) {
    if (!name || name === '') return;
    
    if (name === 'new') {
        // Create a new blank scenario
        createNewScenario();
        return;
    }
    
    // Default scenario is always blank
    if (name === 'Default') {
        currentScenarioName = 'Default';
        assignments = {};
        mvpSelections = {};
        mvpPerformance = {};
        measureEstimates = {};
        measureConfigurations = {};
        selectedClinicians.clear();
        selectedSpecialties.clear();
        currentMVP = null;
        yearlyPlan = {
            2025: { mvps: [], measures: [], focus: 'Foundation - High readiness measures' },
            2026: { mvps: [], measures: [], focus: 'Expansion - Add specialty MVPs' },
            2027: { mvps: [], measures: [], focus: 'Integration - Cross-specialty coordination' },
            2028: { mvps: [], measures: [], focus: 'Optimization - Performance improvement' },
            2029: { mvps: [], measures: [], focus: 'Excellence - Full MVP implementation' }
        };
    } else if (savedScenarios[name]) {
        const scenario = savedScenarios[name];
        currentScenarioName = name;
        assignments = scenario.assignments || {};
        mvpSelections = scenario.selections || {};
        mvpPerformance = scenario.performance || {};
        measureEstimates = scenario.measureEstimates || {};
        measureConfigurations = scenario.measureConfigurations || {};
        yearlyPlan = scenario.yearlyPlan || {
            2025: { mvps: [], measures: [], focus: 'Foundation - High readiness measures' },
            2026: { mvps: [], measures: [], focus: 'Expansion - Add specialty MVPs' },
            2027: { mvps: [], measures: [], focus: 'Integration - Cross-specialty coordination' },
            2028: { mvps: [], measures: [], focus: 'Optimization - Performance improvement' },
            2029: { mvps: [], measures: [], focus: 'Excellence - Full MVP implementation' }
        };
        
        if (scenario.tinNumber) {
            updateTINNumber(scenario.tinNumber);
        }
    } else {
        alert('Scenario not found');
        return;
    }
    
    // Refresh the current view
    if (currentMode === 'tin-analysis') {
        renderTINAnalysis();
    } else if (currentMode === 'planning') {
        renderPlanningMode();
    } else if (currentMode === 'performance') {
        renderPerformanceEstimation();
    } else if (currentMode === 'executive') {
        renderExecutiveDashboard();
    }
    
    updateStats();
}

function createNewScenario() {
    const name = prompt('Enter a name for the new scenario:', 'Scenario ' + (Object.keys(savedScenarios).length + 1));
    if (!name || name.trim() === '') return;
    
    // Reset all data for new scenario
    currentScenarioName = name.trim();
    assignments = {};
    mvpSelections = {};
    mvpPerformance = {};
    measureEstimates = {};
    measureConfigurations = {};
    selectedClinicians.clear();
    selectedSpecialties.clear();
    currentMVP = null;
    yearlyPlan = {
        2025: { mvps: [], measures: [], focus: 'Foundation - High readiness measures' },
        2026: { mvps: [], measures: [], focus: 'Expansion - Add specialty MVPs' },
        2027: { mvps: [], measures: [], focus: 'Integration - Cross-specialty coordination' },
        2028: { mvps: [], measures: [], focus: 'Optimization - Performance improvement' },
        2029: { mvps: [], measures: [], focus: 'Excellence - Full MVP implementation' }
    };
    
    // Save the new blank scenario
    saveScenario();
    
    // Update the dropdown and select the new scenario
    updateScenarioDropdown();
    document.getElementById('scenario-selector').value = currentScenarioName;
    
    // Refresh the view
    if (currentMode === 'tin-analysis') {
        renderTINAnalysis();
    } else if (currentMode === 'planning') {
        renderPlanningMode();
    }
    
    updateStats();
}

function deleteScenario() {
    if (currentScenarioName === 'Default') {
        alert('Cannot delete the Default scenario');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the scenario "${currentScenarioName}"?`)) {
        return;
    }
    
    delete savedScenarios[currentScenarioName];
    localStorage.setItem('mvp_scenarios', JSON.stringify(savedScenarios));
    
    // Switch to Default scenario
    loadScenario('Default');
    updateScenarioDropdown();
    document.getElementById('scenario-selector').value = 'Default';
}

function updateScenarioDropdown() {
    const selector = document.getElementById('scenario-selector');
    if (!selector) return;
    
    const currentValue = selector.value;
    
    selector.innerHTML = `
        <option value="Default">Default Scenario</option>
        ${Object.keys(savedScenarios).map(name => 
            name !== 'Default' ? `<option value="${name}">${name}</option>` : ''
        ).join('')}
        <option value="new">+ Create New Scenario</option>
    `;
    
    // Restore the selected value if it still exists
    if (currentValue && Array.from(selector.options).some(opt => opt.value === currentValue)) {
        selector.value = currentValue;
    } else {
        selector.value = currentScenarioName;
    }
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
            // Remove any saved Default scenario to ensure it's always blank
            if (savedScenarios['Default']) {
                delete savedScenarios['Default'];
                localStorage.setItem('mvp_scenarios', JSON.stringify(savedScenarios));
            }
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

// Export function for Executive Dashboard only
function exportPlan() {
    const exportData = {
        timestamp: new Date().toISOString(),
        scenario: currentScenarioName,
        tin_number: globalTINNumber,
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
    let csvContent = "Year,MVP,Status,Clinicians,New Measures,Improvement Measures,Total Measures,Average Readiness,Total Setup Time,Focus\n";
    
    Object.entries(yearlyPlan).forEach(([year, plan]) => {
        plan.mvps.forEach(mvpId => {
            const mvp = mvps.find(m => m.mvp_id === mvpId);
            const isNew = plan.newMvps && plan.newMvps.includes(mvpId);
            const clinicianCount = assignments[mvpId]?.length || 0;
            
            // Count new vs improvement measures for this MVP
            let newMeasureCount = 0;
            let improveMeasureCount = 0;
            
            if (mvpSelections[mvpId]) {
                mvpSelections[mvpId].measures.forEach(measureId => {
                    const measure = measures.find(m => m.measure_id === measureId);
                    if (plan.newMeasures && plan.newMeasures.includes(measureId)) {
                        newMeasureCount++;
                    } else if (plan.improveMeasures && plan.improveMeasures.includes(measureId)) {
                        improveMeasureCount++;
                    }
                });
            }
            
            const totalMeasureCount = newMeasureCount + improveMeasureCount;
            
            // Calculate average readiness
            let totalReadiness = 0;
            let totalSetupMonths = 0;
            
            if (mvpSelections[mvpId]) {
                mvpSelections[mvpId].measures.forEach(measureId => {
                    const config = measureConfigurations[`${mvpId}_${measureId}`] || {};
                    const measure = measures.find(m => m.measure_id === measureId);
                    
                    totalReadiness += config.readiness || measure?.readiness || 3;
                    
                    // Only count setup time for new measures
                    if (plan.newMeasures && plan.newMeasures.includes(measureId)) {
                        const setupTime = config.setupTime || measure?.setup_time || '3 months';
                        if (setupTime.includes('month')) {
                            totalSetupMonths += parseInt(setupTime) || 3;
                        }
                    }
                });
            }
            
            const avgReadiness = totalMeasureCount > 0 ? (totalReadiness / totalMeasureCount).toFixed(1) : 0;
            
            csvContent += `${year},"${mvp?.mvp_name || mvpId}",${isNew ? 'NEW' : 'CONTINUING'},${clinicianCount},${newMeasureCount},${improveMeasureCount},${totalMeasureCount},${avgReadiness},${totalSetupMonths} months,"${plan.focus}"\n`;
        });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mvp-strategic-plan-${currentScenarioName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function setupEventHandlers() {
    // Any additional event handlers
}

// Export functions for global access
window.switchToMode = switchToMode;
window.toggleSpecialtySelection = toggleSpecialtySelection;
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
window.deleteScenario = deleteScenario;
window.createNewScenario = createNewScenario;
window.updateScenarioDropdown = updateScenarioDropdown;
window.updateTINNumber = updateTINNumber;

// Modal functions
window.showMeasureDetails = function(year, type) {
    const modal = document.getElementById('measureModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    const plan = yearlyPlan[year];
    const measures = type === 'new' ? plan.newMeasures : plan.improveMeasures;
    
    modalTitle.textContent = `Year ${year} - ${type === 'new' ? 'New Measures to Implement' : 'Measures to Improve'}`;
    
    let html = '<div class="measure-list">';
    
    measures.forEach(measureId => {
        const measure = measures.find(m => m.measure_id === measureId);
        if (!measure) return;
        
        // Find MVP and configuration for this measure
        let mvpName = '';
        let readiness = 3;
        let collectionType = 'MIPS CQM';
        
        Object.keys(mvpSelections).forEach(mvpId => {
            if (mvpSelections[mvpId].measures.includes(measureId)) {
                const mvp = mvps.find(m => m.mvp_id === mvpId);
                if (mvp) mvpName = mvp.mvp_name;
                
                const config = measureConfigurations[`${mvpId}_${measureId}`] || {};
                readiness = config.readiness || measure.readiness || 3;
                collectionType = mvpSelections[mvpId].configs[measureId]?.collectionType || 'MIPS CQM';
            }
        });
        
        const benchmark = benchmarks.find(b => 
            b.measure_id === measureId && 
            b.collection_type === collectionType
        );
        const medianBenchmark = benchmark?.decile_5 || measure.median_benchmark || 75;
        const isInverse = benchmark?.is_inverse === 'Y' || measure.is_inverse === 'Y';
        
        html += `
            <div class="measure-list-item">
                <strong>${measureId}: ${measure.measure_name}</strong>
                <div class="measure-meta-info">
                    <span>MVP: ${mvpName}</span>
                    <span>Readiness: ${readiness}/5</span>
                    <span>Collection: ${collectionType}</span>
                    <span>Median: ${medianBenchmark.toFixed(2)}%</span>
                    ${isInverse ? '<span style="color: #dc3545;">Inverse Measure</span>' : ''}
                    ${type === 'new' ? `<span>Status: New Implementation</span>` : '<span>Status: Improvement Phase</span>'}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    modalBody.innerHTML = html;
    modal.style.display = 'block';
};

window.closeMeasureModal = function() {
    const modal = document.getElementById('measureModal');
    modal.style.display = 'none';
};

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('measureModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
