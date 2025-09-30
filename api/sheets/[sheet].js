export default async function handler(req, res) {
    const { sheet } = req.query;
    
    // Your Google Sheet configuration
    const SHEET_ID = '1CHs8cP3mDQkwG-XL-B7twFVukRxcB4umn9VX9ZK2VqM';
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
    
    if (!SHEET_GIDS[sheet]) {
        return res.status(400).json({ error: 'Invalid sheet name' });
    }
    
    const gid = SHEET_GIDS[sheet];
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    
    try {
        // This runs on Vercel's server, not in the browser - NO CORS!
        const response = await fetch(url);
        const csvText = await response.text();
        
        // Parse CSV
        const lines = csvText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.replace(/["\r]/g, '').trim());
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header.toLowerCase().replace(/\s+/g, '_')] = values[index];
                });
                data.push(obj);
            }
        }
        
        res.setHeader('Cache-Control', 's-maxage=60');
        return res.status(200).json(data);
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else if (char !== '\r') {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}
