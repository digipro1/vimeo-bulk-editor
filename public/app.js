const appContainer = document.getElementById('app-container');
const folderFilter = document.getElementById('folder-filter');
const searchInput = document.getElementById('search-input');
const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
const columnTogglePanel = document.getElementById('column-toggle-panel');
const tableContainer = document.getElementById('table-container');
const videoTable = document.getElementById('video-table');
const videoTbody = document.getElementById('video-list');
const saveAllBtn = document.getElementById('save-all-btn');
const bulkEditBar = document.getElementById('bulk-edit-bar');
const selectionCounter = document.getElementById('selection-counter');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const applyBulkEditBtn = document.getElementById('apply-bulk-edit-btn');
const downloadCaptionsBtn = document.getElementById('download-captions-btn');
const descriptionModal = document.getElementById('description-modal');

let currentUser = null;
let originalVideoData = new Map();
let selectedVideoIds = new Set(); 
let currentlyEditingVideoId = null;

// The core categories
const GOVERNANCE_KEYS = [
    'Title', 'Series', 'Date', 'Minister', 'Scripture', 
    'Supporting Scripture', 'Event Type', 'Topic', 
    'Features', 'Holiday', 'Location', 'Audience'
];

// Identify which ones are arrays (comma separated)
const MULTI_VALUE_KEYS = ['Features', 'Holiday', 'Topic', 'Supporting Scripture'];

// The active filters chosen by the user
const activeFilters = {}; 
let currentFilterPanelKey = null;

// --- DATA EXTRACTION (Phase 1) ---
// Gets just the book from a scripture (e.g., "1 John 4:8" -> "1 John")
const getBookName = (scriptureStr) => {
    if (!scriptureStr) return '';
    const match = scriptureStr.match(/^(\d\s+)?[a-zA-Z\s]+/);
    return match ? match[0].trim() : scriptureStr.trim();
};

// Universal extractor: returns an Array of values for a given key, properly cleaned
const extractValues = (key, rawValue) => {
    if (!rawValue) return [];
    if (MULTI_VALUE_KEYS.includes(key)) {
        return rawValue.split(',').map(s => {
            let v = s.trim();
            if (key === 'Supporting Scripture') v = getBookName(v);
            return v;
        }).filter(Boolean);
    } else {
        let v = rawValue.trim();
        if (key === 'Scripture') v = getBookName(v);
        return [v].filter(Boolean);
    }
};

const parseVimeoDescription = (fullText) => {
    if (!fullText) return { summary: '', metadata: {} };
    const parts = fullText.split('---');
    const summary = parts[0].trim();
    const metadata = {};
    if (parts[1]) {
        parts[1].split('\n').forEach(line => {
            const [key, ...val] = line.split(':');
            if (key && val.length > 0) metadata[key.trim()] = val.join(':').trim();
        });
    }
    return { summary, metadata };
};

const assembleVimeoDescription = (summary, metadata) => {
    let newDesc = summary + '\n---\n';
    GOVERNANCE_KEYS.forEach(key => {
        if (metadata[key]) newDesc += `${key}: ${metadata[key]}\n`;
    });
    return newDesc.trim();
};

// --- FILTER EXECUTION (Phase 3) ---
const applyTableFilters = () => {
    const term = searchInput.value.toLowerCase();
    const rows = videoTbody.querySelectorAll('tr');

    rows.forEach(row => {
        const videoId = row.dataset.videoId;
        const meta = originalVideoData.get(videoId).metadata;

        // 1. Text Search Check
        let passes = row.innerText.toLowerCase().includes(term);

        // 2. Checkbox Logic (AND between categories, OR within)
        if (passes) {
            for (const key of GOVERNANCE_KEYS) {
                const sel = activeFilters[key];
                if (!sel || sel.length === 0) continue; // Condition A: No filter set

                // Condition B: Extract video values and check against selections using .some()
                const videoValues = extractValues(key, meta[key]);
                if (!videoValues.some(item => sel.includes(item))) {
                    passes = false; 
                    break; 
                }
            }
        }
        row.style.display = passes ? '' : 'none';
    });
    updateSelectAllUI();
};

// --- FILTER POPULATION (Phase 2) ---
const openFilterPanel = (key, btnElement) => {
    currentFilterPanelKey = key;
    const panel = document.getElementById('table-filter-panel');
    const optionsContainer = document.getElementById('filter-panel-options');
    
    document.getElementById('filter-panel-title').innerText = `Filter ${key}`;
    optionsContainer.innerHTML = '';

    // Loop data to build Unique Set
    const uniqueValues = new Set();
    originalVideoData.forEach(video => {
        const values = extractValues(key, video.metadata[key]);
        values.forEach(v => uniqueValues.add(v));
    });

    const sortedValues = Array.from(uniqueValues).sort();
    const selectedValues = activeFilters[key] || [];

    if (sortedValues.length === 0) {
        optionsContainer.innerHTML = '<i>No data found</i>';
    } else {
        sortedValues.forEach(val => {
            const lbl = document.createElement('label');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = val;
            chk.checked = selectedValues.includes(val);
            lbl.appendChild(chk);
            lbl.appendChild(document.createTextNode(val));
            optionsContainer.appendChild(lbl);
        });
    }

    // Position panel under the button
    const rect = btnElement.getBoundingClientRect();
    panel.style.left = `${rect.left + window.scrollX}px`;
    panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
    panel.style.display = 'flex';
};

// Panel Apply Button
document.getElementById('filter-panel-apply').addEventListener('click', () => {
    const checked = document.querySelectorAll('#filter-panel-options input:checked');
    const selected = Array.from(checked).map(c => c.value);
    const btn = document.querySelector(`.filter-btn[data-key="${currentFilterPanelKey}"]`);

    if (selected.length > 0) {
        activeFilters[currentFilterPanelKey] = selected;
        btn.classList.add('active');
    } else {
        delete activeFilters[currentFilterPanelKey];
        btn.classList.remove('active');
    }
    document.getElementById('table-filter-panel').style.display = 'none';
    applyTableFilters();
});

// Panel Clear Button
document.getElementById('filter-panel-clear').addEventListener('click', () => {
    delete activeFilters[currentFilterPanelKey];
    document.querySelector(`.filter-btn[data-key="${currentFilterPanelKey}"]`).classList.remove('active');
    document.getElementById('table-filter-panel').style.display = 'none';
    applyTableFilters();
});

// --- COLUMN VISIBILITY ---
const initColumnToggles = () => {
    const cols = ['Summary', ...GOVERNANCE_KEYS];
    columnTogglePanel.innerHTML = '';
    cols.forEach(col => {
        const lbl = document.createElement('label');
        lbl.innerHTML = `<input type="checkbox" checked data-col="${col.replace(/\s+/g, '')}"> ${col}`;
        columnTogglePanel.appendChild(lbl);
    });

    columnTogglePanel.addEventListener('change', (e) => {
        if(e.target.tagName === 'INPUT') {
            const cls = `hide-col-${e.target.dataset.col}`;
            e.target.checked ? videoTable.classList.remove(cls) : videoTable.classList.add(cls);
        }
    });

    toggleColumnsBtn.addEventListener('click', () => {
        columnTogglePanel.style.display = columnTogglePanel.style.display === 'none' ? 'flex' : 'none';
    });
};

// --- API & RENDERING ---
const fetchFolders = async (user) => {
    try {
        let allFolders = []; let nextPagePath = null;
        do {
            const res = await fetch(nextPagePath ? `/api/get-folders?page=${encodeURIComponent(nextPagePath)}` : '/api/get-folders', 
                { headers: { Authorization: `Bearer ${user.token.access_token}` } });
            const data = await res.json();
            allFolders = allFolders.concat(data.folders);
            nextPagePath = data.nextPagePath;
        } while (nextPagePath);

        folderFilter.innerHTML = '<option value="" disabled selected>Select a folder...</option>';
        allFolders.sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
            folderFilter.innerHTML += `<option value="${f.uri}">${f.name}</option>`;
        });
    } catch (e) { console.error(e); }
};

const fetchVideosByFolder = async () => {
    if (!folderFilter.value) return;
    tableContainer.style.display = 'block';
    videoTbody.innerHTML = '<tr><td colspan="16">Loading videos...</td></tr>';
    
    try {
        const res = await fetch(`/api/vimeo?folderUri=${encodeURIComponent(folderFilter.value)}`, {
            headers: { Authorization: `Bearer ${currentUser.token.access_token}` }
        });
        const { data } = await res.json();
        renderTable(data);
    } catch (error) {
        videoTbody.innerHTML = '<tr><td colspan="16" style="color:red;">Error loading videos.</td></tr>';
    }
};

const renderTable = (videos) => {
    videoTbody.innerHTML = ''; originalVideoData.clear();
    // Clear old filters
    for (let key in activeFilters) delete activeFilters[key];
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

    videos.forEach(video => {
        const videoId = video.uri.split('/').pop();
        const { summary, metadata } = parseVimeoDescription(video.description || '');
        originalVideoData.set(videoId, { summary, metadata, name: video.name });

        const row = document.createElement('tr');
        row.dataset.videoId = videoId;
        row.innerHTML = `
            <td class="col-Checkbox"><input type="checkbox" class="video-checkbox" data-video-id="${videoId}"></td>
            <td class="col-Summary summary-cell" style="cursor:pointer; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${summary || '(Edit)'}</td>
            ${GOVERNANCE_KEYS.map(k => `<td contenteditable="true" class="col-${k.replace(/\s+/g, '')} meta-${k.replace(/\s+/g, '')}">${metadata[k] || ''}</td>`).join('')}
            <td class="col-Manage"><a href="https://vimeo.com/manage/videos/${videoId}" target="_blank" class="manage-link">Manage</a></td>
            <td class="col-Action"><button class="save-btn">Save</button></td>
        `;
        videoTbody.appendChild(row);
    });
    saveAllBtn.style.display = 'inline-block';
    applyTableFilters(); // Run filter once on load to establish state
};

// --- BULK & SAVE LOGIC ---
const updateSelectAllUI = () => {
    const visible = Array.from(document.querySelectorAll('.video-checkbox')).filter(c => c.closest('tr').style.display !== 'none');
    selectAllCheckbox.checked = visible.length > 0 && visible.every(c => c.checked);
};

const handleSave = async (row) => {
    const videoId = row.dataset.videoId;
    const saveBtn = row.querySelector('.save-btn');
    saveBtn.innerText = 'Saving...';
    
    const summary = row.querySelector('.summary-cell').innerHTML;
    const metadata = {};
    GOVERNANCE_KEYS.forEach(k => {
        const cell = row.querySelector(`.meta-${k.replace(/\s+/g, '')}`);
        if (cell) metadata[k] = cell.innerText.trim();
    });

    try {
        const res = await fetch('/api/update-video', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token.access_token}` },
            body: JSON.stringify({ videoId, updates: { description: assembleVimeoDescription(summary, metadata) } }),
        });
        if (res.ok) { saveBtn.innerText = 'Saved!'; setTimeout(() => saveBtn.innerText = 'Save', 2000); }
    } catch (err) { saveBtn.innerText = 'Error'; }
};

const handleSaveAll = async () => {
    const visibleRows = Array.from(videoTbody.querySelectorAll('tr')).filter(r => r.style.display !== 'none');
    saveAllBtn.innerText = 'Saving All...'; saveAllBtn.disabled = true;
    for (const row of visibleRows) await handleSave(row);
    saveAllBtn.innerText = 'Save All Changes'; saveAllBtn.disabled = false;
};

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    searchInput.addEventListener('input', applyTableFilters);
    folderFilter.addEventListener('change', fetchVideosByFolder);
    document.getElementById('save-all-btn').addEventListener('click', handleSaveAll);

    // Setup Header Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openFilterPanel(e.target.dataset.key, e.target));
    });

    // Close panels when clicking outside
    document.addEventListener('mousedown', (e) => {
        const fp = document.getElementById('table-filter-panel');
        const cp = document.getElementById('column-toggle-panel');
        if (fp.style.display !== 'none' && !fp.contains(e.target) && !e.target.classList.contains('filter-btn')) fp.style.display = 'none';
        if (cp.style.display !== 'none' && !cp.contains(e.target) && e.target.id !== 'toggle-columns-btn') cp.style.display = 'none';
    });

    // Modals and Table Clicks
    videoTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('summary-cell')) {
            currentlyEditingVideoId = e.target.closest('tr').dataset.videoId;
            document.getElementById('description-modal').style.display = 'flex';
            tinymce.init({ selector: '#tinymce-textarea', height: 300, menubar: false, setup: ed => ed.on('init', () => ed.setContent(e.target.innerHTML)) });
        }
        if (e.target.classList.contains('save-btn')) handleSave(e.target.closest('tr'));
    });

    document.getElementById('modal-save-btn').addEventListener('click', () => {
        document.querySelector(`tr[data-video-id="${currentlyEditingVideoId}"] .summary-cell`).innerHTML = tinymce.get('tinymce-textarea').getContent();
        document.getElementById('description-modal').style.display = 'none'; tinymce.get('tinymce-textarea').remove();
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
        document.getElementById('description-modal').style.display = 'none'; if (tinymce.get('tinymce-textarea')) tinymce.get('tinymce-textarea').remove();
    });

    // Checkbox logic
    videoTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('video-checkbox')) {
            e.target.checked ? selectedVideoIds.add(e.target.dataset.videoId) : selectedVideoIds.delete(e.target.dataset.videoId);
            updateSelectAllUI();
            document.getElementById('bulk-edit-bar').style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
            document.getElementById('selection-counter').innerText = `${selectedVideoIds.size} video(s) selected`;
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.video-checkbox').forEach(c => {
            if (c.closest('tr').style.display !== 'none') {
                c.checked = e.target.checked;
                e.target.checked ? selectedVideoIds.add(c.dataset.videoId) : selectedVideoIds.delete(c.dataset.videoId);
            }
        });
        document.getElementById('bulk-edit-bar').style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
        document.getElementById('selection-counter').innerText = `${selectedVideoIds.size} video(s) selected`;
    });

    netlifyIdentity.on('login', user => { currentUser = user; appContainer.style.display = 'block'; initColumnToggles(); fetchFolders(user); });
    netlifyIdentity.on('logout', () => location.reload());
    if (netlifyIdentity.currentUser()) { currentUser = netlifyIdentity.currentUser(); appContainer.style.display = 'block'; initColumnToggles(); fetchFolders(currentUser); }
});
