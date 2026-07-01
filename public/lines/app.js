const API = '/api';

async function api(method, path, body) {
    const res = await fetch(API + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
}

let currentUser = null;
let adminClicks = 0;

// KM MAP — no hardcoded defaults; data loaded from Supabase on startup
let kmData = {};

async function loadKmData() {
    try {
        const cfg = await api('GET', '/config/km_data');
        if (cfg && cfg.config_value) {
            const uploaded = JSON.parse(cfg.config_value);
            const normalized = {};
            for (const key in uploaded) {
                const k = key.replace('→', '|').replace(/\s*\|\s*/g, '|').replace(/\s+/g, ' ');
                let v = uploaded[key];
                if (!Array.isArray(v)) v = [v];
                normalized[k] = v;
            }
            kmData = normalized;
        } else {
            kmData = {};
        }
    } catch (e) {
        kmData = {};
    }
    const el = document.getElementById('kmRouteCount');
    if (el) el.textContent = Object.keys(kmData).length;
}

function downloadKmCsv() {
    const rows = Object.entries(kmData).map(([route, km]) => route + ',' + km);
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'km_data.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

async function uploadKmCsv() {
    const fi = document.getElementById('kmCsvFile');
    const file = fi?.files?.[0];
    if (!file) return alert('Select a CSV file!');
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const map = {};
    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 2) continue;
        let route = parts[0].trim().toUpperCase();
        if (route.startsWith('"') && route.endsWith('"')) route = route.slice(1, -1);
        route = route.replace('→', '|').replace(/\s*\|\s*/g, '|').replace(/\s+/g, ' ');
        const kms = [];
        for (let c = 1; c < parts.length; c++) {
            const v = parseFloat(parts[c].trim());
            if (!isNaN(v)) kms.push(v);
        }
        if (route && kms.length > 0) map[route] = kms;
    }
    if (Object.keys(map).length === 0) return alert('No valid data found in CSV!');
    await api('PUT', '/config/km_data', { config_value: JSON.stringify(map), updated_at: new Date().toISOString() });
    await loadKmData();
    alert('Uploaded ' + Object.keys(map).length + ' routes!');
    fi.value = '';
}

async function resetKmData() {
    if (!confirm('Clear all KM data?')) return;
    await api('PUT', '/config/km_data', { config_value: '{}', updated_at: new Date().toISOString() });
    await loadKmData();
    alert('KM data cleared. Upload a CSV to add routes.');
}
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        page.classList.add('cinematic-enter');
        setTimeout(() => page.classList.remove('cinematic-enter'), 800);
    }

}

function timeToMins(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || timeStr.indexOf(':') === -1) return -1;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

function mathTolerant(t1, t2) {
    return Math.abs(t1 - t2) <= 1;
}

async function getDutyData(type, dutyNo) {
    try {
        let data;
        try {
            data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(type));
        } catch (e) {
            console.error('API error:', e);
            return { error: 'Database error: ' + e.message };
        }
        
        if (!data || data.length === 0) {
            return { error: 'No database found for ' + type };
        }
        
        // Fetch WEF and remarks from app_config
        let wef = '', remarks = '';
        try {
            const configData = await api('GET', '/config');
            if (configData) {
                configData.forEach(c => {
                    if (c.config_key === type + '_wef') wef = c.config_value;
                    if (c.config_key === type + '_remarks') remarks = c.config_value;
                });
            }
        } catch (e) {}
        
        const searchDuty = dutyNo.toString().trim().toLowerCase().replace('.0', '');
        let found = false;
        const roster = [];
        
        for (let j = 0; j < data.length; j++) {
            const rawCell = data[j]["Duty_No"];
            const cellValue = (rawCell || '').toString().trim().toLowerCase().replace('.0', '');
            
            if (cellValue === searchDuty && cellValue !== '') {
                found = true;
                roster.push(data[j]);
            } else if (found && (rawCell === '' || rawCell === undefined || rawCell === null)) {
                if (data[j]["Train_No"] || data[j]["LocationPick"]) roster.push(data[j]);
                else if (data[j]["Duty_No"] === '' && Object.values(data[j]).filter(v => v).length < 3) break;
            } else if (found && cellValue !== '' && cellValue !== searchDuty) {
                break;
            }
        }
        
        if (!found || roster.length === 0) {
            return { error: 'Duty ' + dutyNo + ' not found.' };
        }
        
        for (let i = 0; i < roster.length; i++) {
            const r = roster[i];
            r.km_options = [];
            if (r["Train_No"] && r["Train_No"].toString().trim() !== '') {
                const from = (r["LocationPick"] || '').toString().trim().toUpperCase();
                const to = (r["LocationRelieve"] || '').toString().trim().toUpperCase();
                const key = (from + '|' + to).replace(/\s+/g, ' ');
                r.km_options = kmData[key] || [];
            }
        }
        
        const rakeGaps = analyzeRakeRelievers(data);
        
        return { roster: roster, totalKm: null, rakeGaps: rakeGaps, wef: wef, remarks: remarks };
    } catch (e) { return { error: e.toString() }; }
}

function analyzeRakeRelievers(tripData) {
    try {
        const rakeTrips = {};
        for (let i = 0; i < tripData.length; i++) {
            const rake = (tripData[i]["Train_No"] || '').toString().trim();
            if (!rake) continue;
            if (!rakeTrips[rake]) rakeTrips[rake] = [];
            rakeTrips[rake].push({
                duty: tripData[i]["Duty_No"],
                depTime: tripData[i]["Trip_Start"],
                arrTime: tripData[i]["Trip_End"],
                arrLoc: (tripData[i]["LocationRelieve"] || '').toString().trim().toUpperCase(),
                depLoc: (tripData[i]["LocationPick"] || '').toString().trim().toUpperCase(),
                rake: rake
            });
        }
        const gaps = {};
        for (const rake in rakeTrips) {
            let trips = rakeTrips[rake];
            trips.sort((a, b) => timeToMins(a.depTime) - timeToMins(b.depTime));
            const deduped = [];
            const tripSeen = {};
            for (let k = 0; k < trips.length; k++) {
                const key = trips[k].depTime + '|' + trips[k].arrTime + '|' + trips[k].depLoc + '|' + trips[k].arrLoc;
                if (!tripSeen[key]) {
                    tripSeen[key] = true;
                    deduped.push(trips[k]);
                }
            }
            trips = deduped;
            if (trips.length > 0) {
                if (!mathTolerant(timeToMins(trips[0].depTime), timeToMins(trips[0].arrTime))) {
                    gaps[rake + '|' + trips[0].depTime] = true;
                }
            }
            for (let j = 0; j < trips.length - 1; j++) {
                const currentEnd = timeToMins(trips[j].arrTime);
                const nextStart = timeToMins(trips[j+1].depTime);
                const sameDuty = trips[j].duty === trips[j+1].duty;
                const mkprException = (trips[j].arrLoc === 'MKPR' && trips[j+1].depLoc === 'MKPR' && sameDuty);
                if (!mathTolerant(currentEnd, nextStart)) {
                    if (!mkprException) {
                        gaps[rake + '|' + trips[j].arrTime] = true;
                        gaps[rake + '|' + trips[j+1].depTime] = true;
                    }
                }
            }
            if (trips.length > 0) {
                const lastTrip = trips[trips.length - 1];
                if (!mathTolerant(timeToMins(lastTrip.depTime), timeToMins(lastTrip.arrTime))) {
                    gaps[rake + '|' + lastTrip.arrTime] = true;
                }
            }
        }
        return gaps;
    } catch (e) {
        console.log('Reliever Analysis Error: ' + e);
        return {};
    }
}

function displayResult(data, dutyNo, dayType) {
    const container = document.getElementById('resultContent');
    const firstRow = data.roster[0] || {};
    
    let h = `<div class="result-card cinematic-enter">
                <div style="text-align:center; padding-bottom:20px; border-bottom:1px solid rgba(0,212,255,0.2); margin-bottom:20px;">
                    <div style="font-family:'Syncopate'; font-size:clamp(32px,8vw,56px); font-weight:700; background:linear-gradient(90deg,var(--cyan),var(--orange)); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">DUTY ${dutyNo}</div>
                    <div style="font-size:14px; letter-spacing:4px; color:rgba(255,255,255,0.7); text-transform:uppercase; margin-top:8px;">${dayType} Roster</div>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(168,85,247,0.1)); border:1px solid rgba(0,212,255,0.2); border-radius:12px; padding:15px;">
                    <div style="text-align:center;"><div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">WEF</div><div style="font-family:'Syncopate';font-size:13px;color:var(--cyan);">${data.wef || 'N/A'}</div></div>
                    <div style="text-align:center;"><div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Remarks</div><div style="font-family:'Syncopate';font-size:13px;color:var(--orange);">${data.remarks || 'None'}</div></div>
                    <div style="text-align:center;"><div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Type</div><div style="font-family:'Syncopate';font-size:13px;color:var(--purple);">${dayType}</div></div>
                </div>
             </div>`;
    
    h += `<div class="result-card cinematic-enter" style="animation-delay:0.1s;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;padding:10px 15px;background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(168,85,247,0.15));border-radius:10px;border-left:4px solid var(--cyan);">
                <span style="font-size:18px;">🚇</span><span style="font-family:'Syncopate';font-size:13px;text-transform:uppercase;letter-spacing:2px;">Sign On / Off</span>
            </div>
            <div class="table-wrap">
            <table class="data-table">
                <tr><th>Action</th><th>Location</th><th>Time</th></tr>
                <tr style="background:rgba(34,197,94,0.15);"><td style="color:var(--green);font-weight:700;">SIGN ON</td><td>${firstRow["SignOn_Location"] || '-'}</td><td><span class="time-display">${displayTime(firstRow["Sign_On"]) || '-'}</span></td></tr>
                <tr style="background:rgba(255,107,53,0.15);"><td style="color:var(--orange);font-weight:700;">SIGN OFF</td><td>${firstRow["SignOff_Location"] || '-'}</td><td><span class="time-display">${displayTime(firstRow["Sign_Off"]) || '-'}</span></td></tr>
            </table>
            </div>
           </div>`;
    
    h += `<div class="result-card cinematic-enter" style="animation-delay:0.2s;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;padding:10px 15px;background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(168,85,247,0.15));border-radius:10px;border-left:4px solid var(--cyan);">
                <span style="font-size:18px;">🚄</span><span style="font-family:'Syncopate';font-size:13px;text-transform:uppercase;letter-spacing:2px;">Trip Details</span>
            </div>
            <div class="table-wrap">
            <table class="data-table">
                <tr><th>Reliever</th><th>Rake</th><th>From</th><th>Dep</th><th>To</th><th>Arr</th><th>KM</th><th>Reliever</th></tr>`;
    
    let kmIdx = 0;
    data.roster.forEach(r => {
        if (r["Train_No"] && r["Train_No"].toString().trim() !== '') {
            let rakeId = r["Train_No"].toString().trim();
            let depTime = (r["Trip_Start"] || "").toString().trim();
            let arrTime = (r["Trip_End"] || "").toString().trim();
            
            let gapBefore = "";
            let gapAfter = "";
            
            if (data.rakeGaps) {
                let gapKeyDep = rakeId + '|' + depTime;
                if (data.rakeGaps[gapKeyDep]) {
                    gapBefore = '';
                }
                let gapKeyArr = rakeId + '|' + arrTime;
                if (data.rakeGaps[gapKeyArr]) {
                    gapAfter = '';
                }
            }
            
            let kmCell = '<span class="km-tag" style="opacity:0.3;">—</span>';
            if (r.km_options && r.km_options.length > 0) {
                const opts = r.km_options.map((v, vi) =>
                    '<option value="' + v + '">' + v + ' km</option>'
                ).join('');
                kmCell = '<select class="km-select" id="km_sel_' + kmIdx + '" onchange="recalcKmTotal()" style="background:rgba(0,0,0,0.5);color:var(--green);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:4px 6px;font-size:11px;cursor:pointer;">' +
                    '<option value="">—</option>' + opts + '</select>';
                kmIdx++;
            }
            
            h += `<tr>
                <td>${gapBefore}</td>
                <td style="color:var(--cyan);font-weight:700;">${r["Train_No"]}</td>
                <td>${r["LocationPick"]}</td>
                <td>${displayTime(r["Trip_Start"])}</td>
                <td>${r["LocationRelieve"]}</td>
                <td>${displayTime(r["Trip_End"])}</td>
                <td>${kmCell}</td>
                <td>${gapAfter}</td>
            </tr>`;
        }
    });
    h += `</table></div></div>`;
    
    h += `<div class="result-card cinematic-enter" style="animation-delay:0.3s;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;padding:10px 15px;background:linear-gradient(135deg,rgba(255,107,53,0.2),rgba(200,85,0,0.1));border-radius:10px;border-left:4px solid var(--orange);">
                <span style="font-size:18px;">☕</span><span style="font-family:'Syncopate';font-size:13px;text-transform:uppercase;letter-spacing:2px;">Break Schedule</span>
            </div>
            <div class="table-wrap">
            <table class="data-table">
                <tr><th>Relief Point</th><th>Start</th><th>Duration</th></tr>`;
    
    let hb = false;
    data.roster.forEach(r => {
        let breakVal = parseDuration(r["breaks"]);
        if (breakVal > 0) {
            hb = true;
            const breakStr = breakVal >= 60 ? Math.floor(breakVal/60) + 'h ' + (breakVal%60) + 'm' : breakVal + 'm';
            h += `<tr><td style="color:var(--cyan);font-weight:600;">${r["LocationRelieve"]}</td><td>${displayTime(r["Trip_End"])}</td><td style="color:var(--orange);font-weight:700;">${breakStr}</td></tr>`;
        }
    });
    if (!hb) h += `<tr><td colspan="3" style="color:rgba(255,255,255,0.4);font-style:italic;">No scheduled breaks</td></tr>`;
    h += `</table></div></div>`;
    
    h += `<div class="result-card cinematic-enter" style="animation-delay:0.4s;">
            <div class="summary-grid" style="margin:0;">
                <div class="summary-box"><div class="label">Driving</div><div class="value cyan">${firstRow["Total_Run"] || '-'}</div></div>
                <div class="summary-box"><div class="label">Total Hrs</div><div class="value orange">${firstRow["ACTUAL_DUTYHOURS"] || '-'}</div></div>
                <div class="summary-box"><div class="label">Total KM</div><div class="value green" id="kmTotalDisplay">—</div></div>
            </div>
           </div>`;
    
    // Breadcrumb
    const bc = document.getElementById('resultBreadcrumb');
    if (bc) bc.textContent = 'Line 1 › ' + dayType + ' › Duty ' + dutyNo;
    
    container.innerHTML = h;
    document.getElementById('dutyInputQuick').value = "";
}

// Toast notification
function showToast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function() {
        if (toast.parentNode) toast.remove();
    }, 4000);
}


// Recent searches
// Parse URL params for deep-link auto-search
function checkUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var duty = params.get('duty');
    var day = params.get('day');
    if (duty && day) {
        var daySelect = document.getElementById('daySelect');
        if (daySelect) daySelect.value = day;
        var input = document.getElementById('dutyInputHome');
        if (input) input.value = duty;
        fetchDuty('home');
    }
}

function recalcKmTotal() {
    const selects = document.querySelectorAll('.km-select');
    let total = 0;
    let selected = 0;
    selects.forEach(s => {
        if (s.value !== '') {
            total += parseFloat(s.value) || 0;
            selected++;
        }
    });
    const display = document.getElementById('kmTotalDisplay');
    if (display) {
        if (selected === 0) {
            display.textContent = '—';
        } else if (selected < selects.length) {
            display.textContent = total.toFixed(2) + ' km (' + selected + ' of ' + selects.length + ' selected)';
        } else {
            display.textContent = total.toFixed(2) + ' km';
        }
    }
}

async function fetchDuty(source) {
    const dutyNo = source === 'home' ? document.getElementById('dutyInputHome').value.trim() : document.getElementById('dutyInputQuick').value.trim();
    const dayType = document.getElementById('daySelect').value;
    if (!dutyNo) { showToast('Please enter a duty number', 'error'); return; }
    const num = parseInt(dutyNo);
    if (isNaN(num) || num < 1 || num > 999) { showToast('Duty number must be between 1 and 999', 'error'); return; }
    
    // Loading state for home button
    if (source === 'home') {
        const btn = document.getElementById('homeSearchBtn');
        if (btn) { btn._origHtml = btn.innerHTML; btn.innerHTML = '⏳ Loading...'; btn.disabled = true; }
    }
    
    trackVisit('duty_search', 'search');
    const result = await getDutyData(dayType, dutyNo);
    
    // Restore button
    if (source === 'home') {
        const btn = document.getElementById('homeSearchBtn');
        if (btn) { btn.innerHTML = btn._origHtml || '🔍 ACCESS DUTY DATA'; btn.disabled = false; }
    }
    
    if (result.error) {
        const container = document.getElementById('resultContent');
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-msg">No data found for Duty ' + dutyNo + ' on ' + dayType + '</div><div class="empty-hint">Please check the day type or verify the duty number.</div></div>';
        const bc = document.getElementById('resultBreadcrumb');
        if (bc) bc.textContent = 'Line 1 › ' + dayType + ' › Duty ' + dutyNo;
        if (source === 'home') showPage('pageResult');
        return;
    }
    
    displayResult(result, dutyNo, dayType);
    if (source === 'home') showPage('pageResult');
}

function toggleRegisterModal() {
    const regModal = document.getElementById('registerModal');
    if (regModal.style.display === 'flex') {
        regModal.style.display = 'none';
    } else {
        regModal.style.display = 'flex';
        document.getElementById('regName').value = '';
        document.getElementById('regEmpId').value = '';
        document.getElementById('regAccessCode').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
        const err = document.getElementById('registerError');
        const success = document.getElementById('registerSuccess');
        if (err) err.style.display = 'none';
        if (success) success.style.display = 'none';
        setTimeout(() => document.getElementById('regName').focus(), 100);
    }
}

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

async function handleRegister() {
    const name = document.getElementById('regName').value;
    const empId = document.getElementById('regEmpId').value;
    const accessCode = document.getElementById('regAccessCode').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match!';
        errorDiv.style.display = 'block';
        return;
    }
    if (accessCode !== 'satvik') {
        errorDiv.textContent = 'Invalid Access Code!';
        errorDiv.style.display = 'block';
        return;
    }
    
    const normalizedId = empId.toString().trim().toUpperCase();
    
    try {
        const existing = await api('GET', '/profiles/' + encodeURIComponent(normalizedId));
        if (existing && existing.length > 0 && existing[0].password_hash) {
            errorDiv.textContent = 'Emp ID already registered! Please login.';
            errorDiv.style.display = 'block';
            return;
        }
        const pendingList = await loadAppConfigList('pending_registrations');
        let pending = pendingList.find(p => p.emp_id === normalizedId);
        let accessLevel = pending ? pending.access_level : null;
        if (!accessLevel && existing && existing.length > 0) {
            accessLevel = existing[0].access_level;
        }
        if (!accessLevel) {
            errorDiv.textContent = 'Not authorized! Contact admin to add your Emp ID first.';
            errorDiv.style.display = 'block';
            return;
        }
        
        const passwordHash = hashPassword(password);
        
        const profilePayload = {
            emp_id: normalizedId,
            full_name: name,
            access_level: accessLevel,
            password_hash: passwordHash,
            created_at: new Date().toISOString()
        };
        
        if (existing && existing.length > 0) {
            await api('PUT', '/profiles/' + encodeURIComponent(normalizedId), profilePayload);
        } else {
            try {
                await api('POST', '/profiles', profilePayload);
            } catch (e) {
                await api('PUT', '/profiles/' + encodeURIComponent(normalizedId), profilePayload);
            }
        }
        
        if (pending) {
            const updatedPending = pendingList.filter(p => p.emp_id !== normalizedId);
            await saveAppConfigList('pending_registrations', updatedPending);
        }
        
        currentUser = {
            empId: normalizedId,
            name: name,
            accessLevel: accessLevel
        };
        updateUserHeader();
        
        successDiv.textContent = 'Registration successful!';
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        setTimeout(() => {
            toggleRegisterModal();
            toggleLoginModal();
        }, 2000);
    } catch (e) {
        errorDiv.textContent = 'Error: ' + e.toString();
        errorDiv.style.display = 'block';
    }
}

function closePopup() {
    document.getElementById('popupOverlay').classList.remove('show');
}

async function saveUserMsg() {
    const msg = document.getElementById('userMsgInput').value;
    if (!msg) return;
    try {
        await api('PUT', '/config/UserMessage', { config_value: msg, updated_at: new Date() });
        document.getElementById('userMsgText').textContent = msg;
        document.getElementById('userMsgBanner').style.display = 'flex';
        alert('Message saved!');
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function clearUserMsg() {
    try {
        await api('DELETE', '/config/UserMessage');
        document.getElementById('userMsgInput').value = '';
        document.getElementById('userMsgBanner').style.display = 'none';
        alert('Message cleared!');
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function savePopupMsg() {
    const msg = document.getElementById('popupMsgInput').value;
    if (!msg) return;
    try {
        await api('PUT', '/config/PopupMessage', { config_value: msg, updated_at: new Date() });
        alert('Popup message saved!');
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function clearPopupMsg() {
    try {
        await api('DELETE', '/config/PopupMessage');
        document.getElementById('popupMsgInput').value = '';
        alert('Popup message cleared!');
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function processUploads() {
    if (!confirm('Are you sure you want to publish? This will replace all current trip data.')) return;
    const types = ['Weekday', 'Saturday', 'Sunday', 'Special', 'Test'];
    for (const type of types) {
        const fileInput = document.getElementById('f_' + type);
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            let rows;
            if (file.name.toLowerCase().endsWith('.xlsx')) {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const ws = wb.Sheets['Sheet1'];
                if (!ws) { alert('Sheet1 not found in ' + file.name); continue; }
                rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                rows = rows.map(r => convertXlsxRow(r));
            } else {
                const text = await file.text();
                rows = parseCSV(text);
            }
            if (rows.length > 0) {
                try {
                    const tripRows = rows.map(row => ({
                        day_type: type,
                        Duty_No: String(row.Duty_No || ''),
                        Sign_On: String(row.Sign_On || ''),
                        SignOn_Location: String(row.SignOn_Location || ''),
                        Sign_Off: String(row.Sign_Off || ''),
                        SignOff_Location: String(row.SignOff_Location || ''),
                        ACTUAL_DUTYHOURS: String(row.ACTUAL_DUTYHOURS || ''),
                        Train_No: String(row.Train_No || ''),
                        LocationPick: String(row.LocationPick || ''),
                        Trip_Start: String(row.Trip_Start || ''),
                        LocationRelieve: String(row.LocationRelieve || ''),
                        Trip_End: String(row.Trip_End || ''),
                        Trip_Duration: String(row.Trip_Duration || ''),
                        breaks: String(row.breaks || ''),
                        Single_Run: String(row.Single_Run || ''),
                        Total_Run: String(row.Total_Run || ''),
                        Step_Back_Rake: String(row['Step Back Rake'] || row.Step_Back_Rake || ''),
                        Step_Back_Location: String(row['Step Back Location'] || row.Step_Back_Location || ''),
                        ROUTE_VIA: String(row['ROUTE-VIA'] || row.ROUTE_VIA || '')
                    }));
                    await api('DELETE', '/trip-data?day_type=' + encodeURIComponent(type));
                    await api('POST', '/trip-data/bulk', tripRows);
                    const wef = (document.getElementById('wef_' + type)?.value || '').trim();
                    const remarks = (document.getElementById('rem_' + type)?.value || '').trim();
                    const keys = [type + '_wef', type + '_remarks'];
                    await api('POST', '/config/bulk-delete', { keys });
                    if (wef) await api('PUT', '/config/' + encodeURIComponent(type + '_wef'), { config_value: wef });
                    if (remarks) await api('PUT', '/config/' + encodeURIComponent(type + '_remarks'), { config_value: remarks });
                    alert(type + ' data uploaded!');
                } catch (e) {
                    alert('Error uploading ' + type + ' data: ' + e.message);
                }
            }
        }
    }
}

function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const vals = parseCSVLine(line);
        const row = {};
        for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = (vals[i] || '').trim();
        }
        return row;
    }).filter(row => Object.values(row).some(v => v !== ''));
}

function parseCSVLine(line) {
    const result = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += line[i];
        }
    }
    result.push(current.trim());
    return result;
}

function toStr(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function displayTime(str) {
  if (!str) return str;
  const s = str.toString().trim();
  const parts = s.split(' ');
  const time = parts[parts.length - 1];
  return time.substring(0, 5);
}

function parseDuration(str) {
  if (!str) return 0;
  const parts = str.toString().trim().split(':');
  if (parts.length < 2) return parseFloat(str) || 0;
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return h * 60 + m;
}

function fmtDateTime(v) {
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
  }
  return toStr(v);
}

function fmtDuration(v) {
  if (typeof v === 'number') {
    const totalSec = Math.round(Math.abs(v) * 86400);
    const h = Math.floor(totalSec / 3600);
    const mi = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return toStr(v);
}

function convertXlsxRow(row) {
  return {
    Duty_No: toStr(row.Duty_No),
    Sign_On: fmtDateTime(row.Sign_On),
    SignOn_Location: toStr(row.SignOn_Location),
    Sign_Off: fmtDateTime(row.Sign_Off),
    SignOff_Location: toStr(row.SignOff_Location),
    ACTUAL_DUTYHOURS: fmtDuration(row.ACTUAL_DUTYHOURS),
    Train_No: toStr(row.Train_No),
    LocationPick: toStr(row.LocationPick),
    Trip_Start: fmtDateTime(row.Trip_Start),
    LocationRelieve: toStr(row.LocationRelieve),
    Trip_End: fmtDateTime(row.Trip_End),
    Trip_Duration: fmtDuration(row.Trip_Duration),
    breaks: fmtDuration(row.breaks),
    Single_Run: fmtDuration(row.Single_Run),
    Total_Run: fmtDuration(row.Total_Run),
    'Step Back Rake': toStr(row['Step Back Rake'] || row.Step_Back_Rake),
    'Step Back Location': toStr(row['Step Back Location'] || row.Step_Back_Location),
    'ROUTE-VIA': toStr(row['ROUTE-VIA'] || row.ROUTE_VIA)
  };
}

async function clearData(type) {
    if (!confirm('Clear ' + type + ' data?')) return;
    try {
        await api('DELETE', '/trip-data?day_type=' + encodeURIComponent(type));
        alert(type + ' data cleared!');
    } catch (e) { alert('Error: ' + e.toString()); }
}

function updateAdminUI(accessLevel) {
    const adminTabs = document.querySelectorAll('.admin-only-tab');
    const usersTab = document.getElementById('tabUsers');
    if (accessLevel === 'admin') {
        adminTabs.forEach(tab => tab.style.display = 'inline-block');
        if (usersTab) usersTab.style.display = 'inline-block';
    } else {
        adminTabs.forEach(tab => tab.style.display = 'none');
        if (usersTab) usersTab.style.display = 'none';
    }
}

function switchAdminTab(tabName) {
    const isAdmin = currentUser && currentUser.accessLevel && currentUser.accessLevel.toLowerCase() === 'admin';
    const restrictedTabs = ['messages', 'upload', 'users', 'form'];
    if (!isAdmin && restrictedTabs.indexOf(tabName) !== -1) {
        alert('Admin access required for this section!');
        return;
    }
    document.querySelectorAll('.admin-tab-content').forEach(t => t.style.display = 'none');
    const tabContent = document.getElementById('adminTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (tabContent) tabContent.style.display = 'block';
    // Update active tab indicator
    var tabBar = document.querySelector('#pageAdmin .glass-card > div[style*="display:flex"]');
    if (tabBar) {
        tabBar.querySelectorAll('button').forEach(function(btn) { btn.classList.remove('admin-tab-active'); });
    }
    var activeBtn = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (activeBtn) activeBtn.classList.add('admin-tab-active');
    if (tabName === 'messages') { loadVisitorStats(); }
    if (tabName === 'upload') loadKmData();
    if (tabName === 'km' || tabName === 'chart') loadKmData();
    if (tabName === 'users') loadUserManagementData();
    if (tabName === 'chart') initSeriesGrid();
}

// SESSION MANAGEMENT
function saveSession(user) {
    currentUser = user;
    sessionStorage.setItem('dmrcUser', JSON.stringify(user));
    updateUserHeader();
}

function checkExistingSession() {
    const savedUser = sessionStorage.getItem('dmrcUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserHeader();
            loadUserMessages();
        } catch(e) {
            sessionStorage.removeItem('dmrcUser');
        }
    }
}

function updateUserHeader() {
    const headerBar = document.getElementById('loggedInUserHeader');
    if (!headerBar) return;
    if (currentUser) {
        document.getElementById('headerUserName').textContent = currentUser.name;
        document.getElementById('headerUserId').textContent = currentUser.empId;
        const currentPage = document.querySelector('.page.active');
        if (currentPage && (currentPage.id === 'pageAdmin')) {
            headerBar.classList.add('show');
        } else {
            headerBar.classList.remove('show');
        }
    } else {
        headerBar.classList.remove('show');
    }
    // Update login/logout button
    const loginBtn = document.getElementById('minimalLoginText');
    if (loginBtn) loginBtn.textContent = currentUser ? '👤 LOGOUT' : '👤 LOGIN';
    // Show/hide admin-only elements
    const isAdmin = currentUser && currentUser.accessLevel && currentUser.accessLevel.toLowerCase() === 'admin';
    document.querySelectorAll('.admin-only-upload-row, .admin-only-day').forEach(el => el.style.display = isAdmin ? '' : 'none');
}

function togglePasswordVisibility(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// Login/Logout button
document.addEventListener('click', function(e) {
    if (e.target.id === 'minimalLoginTrigger' || e.target.closest('#minimalLoginTrigger')) {
        if (currentUser) {
            handleLogout();
        } else {
            toggleLoginModal();
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        if (currentUser && currentUser.accessLevel && currentUser.accessLevel.toLowerCase() === 'admin') {
            showPage('pageAdmin');
            loadAdminData();
        } else {
            toggleLoginModal();
        }
    }
});

function adminLogin() {
    toggleLoginModal();
}

// UPDATE DATE/TIME
function updateDateTime() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    document.getElementById('currentDate').textContent = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
    document.getElementById('currentDay').textContent = days[now.getDay()];
    const daySelect = document.getElementById('daySelect');
    if (daySelect) {
        if (now.getDay() === 0) daySelect.value = 'Sunday';
        else if (now.getDay() === 6) daySelect.value = 'Saturday';
        else daySelect.value = 'Weekday';
    }
}

// FORMAT TIME
function formatTime(h) {
    if (isNaN(h)) return "00:00";
    let hrs = Math.floor(h);
    let mins = Math.round((h - hrs) * 60);
    if (mins === 60) { hrs++; mins = 0; }
    return hrs.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
}

// GET CUSTOM DUTIES
function getCustomDuties(inputId) {
    const val = document.getElementById(inputId)?.value;
    if (!val || !val.trim()) return [];
    return val.split(',').map(d => d.trim()).filter(d => d !== '');
}

// LOAD USER MESSAGES
async function loadUserMessages() {
    try {
        const data = await api('GET', '/config/UserMessage');
        if (data && data.config_value) {
            document.getElementById('userMsgBanner').style.display = 'flex';
            document.getElementById('userMsgText').textContent = data.config_value;
        } else {
            document.getElementById('userMsgBanner').style.display = 'none';
        }
    } catch (e) {}
}

// LOAD POPUP MESSAGE
async function loadPopupMessage() {
    try {
        const data = await api('GET', '/config/PopupMessage');
        if (data && data.config_value) {
            document.getElementById('popupMessageText').textContent = data.config_value;
            document.getElementById('popupOverlay').classList.add('show');
        }
    } catch (e) {}
}

// ADMIN DATA LOADER
async function loadAdminData() {
    loadAdminLibs();
    const isAdmin = currentUser && currentUser.accessLevel && currentUser.accessLevel.toLowerCase() === 'admin';
    const isMainAdmin = currentUser && currentUser.empId === '3623';
    const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
    adminOnlyTabs.forEach(tab => { tab.style.display = isAdmin ? 'inline-block' : 'none'; });
    const usersTab = document.getElementById('tabUsers');
    if (usersTab) { usersTab.style.display = isAdmin ? 'inline-block' : 'none'; }
    const empIdSpan = document.getElementById('adminLoggedEmpId');
    const levelSpan = document.getElementById('adminLoggedLevel');
    if (empIdSpan) empIdSpan.textContent = currentUser ? currentUser.empId : 'Not logged in';
    if (levelSpan) levelSpan.textContent = currentUser ? currentUser.accessLevel : '-';
    if (isAdmin) {
        loadMessageLog();
        loadVisitorStats();

    }
    // Restrict "Admin" dropdown option to emp 3623 only
    ['newUserAccessLevel', 'removeUserAccessLevel'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const adminOpt = sel.querySelector('option[value="admin"]');
        if (adminOpt) adminOpt.style.display = isMainAdmin ? 'block' : 'none';
        if (!isMainAdmin && sel.value === 'admin') sel.value = 'crewcontroller';
    });
    loadUserManagementData();
    if (isAdmin) {
        switchAdminTab('messages');
    } else {
        switchAdminTab('chart');
    }
    // Load existing WEF/Remarks into upload form
    try {
        const configData = await api('GET', '/config');
        if (configData) {
            configData.forEach(c => {
                const el = document.getElementById(c.config_key);
                if (el) el.value = c.config_value;
            });
        }
    } catch (e) {}
}

// USER MANAGEMENT
async function loadAppConfigList(key) {
    const data = await api('GET', '/config/' + encodeURIComponent(key));
    return data ? JSON.parse(data.config_value || '[]') : [];
}
async function saveAppConfigList(key, list) {
    await api('PUT', '/config/' + encodeURIComponent(key), { config_value: JSON.stringify(list), updated_at: new Date().toISOString() });
}

async function loadUserManagementData() {
    try {
        const loggedSpan = document.getElementById('changePwdLoggedEmpId');
        if (loggedSpan && currentUser) loggedSpan.textContent = currentUser.empId + ' (' + currentUser.name + ')';
        
        const pendingList = await loadAppConfigList('pending_registrations');
        
        // Admin Access List: show pre-authorized admin emp IDs
        const adminIds = pendingList.filter(p => p.access_level === 'admin').map(p => p.emp_id);
        document.getElementById('adminAccessList').innerHTML = adminIds.length > 0 ? adminIds.join('<br>') : 'None';
        
        // Crew Controller Access List: show pre-authorized CC emp IDs
        const ccIds = pendingList.filter(p => p.access_level === 'crewcontroller').map(p => p.emp_id);
        document.getElementById('ccAccessList').innerHTML = ccIds.length > 0 ? ccIds.join('<br>') : 'None';
        
        // Registered Users: show profiles with password_hash
        const profiles = await api('GET', '/profiles');
        const tbody = document.getElementById('registeredUsersBody');
        if (!tbody) return;
        if (!profiles || profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.4);">No registered users</td></tr>';
        } else {
            tbody.innerHTML = '';
            profiles.forEach(p => {
                if (!p.password_hash) return;
                const tr = document.createElement('tr');
                tr.innerHTML = '<td style="color:var(--cyan);">' + p.emp_id + '</td>' +
                    '<td>' + (p.full_name || '-') + '</td>' +
                    '<td><span style="padding:2px 6px;border-radius:4px;font-size:9px;background:' + (p.access_level === 'admin' ? 'var(--red)' : 'var(--green)') + ';color:#000;">' + (p.access_level || 'crewcontroller') + '</span></td>' +
                    '<td>' + (p.created_at || '-') + '</td>';
                tbody.appendChild(tr);
            });
        }
        
        toggleSecretCode('new');
        toggleSecretCode('remove');
    } catch (e) { console.error('loadUserManagementData:', e); }
}

async function changePassword() {
    if (!currentUser) return alert('Not logged in!');
    const newPwd = document.getElementById('changePwdNew')?.value;
    if (!newPwd) return alert('Enter New Password!');
    if (newPwd.length < 6) return alert('Password must be at least 6 characters!');
    try {
        const hash = hashPassword(newPwd);
        await api('PUT', '/profiles/' + encodeURIComponent(currentUser.empId), { password_hash: hash });
        alert('Password changed for ' + currentUser.empId);
        document.getElementById('changePwdNew').value = '';
    } catch (e) { alert('Error: ' + e.toString()); }
}

function toggleSecretCode(type) {
    const select = document.getElementById(type === 'new' ? 'newUserAccessLevel' : 'removeUserAccessLevel');
    const codeGroup = document.getElementById(type === 'new' ? 'newSecretCodeGroup' : 'removeSecretCodeGroup');
    if (codeGroup) {
        codeGroup.style.display = (select && select.value === 'admin') ? 'block' : 'none';
    }
}

async function addNewUserAccess() {
    const empId = document.getElementById('newUserEmpId')?.value?.trim()?.toUpperCase();
    const accessLevel = document.getElementById('newUserAccessLevel')?.value;
    const secretCode = document.getElementById('newSecretCode')?.value;
    if (!empId) return alert('Enter Emp ID!');
    if (accessLevel === 'admin' && currentUser.empId !== '3623') return alert('Only Main Admin (3623) can grant admin access!');
    if (accessLevel === 'admin' && secretCode !== 'mudit') return alert('Wrong Secret Code!');
    try {
        let existing;
        try { existing = await api('GET', '/profiles/' + encodeURIComponent(empId)); } catch (e) { return alert('DB Error: ' + e.message); }
        if (existing && existing.length > 0 && existing[0].password_hash) {
            return alert(empId + ' is already registered! Remove and re-add to change role.');
        }
        const pendingList = await loadAppConfigList('pending_registrations');
        const alreadyPending = pendingList.find(p => p.emp_id === empId);
        if (alreadyPending) {
            alreadyPending.access_level = accessLevel;
            await saveAppConfigList('pending_registrations', pendingList);
            alert(accessLevel.charAt(0).toUpperCase() + accessLevel.slice(1) + ' access updated for ' + empId + ' (pending)');
        } else {
            pendingList.push({ emp_id: empId, access_level: accessLevel });
            await saveAppConfigList('pending_registrations', pendingList);
            alert(empId + ' pre-authorized as ' + accessLevel + '. They can now register.');
        }
        document.getElementById('newUserEmpId').value = '';
        loadUserManagementData();
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function deleteOrphanProfile() {
    const empId = document.getElementById('orphanDeleteEmpId')?.value?.trim()?.toUpperCase();
    if (!empId) return alert('Enter Emp ID!');
    if (!confirm('Delete profile for ' + empId + '?')) return;
    try {
        await api('DELETE', '/profiles/' + encodeURIComponent(empId));
        alert('Profile for ' + empId + ' deleted!');
        document.getElementById('orphanDeleteEmpId').value = '';
        loadUserManagementData();
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function removeUserAccess() {
    const empId = document.getElementById('removeUserEmpId')?.value?.trim()?.toUpperCase();
    const accessLevel = document.getElementById('removeUserAccessLevel')?.value;
    const secretCode = document.getElementById('removeSecretCode')?.value;
    if (!empId) return alert('Enter Emp ID!');
    if (accessLevel === 'admin' && currentUser.empId !== '3623') return alert('Only Main Admin (3623) can remove admin access!');
    if (accessLevel === 'admin' && secretCode !== 'mudit') return alert('Wrong Secret Code!');
    if (empId === '3623') return alert('Cannot remove Main Admin!');
    try {
        await api('DELETE', '/profiles/' + encodeURIComponent(empId));
        const pendingList = await loadAppConfigList('pending_registrations');
        const idx = pendingList.findIndex(p => p.emp_id === empId);
        if (idx !== -1) {
            pendingList.splice(idx, 1);
            await saveAppConfigList('pending_registrations', pendingList);
        }
        alert('User ' + empId + ' removed!');
        document.getElementById('removeUserEmpId').value = '';
        loadUserManagementData();
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function resetAdminIds() {
    if (!confirm('Reset Admin IDs to only 3623?')) return;
    try {
        await api('PUT', '/profiles/reset-admin');
        const pendingList = await loadAppConfigList('pending_registrations');
        const filtered = pendingList.filter(p => !(p.access_level === 'admin' && p.emp_id !== '3623'));
        await saveAppConfigList('pending_registrations', filtered);
        alert('Admin IDs reset! Only 3623 remains admin.');
        loadUserManagementData();
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function resetCcIds() {
    if (!confirm('Clear all Crew Controller IDs?')) return;
    try {
        await api('PUT', '/profiles/reset-cc');
        const pendingList = await loadAppConfigList('pending_registrations');
        const filtered = pendingList.filter(p => p.access_level !== 'crewcontroller');
        await saveAppConfigList('pending_registrations', filtered);
        alert('CC IDs cleared!');
        loadUserManagementData();
    } catch (e) { alert('Error: ' + e.toString()); }
}

// MESSAGE LOG
async function loadMessageLog() {
    try {
        const logs = await api('GET', '/message-log');
        const tbody = document.getElementById('messageLogBody');
        if (!tbody) return;
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.4);">No message activity logged yet</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.style.background = log.action === 'POSTED' ? 'rgba(34,197,94,0.1)' :
                log.action === 'POPUP' ? 'rgba(168,85,247,0.1)' :
                log.action === 'CLEARED' ? 'rgba(239,68,68,0.1)' : '';
            tr.innerHTML = '<td>' + (log.timestamp || '') + '</td>' +
                '<td style="color:var(--cyan);font-weight:600;">' + (log.emp_id || '') + '</td>' +
                '<td>' + (log.emp_name || '') + '</td>' +
                '<td><span style="padding:2px 6px;border-radius:4px;font-size:9px;background:' +
                (log.action === 'POSTED' ? 'var(--green)' : log.action === 'POPUP' ? 'var(--purple)' : 'var(--red)') +
                ';color:#000;">' + log.action + '</span></td>' +
                '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (log.message || '-') + '</td>';
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

async function clearMessageLog() {
    if (!confirm('Clear Message Activity Log? This cannot be undone!')) return;
    if (!currentUser || currentUser.empId !== '3623') return alert('Only Main Admin (3623) can clear log!');
    try {
        await api('DELETE', '/message-log');
        alert('Message log cleared!');
        loadMessageLog();
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function clearFormActivityLog() {
    if (!confirm('Clear Form Activity Log? This cannot be undone!')) return;
    if (!currentUser || currentUser.empId !== '3623') return alert('Only Main Admin (3623) can clear log!');
    try {
        await api('DELETE', '/form-log');
        alert('Form activity log cleared!');
    } catch (e) { alert('Error: ' + e.toString()); }
}



// ENHANCED GRAPH
let currentChartData = null;

async function generateGraph() {
    const dayType = document.getElementById('graphDay').value;
    const series = Array.from(document.querySelectorAll('input[name="series"]:checked')).map(cb => cb.value);
    const customDuties = getCustomDuties('customDutiesGraph');
    if (series.length === 0 && customDuties.length === 0) return alert('Select series or enter duty numbers!');
    const result = await getGraphData(dayType, series, customDuties);
    if (result.error) { alert(result.error); return; }
    currentChartData = result;
    document.getElementById('graphWrapper').style.display = 'block';
    const seriesStr = series.length > 0 ? 'Series: ' + series.join(', ') : '';
    const customStr = customDuties.length > 0 ? 'Custom: ' + customDuties.join(', ') : '';
    document.getElementById('chartTitle').textContent = dayType + ' - ' + (seriesStr + (customStr ? (seriesStr ? ' | ' : '') + customStr : ''));
    document.getElementById('avgDisplay').textContent = 'AVG: ' + result.avgTime;
    const chartWidth = Math.max(1200, result.details.length * 80 + 100);
    document.getElementById('chartInner').style.width = chartWidth + 'px';
    const getBarColor = (d) => {
        const on = parseInt((d.signOnTime || '').split(':')[0]);
        const off = parseInt((d.signOffTime || '').split(':')[0]);
        if (on < 7 && off >= 22) return '#ef4444';
        if (on < 7) return '#ff9500';
        if (off >= 22) return '#a855f7';
        return '#00d4ff';
    };
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: result.details.map(d => d.duty),
            datasets: [{
                data: result.details.map(d => d.running),
                backgroundColor: result.details.map(d => getBarColor(d)),
                borderColor: result.details.map(d => getBarColor(d)),
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(...result.details.map(d => d.running)) * 1.25,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#fff', callback: v => formatTime(v), font: { size: 12, weight: 'bold' } },
                    title: { display: true, text: 'Running Hours', color: 'rgba(255,255,255,0.7)', font: { size: 14, weight: 'bold' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#fff', font: { weight: 'bold', size: 12 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20,20,40,0.98)',
                    borderColor: '#00d4ff',
                    borderWidth: 2,
                    titleColor: '#00d4ff',
                    bodyColor: '#fff',
                    titleFont: { weight: 'bold', size: 14 },
                    bodyFont: { size: 13 },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function(context) { return 'Duty: ' + context[0].label; },
                        label: function(context) {
                            const idx = context.dataIndex;
                            const d = result.details[idx];
                            return [ 'Driving Hrs: ' + d.runningStr, 'Sign On: ' + d.signOnTime + ' @ ' + d.signOnLoc, 'Sign Off: ' + d.signOffTime + ' @ ' + d.signOffLoc ];
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'aboveLabels',
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                meta.data.forEach(function(bar, index) {
                    const d = result.details[index];
                    const barHeight = bar.height;
                    const barX = bar.x;
                    const barY = bar.y;
                    ctx.save();
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.9)';
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetX = 1;
                    ctx.shadowOffsetY = 1;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(d.runningStr, barX, barY - barHeight - 10);
                    ctx.restore();
                });
            }
        }]
    });
}

async function downloadChartPDF() {
    if (!currentChartData) return alert('Generate Chart first!');
    await ensureHtml2canvas();
    const title = document.getElementById('chartTitle').innerText;
    const avgText = document.getElementById('avgDisplay').innerText;
    const data = currentChartData.details;
    const chartWidth = Math.max(2000, data.length * 90 + 200);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'background:#1a1a2e;padding:40px;width:' + chartWidth + 'px;min-height:850px;display:flex;flex-direction:column;align-items:center;position:fixed;left:-9999px;top:0;z-index:-1;';
    wrapper.innerHTML = `
        <div style="width:100%;text-align:center;margin-bottom:20px;">
            <h2 style="color:#00d4ff;font-family:Arial,sans-serif;margin:0;font-size:28px;font-weight:bold;">${title}</h2>
        </div>
        <div style="width:100%;text-align:center;margin-bottom:25px;display:flex;justify-content:center;gap:40px;">
            <span style="color:#22c55e;font-family:Arial;font-size:16px;font-weight:bold;">${avgText}</span>
            <span style="color:#fff;font-family:Arial;font-size:16px;">Total Duties: <b style="color:#00d4ff;">${data.length}</b></span>
        </div>
        <div style="width:100%;height:600px;background:rgba(0,0,0,0.3);border-radius:15px;padding:25px;border:1px solid rgba(0,212,255,0.3);">
            <canvas id="pdfChartCanvas"></canvas>
        </div>
        <div style="width:100%;display:flex;justify-content:space-between;margin-top:20px;">
            <div style="color:rgba(255,255,255,0.5);font-size:12px;font-family:Arial;">
                DMRC Line 3/4 • Generated: ${new Date().toLocaleDateString()}
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);
    setTimeout(() => {
        const getBarColor = (d) => {
            const on = parseInt((d.signOnTime || '').split(':')[0]);
            const off = parseInt((d.signOffTime || '').split(':')[0]);
            if (on < 7 && off >= 22) return '#ef4444';
            if (on < 7) return '#ff9500';
            if (off >= 22) return '#a855f7';
            return '#00d4ff';
        };
        const pdfCtx = document.getElementById('pdfChartCanvas').getContext('2d');
        new Chart(pdfCtx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.duty),
                datasets: [{ data: data.map(d => d.running), backgroundColor: data.map(d => getBarColor(d)), borderColor: data.map(d => getBarColor(d)), borderWidth: 2, borderRadius: 8 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, barPercentage: 0.7, categoryPercentage: 0.8,
            scales: {
                y: { beginAtZero: true, max: Math.max(...data.map(d => d.running)) * 1.25, grid: { color: 'rgba(255,255,255,0.12)' }, ticks: { color: '#fff', font: { size: 13, weight: 'bold' }, callback: v => formatTime(v) }, title: { display: true, text: 'Running Hours', color: 'rgba(255,255,255,0.8)', font: { size: 15, weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { color: '#fff', font: { size: 13, weight: 'bold' } } }
            },
            plugins: { legend: { display: false } }
        }
    });
    setTimeout(() => {
            html2canvas(wrapper, { scale: 1.5, backgroundColor: '#1a1a2e', useCORS: true, logging: false, width: chartWidth, height: 900 }).then(canvasImg => {
                document.body.removeChild(wrapper);
                const imgData = canvasImg.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
                link.href = imgData;
                link.click();
            }).catch(err => { document.body.removeChild(wrapper); alert('Error generating PNG: ' + err); });
        }, 500);
    }, 100);
}

function downloadChartExcel() {
    if (!currentChartData) return alert('Generate Chart first!');
    const title = document.getElementById('chartTitle').innerText;
    const data = currentChartData.details;
    const wsData = [['Duty', 'Running Time', 'Sign On Loc', 'Sign On Time', 'Sign Off Loc', 'Sign Off Time']];
    data.forEach(d => { wsData.push([d.duty, d.runningStr, d.signOnLoc, d.signOnTime, d.signOffLoc, d.signOffTime]); });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Chart Data');
    XLSX.writeFile(wb, 'chart_data.xlsx');
}

// KM EXCEL
async function downloadKmExcel() {
    const dayType = document.getElementById('kmDay')?.value || 'Weekday';
    const series = Array.from(document.querySelectorAll('input[name="kmSeries"]:checked')).map(cb => cb.value);
    const customDuties = getCustomDuties('customDutiesKm');
    if (series.length === 0 && customDuties.length === 0) return alert('Select series or enter duty numbers!');
    try {
        let data;
        try { data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(dayType)); } catch (e) { alert('Error: ' + e.message); return; }
        if (!data || data.length === 0) { alert('No data found for ' + dayType); return; }

        const dutyTotals = {};
        for (let i = 0; i < data.length; i++) {
            const d = (data[i]["Duty_No"] || '').toString().trim();
            if (!d) continue;
            const isSeriesMatched = series.some(s => {
                if (s === '11-20') { const num = parseInt(d); return num >= 11 && num <= 20; }
                const num = parseInt(s);
                if (num >= 10) return d === s || d.startsWith(s + '-') || d.startsWith(s + '0');
                return d.startsWith(s);
            });
            const isCustom = customDuties.length > 0 && customDuties.indexOf(d) !== -1;
            if (!isSeriesMatched && !isCustom) continue;
            if (!dutyTotals[d]) dutyTotals[d] = { km: 0, signOn: '', signOnLoc: '', signOff: '', signOffLoc: '' };
            const r = data[i];
            if (r["Train_No"] && r["Train_No"].toString().trim() !== '') {
                const from = (r["LocationPick"] || '').toString().trim().toUpperCase();
                const to = (r["LocationRelieve"] || '').toString().trim().toUpperCase();
                const _kmVal = kmData[(from + '|' + to).replace(/\s+/g, ' ')]; dutyTotals[d].km += Array.isArray(_kmVal) ? (_kmVal[0] || 0) : (_kmVal || 0);
            }
            if (r["Sign_On"] && (!dutyTotals[d].signOn || r["Sign_On"] < dutyTotals[d].signOn)) {
                dutyTotals[d].signOn = r["Sign_On"];
                dutyTotals[d].signOnLoc = r["SignOn_Location"] || '';
            }
            if (r["Sign_Off"] && (!dutyTotals[d].signOff || r["Sign_Off"] > dutyTotals[d].signOff)) {
                dutyTotals[d].signOff = r["Sign_Off"];
                dutyTotals[d].signOffLoc = r["SignOff_Location"] || '';
            }
        }

        const dutyList = Object.keys(dutyTotals).sort();
        if (dutyList.length === 0) { alert('No duties found for the selected criteria!'); return; }
        let totalKm = 0;
        const wsData = [['Duty', 'Sign On', 'Sign On Loc', 'Sign Off', 'Sign Off Loc', 'KM']];
        dutyList.forEach(d => {
            totalKm += dutyTotals[d].km;
            wsData.push([d, dutyTotals[d].signOn, dutyTotals[d].signOnLoc, dutyTotals[d].signOff, dutyTotals[d].signOffLoc, dutyTotals[d].km.toFixed(2)]);
        });
        wsData.push([]);
        wsData.push(['Total Duties:', dutyList.length]);
        wsData.push(['Total KM:', totalKm.toFixed(2)]);
        wsData.push(['Average KM:', (totalKm / dutyList.length).toFixed(2)]);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'KM Analysis');
        XLSX.writeFile(wb, dayType + '_KM_Analysis.xlsx');
    } catch (e) { alert('Error: ' + e.toString()); }
}

// INIT
window.addEventListener('DOMContentLoaded', async () => {
    checkExistingSession();
    await loadKmData();
    updateDateTime();
    await loadPopupMessage();
    if (!currentUser) await loadUserMessages();
    checkUrlParams();
    const page = document.querySelector('.page.active');
    if (page && page.id) trackVisit(page.id, 'pageview');
});

function trackVisit(page, type) {
    logVisit(page, type, currentUser ? currentUser.empId : null);
}

// CHART FUNCTIONS
let myChart = null;

async function getGraphData(type, seriesArray, customDuties) {
    try {
        let data;
        try { data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(type)); } catch (e) { return { error: 'API error: ' + e.message }; }
        if (!data || data.length === 0) return { error: 'No data in ' + type };
        
        const chartData = [];
        let totalMinutes = 0;
        const seenDuties = {};
        
        for (let i = 0; i < data.length; i++) {
            const d = (data[i]["Duty_No"] || '').toString().trim();
            const isSeriesMatched = seriesArray.some(s => {
                if (s === '11-20') {
                    const num = parseInt(d);
                    return num >= 11 && num <= 20;
                }
                const num = parseInt(s);
                if (num >= 10) return d === s || d.startsWith(s + '-') || d.startsWith(s + '0');
                return d.startsWith(s);
            });
            const isCustomMatched = customDuties && customDuties.length > 0 && customDuties.indexOf(d) !== -1;
            
            if ((isSeriesMatched || isCustomMatched) && d !== '') {
                if (seenDuties[d]) continue;
                const timeStr = (data[i]["Trip_Duration"] || '').toString().trim();
                if (timeStr === '' || timeStr.indexOf(':') === -1) continue;
                const p = timeStr.split(':');
                const mins = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
                seenDuties[d] = true;
                chartData.push({ 
                    duty: d, 
                    running: mins / 60, 
                    runningStr: timeStr, 
                    dutyStr: (data[i]["ACTUAL_DUTYHOURS"] || '').toString(), 
                    signOnLoc: (data[i]["SignOn_Location"] || '').toString(), 
                    signOnTime: (data[i]["Sign_On"] || '').toString(), 
                    signOffLoc: (data[i]["SignOff_Location"] || '').toString(), 
                    signOffTime: (data[i]["Sign_Off"] || '').toString() 
                });
                totalMinutes += mins;
            }
        }
        
        if (!chartData.length) return { error: 'No duties found.' };
        const avgMins = totalMinutes / chartData.length;
        const avgHrs = Math.floor(avgMins / 60);
        const remMins = Math.round(avgMins % 60);
        const avgStr = avgHrs.toString().padStart(2, '0') + ':' + remMins.toString().padStart(2, '0');
        return { details: chartData, avgTime: avgStr, day: type };
    } catch (e) { return { error: e.toString() }; }
}

// VISITOR STATS
async function logVisit(page, type, empId) {
    try {
        await api('POST', '/visitors', { page, type, emp_id: empId || 'Organic', user_agent: navigator.userAgent ? navigator.userAgent.substring(0, 100) : 'Unknown', timestamp: new Date() });
    } catch (e) {}
}

async function getVisitorStats() {
    try {
        const stats = await api('GET', '/visitors/stats');
        return stats || { totalVisits: 0, organic: 0, loggedIn: 0, today: 0, thisWeek: 0 };
    } catch (e) { return { totalVisits: 0, organic: 0, loggedIn: 0, today: 0, thisWeek: 0 }; }
}

async function loadVisitorStats() {
    const stats = await getVisitorStats();
    document.getElementById('visitTotal').textContent = stats.totalVisits;
    document.getElementById('visitOrganic').textContent = stats.organic;
    document.getElementById('visitLoggedIn').textContent = stats.loggedIn;
    document.getElementById('visitToday').textContent = stats.today;
    document.getElementById('visitWeek').textContent = stats.thisWeek;
    const chartBody = document.getElementById('visitorChartBody');
    if (chartBody && chartBody.style.display !== 'none') {
        if (visitorChartInstance) { visitorChartInstance.destroy(); visitorChartInstance = null; }
        renderVisitorChart();
    }
    const hourBody = document.getElementById('hourChartBody');
    if (hourBody && hourBody.style.display !== 'none') {
        if (hourChartInstance) { hourChartInstance.destroy(); hourChartInstance = null; }
        renderHourChart();
    }
    const pageBody = document.getElementById('pageChartBody');
    if (pageBody && pageBody.style.display !== 'none') {
        if (pageChartInstance) { pageChartInstance.destroy(); pageChartInstance = null; }
        renderPageChart();
    }
}

// === VISITOR TREND CHART ===
let visitorChartInstance = null;

function toggleVisitorChart() {
    const body = document.getElementById('visitorChartBody');
    const arrow = document.getElementById('visitorChartArrow');
    if (!body || !arrow) return;
    const isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    arrow.textContent = isVisible ? '▶' : '▼';
    if (!isVisible && !visitorChartInstance) {
        renderVisitorChart();
    }
}

async function renderVisitorChart() {
    try {
        const data = await api('GET', '/visitors/trend');
        if (!data) return;
        const dailyMap = {};
        data.forEach(v => {
            if (!v.date) return;
            dailyMap[v.date] = v.count;
        });
        const sortedDates = Object.keys(dailyMap).sort();
        if (sortedDates.length === 0) return;
        const labels = sortedDates.map(d => {
            const parts = d.split('-');
            return parts[2] + '/' + parts[1];
        });
        const values = sortedDates.map(d => dailyMap[d]);
        const canvas = document.getElementById('visitorChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (visitorChartInstance) visitorChartInstance.destroy();
        visitorChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Visitors',
                    data: values,
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0,212,255,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#00d4ff',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#fff', font: { size: 11 }, stepSize: 1 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 10 }, maxTicksLimit: 15 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(20,20,40,0.98)',
                        borderColor: '#00d4ff',
                        borderWidth: 2,
                        titleColor: '#00d4ff',
                        bodyColor: '#fff',
                        padding: 10
                    }
                }
            }
        });
    } catch (e) { console.error('Visitor chart error:', e); }
}

// === HOUR OF DAY CHART ===
let hourChartInstance = null;

function toggleHourChart() {
    const body = document.getElementById('hourChartBody');
    const arrow = document.getElementById('hourChartArrow');
    if (!body || !arrow) return;
    const isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    arrow.textContent = isVisible ? '▶' : '▼';
    if (!isVisible && !hourChartInstance) renderHourChart();
}

async function renderHourChart() {
    try {
        const data = await api('GET', '/visitors/hourly');
        if (!data) return;
        const hourCounts = data;
        const canvas = document.getElementById('hourChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (hourChartInstance) hourChartInstance.destroy();
        hourChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00'),
                datasets: [{
                    label: 'Visits',
                    data: hourCounts,
                    backgroundColor: hourCounts.map(v =>
                        v > 0 ? 'rgba(255,107,53,0.7)' : 'rgba(255,107,53,0.15)'
                    ),
                    borderColor: 'rgba(255,107,53,0.9)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff', font: { size: 11 }, stepSize: 1 } },
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 9 }, maxTicksLimit: 24 } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(20,20,40,0.98)', borderColor: '#ff6b35', borderWidth: 2, titleColor: '#ff6b35', bodyColor: '#fff', padding: 10 } }
            }
        });
    } catch (e) { console.error('Hour chart error:', e); }
}

// === PAGE POPULARITY CHART ===
let pageChartInstance = null;

function togglePageChart() {
    const body = document.getElementById('pageChartBody');
    const arrow = document.getElementById('pageChartArrow');
    if (!body || !arrow) return;
    const isVisible = body.style.display !== 'none';
    body.style.display = isVisible ? 'none' : 'block';
    arrow.textContent = isVisible ? '▶' : '▼';
    if (!isVisible && !pageChartInstance) renderPageChart();
}

async function renderPageChart() {
    try {
        const data = await api('GET', '/visitors/pages');
        if (!data) return;
        const pageMap = {};
        data.forEach(v => {
            const p = (v.page || 'unknown').trim().toLowerCase();
            pageMap[p] = v.count;
        });
        const sorted = Object.entries(pageMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return;
        const labels = sorted.map(s => s[0]);
        const values = sorted.map(s => s[1]);
        const canvas = document.getElementById('pageChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (pageChartInstance) pageChartInstance.destroy();
        pageChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Views',
                    data: values,
                    backgroundColor: 'rgba(168,85,247,0.6)',
                    borderColor: 'rgba(168,85,247,0.9)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    y: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
                    x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff', font: { size: 11 }, stepSize: 1 } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(20,20,40,0.98)', borderColor: '#a855f7', borderWidth: 2, titleColor: '#a855f7', bodyColor: '#fff', padding: 10 } }
            }
        });
    } catch (e) { console.error('Page chart error:', e); }
}

function clearSession() {
    currentUser = null;
    sessionStorage.removeItem('dmrcUser');
    document.getElementById('loggedInUserHeader').classList.remove('show');
    const loginBtn = document.getElementById('minimalLoginText');
    if (loginBtn) loginBtn.textContent = '👤 LOGIN';
    // Hide admin-only elements on logout
    document.querySelectorAll('.admin-only-upload-row, .admin-only-day').forEach(el => el.style.display = 'none');
}

function handleLogout() {
    clearSession();
    showPage('pageHome');
}

async function downloadVisitorLog() {
    try {
        const data = await api('GET', '/visitors/raw');
        if (!data || data.length === 0) { alert('No visitor data to export'); return; }
        const wsData = [['VISITOR LOG REPORT'], ['Generated: ' + new Date().toLocaleString()], []];
        wsData.push(['Date/Time', 'Page', 'Type', 'Emp ID', 'User Agent']);
        data.forEach(v => {
            wsData.push([v.timestamp ? new Date(v.timestamp) : '', v.page || '', v.type || '', v.emp_id || 'Organic', v.user_agent || '']);
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Visitor Log');
        XLSX.writeFile(wb, 'VisitorLog_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    } catch (e) { alert('Error: ' + e.toString()); }
}

async function clearVisitorLog() {
    if (!confirm('Clear all visitor logs?')) return;
    try { await api('DELETE', '/visitors'); alert('Visitor log cleared!'); loadVisitorStats(); } catch (e) { alert('Error: ' + e.toString()); }
}

async function generateKmReport() {
    await loadKmData();
    const dayType = document.getElementById('kmDay')?.value || 'Weekday';
    const series = Array.from(document.querySelectorAll('input[name="kmSeries"]:checked')).map(cb => cb.value);
    const customDuties = getCustomDuties('customDutiesKm');
    if (series.length === 0 && customDuties.length === 0) return alert('Select series or enter duty numbers!');
    try {
        let data;
        try { data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(dayType)); } catch (e) { alert('Error: ' + e.message); return; }
        if (!data || data.length === 0) { alert('No data found for ' + dayType); return; }

        const dutyTotals = {};
        for (let i = 0; i < data.length; i++) {
            const d = (data[i]["Duty_No"] || '').toString().trim();
            if (!d) continue;
            const isSeriesMatched = series.some(s => {
                if (s === '11-20') {
                    const num = parseInt(d);
                    return num >= 11 && num <= 20;
                }
                const num = parseInt(s);
                if (num >= 10) return d === s || d.startsWith(s + '-') || d.startsWith(s + '0');
                return d.startsWith(s);
            });
            const isCustom = customDuties.length > 0 && customDuties.indexOf(d) !== -1;
            if (!isSeriesMatched && !isCustom) continue;
            if (!dutyTotals[d]) dutyTotals[d] = { km: 0, signOn: '', signOnLoc: '', signOff: '', signOffLoc: '' };
            const r = data[i];
            if (r["Train_No"] && r["Train_No"].toString().trim() !== '') {
                const from = (r["LocationPick"] || '').toString().trim().toUpperCase();
                const to = (r["LocationRelieve"] || '').toString().trim().toUpperCase();
                const _kmVal = kmData[(from + '|' + to).replace(/\s+/g, ' ')]; dutyTotals[d].km += Array.isArray(_kmVal) ? (_kmVal[0] || 0) : (_kmVal || 0);
            }
            if (r["Sign_On"] && (!dutyTotals[d].signOn || r["Sign_On"] < dutyTotals[d].signOn)) {
                dutyTotals[d].signOn = r["Sign_On"];
                dutyTotals[d].signOnLoc = r["SignOn_Location"] || '';
            }
            if (r["Sign_Off"] && (!dutyTotals[d].signOff || r["Sign_Off"] > dutyTotals[d].signOff)) {
                dutyTotals[d].signOff = r["Sign_Off"];
                dutyTotals[d].signOffLoc = r["SignOff_Location"] || '';
            }
        }

        const dutyList = Object.keys(dutyTotals);
        if (dutyList.length === 0) { alert('No duties found for the selected criteria!'); return; }
        let totalKm = 0;
        const tripRows = [];
        dutyList.sort((a, b) => dutyTotals[b].km - dutyTotals[a].km).forEach(d => {
            totalKm += dutyTotals[d].km;
            tripRows.push({ duty: d, ...dutyTotals[d] });
        });
        const avgKm = totalKm / tripRows.length;
        document.getElementById('kmDutyCount').textContent = tripRows.length;
        document.getElementById('kmTotal').textContent = totalKm.toFixed(2) + ' km';
        document.getElementById('kmAvg').textContent = avgKm.toFixed(2) + ' km';
        document.getElementById('kmWrapper').style.display = 'block';

        const tbody = document.getElementById('kmTable');
        tbody.innerHTML = '';
        tripRows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="color:var(--cyan);font-weight:600;">' + r.duty + '</td>' +
                '<td><span class="time-display">' + r.signOn + '</span></td>' +
                '<td>' + r.signOnLoc + '</td>' +
                '<td><span class="time-display">' + r.signOff + '</span></td>' +
                '<td>' + r.signOffLoc + '</td>' +
                '<td><span class="km-tag">' + r.km.toFixed(2) + ' km</span></td>';
            tbody.appendChild(tr);
        });
    } catch (e) { alert('Error: ' + e.toString()); }
}

// MISSING KM AUDIT
async function findMissingKm() {
    await loadKmData();
    try {
        const types = ['Weekday', 'Saturday', 'Sunday', 'Special'];
        const missing = {};
        let totalTrips = 0;
        const allAffectedDuties = new Set();

        for (const type of types) {
            let data;
            try { data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(type)); } catch (e) { continue; }
            if (!data) continue;
            for (const r of data) {
                const rake = (r["Train_No"] || '').toString().trim();
                if (!rake) continue;
                const from = (r["LocationPick"] || '').toString().trim().toUpperCase();
                const to = (r["LocationRelieve"] || '').toString().trim().toUpperCase();
                const key = (from + '|' + to).replace(/\s+/g, ' ');
                const km = kmData[key];
                if (!km || km === 0) {
                    const route = from + ' → ' + to;
                    if (!missing[route]) missing[route] = { count: 0, duties: new Set(), types: new Set() };
                    missing[route].count++;
                    missing[route].duties.add(r["Duty_No"]);
                    missing[route].types.add(type);
                    totalTrips++;
                    allAffectedDuties.add(r["Duty_No"]);
                }
            }
        }

        document.getElementById('missingKmWrapper').style.display = 'block';
        document.getElementById('missingRouteCount').textContent = Object.keys(missing).length;
        document.getElementById('missingTripCount').textContent = totalTrips;
        document.getElementById('missingDutyCount').textContent = allAffectedDuties.size;

        const tbody = document.getElementById('missingKmBody');
        tbody.innerHTML = '';
        if (Object.keys(missing).length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--green);padding:20px;">✅ All routes have KM data assigned!</td></tr>';
            return;
        }

        const sorted = Object.entries(missing).sort((a, b) => b[1].count - a[1].count);
        for (const [route, info] of sorted) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="color:var(--red);font-weight:700;">' + route + '</td>' +
                '<td style="color:var(--orange);font-weight:700;">' + info.count + '</td>' +
                '<td style="color:var(--cyan);">' + [...info.duties].sort((a,b)=>a-b).join(', ') + '</td>' +
                '<td>' + [...info.types].join(', ') + '</td>';
            tbody.appendChild(tr);
        }
    } catch (e) { alert('Error: ' + e.toString()); }
}

// Initialize series grids
function initSeriesGrid() {
    const series = ['1','2','3','4','5','6','7','8','9','10','11-20'];
    const labels = ['100s','200s','300s','400s','500s','600s','700s','800s','900s','10s','11-20'];
    const grid = document.getElementById('seriesGrid');
    if (grid) {
        grid.innerHTML = series.map((s, i) => '<label><input type="checkbox" name="series" value="' + s + '"> ' + labels[i] + '</label>').join('');
    }
    const kmGrid = document.getElementById('kmSeriesGrid');
    if (kmGrid) {
        kmGrid.innerHTML = series.map((s, i) => '<label><input type="checkbox" name="kmSeries" value="' + s + '"> ' + labels[i] + '</label>').join('');
    }
}

function toggleLoginModal() {
    const m = document.getElementById('loginModal');
    if (m.style.display === 'flex') {
        m.style.display = 'none';
    } else {
        m.style.display = 'flex';
        document.getElementById('loginEmpId').value = '';
        document.getElementById('loginPassword').value = '';
        const err = document.getElementById('loginError');
        if (err) err.style.display = 'none';
        setTimeout(() => document.getElementById('loginEmpId').focus(), 100);
    }
}

async function handleLogin() {
    const eid = document.getElementById('loginEmpId').value.trim().toUpperCase();
    const pwd = document.getElementById('loginPassword').value;
    const err = document.getElementById('loginError');
    try {
        const userData = await api('POST', '/auth/login', { emp_id: eid, password: pwd });
        saveSession({ empId: userData.emp_id, name: userData.full_name, accessLevel: userData.access_level });
        toggleLoginModal();
        showPage('pageAdmin');
        loadAdminData();
    } catch(e) {
        err.textContent = 'Error: ' + e.toString();
        err.style.display = 'block';
    }
}

function getCurrentDayType() {
    const d = new Date();
    const day = d.getDay();
    if (day === 0) return 'Sunday';
    if (day === 6) return 'Saturday';
    return 'Weekday';
}

// === KM ANALYSIS ===
async function showKmAnalysis() {
    showPage('pageKmAnalysis');
    await loadKmData();
    const daySelect = document.getElementById('kmAnalysisDay');
    if (daySelect) {
        daySelect.value = getCurrentDayType();
        if (!daySelect.hasAttribute('data-listener')) {
            daySelect.addEventListener('change', function() { generateKmAnalysis(); });
            daySelect.setAttribute('data-listener', '1');
        }
    }
    await generateKmAnalysis();
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function generateKmAnalysis() {
    const dayType = document.getElementById('kmAnalysisDay')?.value || getCurrentDayType();
    document.getElementById('kmAnalysisBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.3);padding:15px;">⏳ Loading ' + dayType + '...</td></tr>';
    document.getElementById('kmAnalysisCount').textContent = dayType + ' — loading...';
    try {
        let data;
        try { data = await api('GET', '/trip-data?day_type=' + encodeURIComponent(dayType)); } catch (e) {
            document.getElementById('kmAnalysisBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red);padding:15px;">API Error: ' + e.message + '</td></tr>';
            document.getElementById('kmAnalysisCount').textContent = dayType + ' — error';
            return;
        }
        if (!data || data.length === 0) {
            document.getElementById('kmAnalysisBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">No data found for ' + dayType + '</td></tr>';
            document.getElementById('kmAnalysisCount').textContent = dayType + ' — 0 trips';
            return;
        }

        // Group by duty, collect KM options per trip
        const dutyMap = {};
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const duty = (row["Duty_No"] || '').toString().trim();
            if (!duty) continue;
            if (!dutyMap[duty]) dutyMap[duty] = { trips: [] };
            const from = (row["LocationPick"] || '').toString().trim().toUpperCase();
            const to = (row["LocationRelieve"] || '').toString().trim().toUpperCase();
            const key = (from + '|' + to).replace(/\s+/g, ' ');
            const kmOpts = kmData[key] || [0];
            dutyMap[duty].trips.push({
                from, to, km_options: kmOpts,
                depTime: row["Trip_Start"], arrTime: row["Trip_End"], rake: row["Train_No"]
            });
        }

        // Compute all possible totals per duty
        function possibleTotals(trips) {
            const valid = trips.map(t => t.km_options).filter(o => o.length > 0);
            if (valid.length === 0) return [0];
            let totals = [0];
            for (const opts of valid) {
                const next = [];
                for (const t of totals) {
                    for (const o of opts) {
                        next.push(t + o);
                    }
                }
                totals = next;
                if (totals.length > 10000) break;
            }
            return [...new Set(totals)].sort((a, b) => a - b);
        }

        function sortRank(a, b) {
            const aMax = Math.max(...possibleTotals(a.trips));
            const bMax = Math.max(...possibleTotals(b.trips));
            return bMax - aMax;
        }

        const sorted = Object.keys(dutyMap).sort((a, b) => sortRank({ trips: dutyMap[a].trips }, { trips: dutyMap[b].trips }));

        document.getElementById('kmAnalysisCount').textContent = dayType + ' — ' + sorted.length + ' duties, ' + data.length + ' trips';

        // Render table with expandable rows
        let html = '';
        sorted.forEach((duty, idx) => {
            const d = dutyMap[duty];
            const rank = idx + 1;
            const tripsCount = d.trips.length;
            d.trips.sort((a, b) => timeToMins(a.depTime) - timeToMins(b.depTime));
            const signOn = d.trips[0];
            const signOff = d.trips[d.trips.length - 1];
            const signOnText = signOn.from + ' @ ' + signOn.depTime;
            const signOffText = signOff.to + ' @ ' + signOff.arrTime;
            const pTotals = possibleTotals(d.trips);
            const totalsStr = pTotals.length > 8 ? pTotals.slice(0, 8).join(', ') + '...' : pTotals.join(', ');
            html += '<tr class="km-row" onclick="toggleKmDetail(\'' + duty + '\')" style="cursor:pointer;">' +
                '<td style="color:rgba(255,255,255,0.4);font-weight:600;">' + rank + '</td>' +
                '<td style="color:var(--cyan);font-weight:700;">' + duty + '</td>' +
                '<td style="font-size:9px;color:var(--orange);">' + signOnText + '</td>' +
                '<td style="font-size:9px;color:var(--orange);">' + signOffText + '</td>' +
                '<td style="color:var(--green);font-weight:700;font-size:10px;">' + totalsStr + '</td>' +
                '<td style="color:rgba(255,255,255,0.5);">' + tripsCount + '</td>' +
                '<td style="font-size:8px;color:rgba(255,255,255,0.3);">▼</td>' +
                '</tr>' +
                '<tr id="kmDetail-' + duty + '" class="km-detail-row" style="display:none;">' +
                '<td colspan="7" style="padding:0;background:rgba(0,0,0,0.2);">' +
                '<div class="km-detail-inner"><table class="data-table" style="font-size:9px;margin:0;">' +
                '<tr><th style="padding:4px 8px;">#</th><th style="padding:4px 8px;">Rake</th><th style="padding:4px 8px;">Time</th><th style="padding:4px 8px;">From</th><th style="padding:4px 8px;">To</th><th style="padding:4px 8px;">KM Options</th></tr>';
            d.trips.forEach((t, ti) => {
                const optsStr = t.km_options.join(' / ');
                html += '<tr><td style="padding:3px 8px;color:rgba(255,255,255,0.4);">' + (ti + 1) + '</td>' +
                    '<td style="padding:3px 8px;color:var(--cyan);">' + (t.rake || '-') + '</td>' +
                    '<td style="padding:3px 8px;">' + t.depTime + ' → ' + t.arrTime + '</td>' +
                    '<td style="padding:3px 8px;color:var(--orange);">' + t.from + '</td>' +
                    '<td style="padding:3px 8px;">' + t.to + '</td>' +
                    '<td style="padding:3px 8px;color:var(--green);font-weight:600;">' + optsStr + '</td></tr>';
            });
            html += '</table></div></td></tr>';
        });

        document.getElementById('kmAnalysisBody').innerHTML = html;
    } catch (e) {
        console.error('KM Analysis Error:', e);
        document.getElementById('kmAnalysisBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red);padding:15px;">Error: ' + e.toString() + '</td></tr>';
    }
}

function toggleKmDetail(duty) {
    const row = document.getElementById('kmDetail-' + duty);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
}

function togglePasswordVisibility(fieldId, btn) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    if (field.type === 'password') {
        field.type = 'text';
        btn.textContent = '👁️‍🗨️';
    } else {
        field.type = 'password';
        btn.textContent = '👁️';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const loginPwd = document.getElementById('loginPassword');
    if (loginPwd) {
        loginPwd.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') handleLogin();
        });
    }
    const regConfirm = document.getElementById('regConfirmPassword');
    if (regConfirm) {
        regConfirm.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') handleRegister();
        });
    }
});

let _adminLibsLoaded = false;
async function loadAdminLibs() {
    if (_adminLibsLoaded) return;
    _adminLibsLoaded = true;
    const scripts = [
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    ];
    for (const src of scripts) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
}

function ensureHtml2canvas() {
    return new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}


