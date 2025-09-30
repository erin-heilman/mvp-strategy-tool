export default async function handler(req, res) {
    const { sheet } = req.query;
    
    // Your Google Sheet configuration
    const SHEET_ID = '1vFT3DeUtUQhqyMZGiUJST8bQMzD2YmP1IkmSoeH3vFc';
    const SHEET_GIDS = {
        'clinicians': '0',
        'measures': '1960036634',
        'mvps': '2070462647',
        'benchmarks': '265964719',
        'assignments': '1228784883',
        'selections': '1089849621',
        'performance': '1937078193',
        'work': '1438710258',
        'config': '1457717726'
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
