// API Route Handler for Google Sheets Data
// Path: /api/sheets/[sheet].js

export default async function handler(req, res) {
    // Get sheet name from query parameter
    const { sheet } = req.query;
    
    // Google Sheet configuration
    const SHEET_ID = '1CHs8cP3mDQkwG-XL-B7twFVukRxcB4umn9VX9ZK2VqM';
    
    // Tab GIDs from your sheet
    const SHEET_GIDS = {
        'clinicians': '0',
        'measures': '1838421790',
        'mvps': '467952052',
        'benchmarks': '322699637',
        'assignments': '1879320597',
        'selections': '1724246569',
        'performance': '557443576',
        'work': '1972144134',
        'config': '128453598'
    };
    
    // Validate sheet parameter
    if (!sheet || !SHEET_GIDS[sheet]) {
        return res.status(400).json({ 
            error: 'Invalid or missing sheet parameter',
            validSheets: Object.keys(SHEET_GIDS)
        });
    }
    
    // Build Google Sheets CSV export URL
    const gid = SHEET_GIDS[sheet];
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    
    try {
        console.log(`Fetching sheet: ${sheet} (GID: ${gid})`);
        
        // Fetch CSV data from Google Sheets
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MVP-Tool/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Google Sheets returned status ${response.status}`);
        }
        
        const csvText = await response.text();
        
        // Check for HTML error response
        if (csvText.includes('<!DOCTYPE') || csvText.includes('<html')) {
            return res.status(403).json({ 
                error: 'Unable to access sheet. Make sure it is publicly shared.',
                sheet: sheet,
                hint: 'Set Google Sheet sharing to "Anyone with the link can view"'
            });
        }
        
        // Parse CSV to JSON
        const data = parseCSV(csvText);
        
        console.log(`Successfully fetched ${data.length} rows from ${sheet}`);
        
        // Set cache headers
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        
        return res.status(200).json(data);
        
    } catch (error) {
        console.error(`Error fetching ${sheet}:`, error.message);
        
        return res.status(500).json({ 
            error: 'Failed to fetch sheet data',
            sheet: sheet,
            details: error.message
        });
    }
}

// CSV Parser Function
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        return [];
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]).map(header => 
        header.trim().toLowerCase().replace(/\s+/g, '_')
    );
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        // Skip rows with wrong number of columns
        if (values.length !== headers.length) {
            continue;
        }
        
        // Create object from headers and values
        const row = {};
        headers.forEach((header, index) => {
            let value = values[index] || '';
            
            // Clean up value
            value = value.replace(/^["']|["']$/g, '').trim();
            
            // Store in row object
            row[header] = value;
        });
        
        data.push(row);
    }
    
    return data;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else if (char !== '\r') {
            // Add character to current field
            current += char;
        }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
}
