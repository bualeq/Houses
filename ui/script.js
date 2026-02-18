// ============================================================
//   CREATIVE HOUSES — NUI SCRIPT
//   Pure JavaScript — sem frameworks
//   Comunicação via fetch POST para o FiveM
// ============================================================

'use strict';

// ─── Estado global ───────────────────────────────────────────
const state = {
    houses       : [],
    player       : { name: 'Jogador', citizenId: 'N/A' },
    isAdmin      : false,
    currentView  : 'player',      // 'player' | 'admin'
    playerTab    : 'myhouses',    // 'myhouses' | 'available'
    adminTab     : 'houses',      // 'houses' | 'create'
    filter       : 'all',
    selectedHouse: null,          // Casa selecionada para detalhe
    polyPoints   : [              // Pontos poly do form de criação
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
    ],
    editPolyPoints: [],
    deleteTarget  : null,
};

// ─── Comunicação com o FiveM ─────────────────────────────────

function nuiPost(action, data = {}) {
    fetch(`https://${GetParentResourceName()}/${action}`, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify(data),
    }).catch(() => {});
}

// No preview do navegador usa um fallback
function GetParentResourceName() {
    try {
        return window.GetParentResourceName ? window.GetParentResourceName() : 'houses';
    } catch {
        return 'houses';
    }
}

// ─── Utilitários ─────────────────────────────────────────────

function fmt(num) {
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}

function el(id) { return document.getElementById(id); }

// Parseia uma string de coordenada 'X, Y, Z' em números
function parseCoordString(s) {
    if (!s) return { x: 0, y: 0, z: 0 };
    const nums = String(s).match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 3) return { x: 0, y: 0, z: 0 };
    return { x: parseFloat(nums[0]) || 0, y: parseFloat(nums[1]) || 0, z: parseFloat(nums[2]) || 0 };
}

let toastTimer = null;
function showToast(msg, type = 'success') {
    const t = el('toast');
    t.textContent = msg;
    t.className   = `toast ${type}`;
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function openModal(id)  { el(id).classList.remove('hidden'); }
function closeModal(id) { el(id).classList.add('hidden'); }

function closeUI() {
    el('app').classList.add('hidden');
    nuiPost('closeUI');
}

// ─── Mensagens da NUI (do client.lua) ────────────────────────

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !data.action) return;

    switch (data.action) {

        case 'openUI':
            state.houses   = data.houses   || [];
            state.player   = data.player   || { name: 'Jogador', citizenId: 'N/A' };
            state.isAdmin  = data.isAdmin  || false;
            openApp();
            break;

        case 'closeUI':
            el('app').classList.add('hidden');
            break;

        case 'updateHouses':
            state.houses = data.houses || [];
            refreshUI();
            break;

        case 'toast':
            showToast(data.message, data.msgType === 'error' ? 'error' : 'success');
            break;
    }
});

// ─── Abrir App ───────────────────────────────────────────────

function openApp() {
    el('app').classList.remove('hidden');

    // Configurar modo
    state.currentView = state.isAdmin ? 'admin' : 'player';
    applyViewMode();
    refreshUI();
}

function applyViewMode() {
    const isAdmin = state.currentView === 'admin';

    // Header
    el('header').classList.toggle('admin-mode', isAdmin);
    el('headerIcon').textContent = isAdmin ? '🛡️' : '🏠';
    el('modeBadge').textContent  = isAdmin ? 'ADMIN' : 'PLAYER';
    el('modeBadge').className    = `badge ${isAdmin ? 'badge-red' : ''}`;

    // Info bar
    el('infoBar').classList.toggle('admin-mode', isAdmin);
    el('infoAvatar').textContent = isAdmin ? '⚡' : (state.player.name || 'J').charAt(0).toUpperCase();
    el('infoName').textContent   = isAdmin
        ? 'Painel Administrativo'
        : `${state.player.name} · CID: ${state.player.citizenId}`;

    // Tab switcher
    el('btnPlayer').className = `tab-btn${state.currentView === 'player' ? ' active' : ''}`;
    el('btnAdmin').className  = `tab-btn${state.currentView === 'admin'  ? ' active admin-tab' : ''}`;

    // Panels
    el('playerPanel').classList.toggle('hidden', isAdmin);
    el('playerPanel').classList.toggle('active', !isAdmin);
    el('adminPanel').classList.toggle('hidden', !isAdmin);
    el('adminPanel').classList.toggle('active', isAdmin);

    // Inner tabs
    const tabs = ['tabMyHouses', 'tabAvailable'];
    tabs.forEach(id => {
        if (el(id)) el(id).classList.remove('admin-active');
    });
}

// ─── Switch de view (Jogador / Admin) ────────────────────────

function switchView(view) {
    if (view === 'admin' && !state.isAdmin) {
        showToast('Você não tem permissão de administrador.', 'error');
        return;
    }
    state.currentView = view;
    state.selectedHouse = null;
    applyViewMode();
    refreshUI();
}

// ─── Refresh geral ───────────────────────────────────────────

function refreshUI() {
    updateInfoBar();
    updateFooter();

    if (state.currentView === 'player') {
        renderPlayerView();
    } else {
        renderAdminView();
    }
}

function updateInfoBar() {
    const myCasas = state.houses.filter(h =>
        h.members && h.members.some(m => m.citizenId === state.player.citizenId)
    ).length;
    el('infoStats').textContent = `🏠 ${myCasas} casas · ${state.houses.length} total`;
}

function updateFooter() {
    const occ  = state.houses.filter(h => h.status === 'occupied').length;
    const avail= state.houses.filter(h => h.status === 'available').length;
    const lock = state.houses.filter(h => h.isLocked).length;
    el('footerStats').textContent = `🏠 ${occ} ocupadas · ✅ ${avail} disponíveis · 🔒 ${lock} trancadas`;
}

// ════════════════════════════════════════════
//  PLAYER VIEW
// ════════════════════════════════════════════

function playerTab(tab) {
    state.playerTab = tab;

    el('tabMyHouses').classList.toggle('active', tab === 'myhouses');
    el('tabAvailable').classList.toggle('active', tab === 'available');
    el('listMyHouses').classList.toggle('hidden', tab !== 'myhouses');
    el('listAvailable').classList.toggle('hidden', tab !== 'available');
    el('houseDetail').classList.add('hidden');

    renderPlayerView();
}

function renderPlayerView() {
    if (state.selectedHouse) {
        showPlayerDetail(state.selectedHouse);
        return;
    }

    el('houseDetail').classList.add('hidden');
    el('listMyHouses').classList.toggle('hidden', state.playerTab !== 'myhouses');
    el('listAvailable').classList.toggle('hidden', state.playerTab !== 'available');

    if (state.playerTab === 'myhouses') renderMyHouses();
    else renderAvailableHouses();
}

function renderMyHouses() {
    const my = state.houses.filter(h =>
        h.members && h.members.some(m => m.citizenId === state.player.citizenId)
    );

    const empty = el('emptyMyHouses');
    const list  = el('myHousesList');

    if (my.length === 0) {
        empty.classList.remove('hidden');
        list.innerHTML = '';
        return;
    }
    empty.classList.add('hidden');
    list.innerHTML = my.map(h => houseCardPlayer(h)).join('');
}

function renderAvailableHouses() {
    const avail = state.houses.filter(h => h.status === 'available');
    const empty = el('emptyAvailable');
    const list  = el('availableList');

    if (avail.length === 0) {
        empty.classList.remove('hidden');
        list.innerHTML = '';
        return;
    }
    empty.classList.add('hidden');
    list.innerHTML = avail.map(h => houseCardAvailable(h)).join('');
}

function houseCardPlayer(h) {
    const role = h.members.find(m => m.citizenId === state.player.citizenId)?.role;
    const locked = h.isLocked
        ? '<span class="badge badge-danger">🔒 Trancada</span>'
        : '<span class="badge badge-green">🔓 Aberta</span>';

    return `
    <div class="house-card" onclick="openPlayerDetail(${h.id})">
        <div class="card-top">
            <div class="card-icon">🏠</div>
            <div class="card-info">
                <div class="card-name">${h.name} ${role === 'owner' ? '👑' : ''}</div>
                <div class="card-addr">${h.address}</div>
            </div>
            <div class="card-badges">${locked}</div>
        </div>
        <div class="card-footer">
            <span>👥 ${h.members.length} morador${h.members.length !== 1 ? 'es' : ''}</span>
            <span>💳 R$ ${fmt(h.taxValue)}/mês</span>
            <span style="color:var(--red)">📅 ${h.taxDueDate}</span>
        </div>
    </div>`;
}

function houseCardAvailable(h) {
    return `
    <div class="house-card" style="cursor:default">
        <div class="card-top">
            <div class="card-icon green-icon">🏠</div>
            <div class="card-info">
                <div class="card-name">${h.name}</div>
                <div class="card-addr">${h.address}</div>
            </div>
            <span class="badge badge-green">Disponível</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            <div class="detail-card">
                <div class="detail-card-label">💰 Preço</div>
                <div class="detail-card-value val-green">R$ ${fmt(h.price)}</div>
            </div>
            <div class="detail-card">
                <div class="detail-card-label">💳 Taxa Mensal</div>
                <div class="detail-card-value val-amber">R$ ${fmt(h.taxValue)}</div>
            </div>
        </div>
        <div style="margin-top:6px;font-size:11px;color:var(--text-dim);">
            📍 Entrada: X:${h.entryCoord?.x} Y:${h.entryCoord?.y} Z:${h.entryCoord?.z}
        </div>
        <button class="btn btn-green btn-full" style="margin-top:10px;" onclick="openBuyModal(${h.id})">
            🛒 Comprar Casa
        </button>
    </div>`;
}

// ─── Player Detail ───────────────────────────────────────────

function openPlayerDetail(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    state.selectedHouse = h;
    showPlayerDetail(h);
}

function showPlayerDetail(h) {
    // Esconde listas
    el('listMyHouses').classList.add('hidden');
    el('listAvailable').classList.add('hidden');
    el('houseDetail').classList.remove('hidden');

    el('detailName').textContent = h.name;

    if (h.isLocked) {
        el('detailLockBadge').className   = 'badge badge-danger';
        el('detailLockBadge').textContent = '🔒 Trancada';
    } else {
        el('detailLockBadge').className   = 'badge badge-green';
        el('detailLockBadge').textContent = '🔓 Aberta';
    }

    const role = h.members.find(m => m.citizenId === state.player.citizenId)?.role;
    const isOwner = role === 'owner';

    // Grid de info
    el('detailGrid').innerHTML = `
        <div class="detail-card"><div class="detail-card-label">📍 Endereço</div><div class="detail-card-value">${h.address}</div></div>
        <div class="detail-card"><div class="detail-card-label">⭐ Sua Função</div><div class="detail-card-value">${isOwner ? '👑 Proprietário' : '🏠 Morador'}</div></div>
        <div class="detail-card"><div class="detail-card-label">💳 Taxa Mensal</div><div class="detail-card-value val-green">R$ ${fmt(h.taxValue)}</div></div>
        <div class="detail-card"><div class="detail-card-label">📅 Vencimento</div><div class="detail-card-value val-red">${h.taxDueDate}</div></div>
    `;

    // Ações
    let actions = `
        <button class="btn ${h.isLocked ? 'btn-outline-green' : 'btn-outline-red'}" onclick="doToggleLock(${h.id})">
            ${h.isLocked ? '🔓 Destrancar Casa' : '🔒 Trancar Casa'}
        </button>
        <button class="btn btn-outline-amber" onclick="openTaxModal(${h.id})">
            💳 Pagar Taxa — R$ ${fmt(h.taxValue)}
        </button>
    `;
    if (isOwner) {
        actions += `<button class="btn btn-outline-blue" onclick="openAddMemberModal(${h.id})">👤 Adicionar Pessoa</button>`;
    }
    el('detailActions').innerHTML = actions;

    // Moradores
    if (h.members.length === 0) {
        el('detailMembers').innerHTML = '<p style="color:var(--text-dim);font-size:12px;text-align:center;padding:8px;">Nenhum morador</p>';
    } else {
        el('detailMembers').innerHTML = h.members.map(m => {
            const isMe = m.citizenId === state.player.citizenId;
            const canRemove = isOwner && !isMe;
            return `
            <div class="member-row">
                <div class="member-left">
                    <div class="member-avatar ${m.role === 'owner' ? 'owner' : ''}">${m.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="member-name">${m.name}</div>
                        <div class="member-cid">CID: ${m.citizenId}</div>
                    </div>
                </div>
                <div class="member-right">
                    <span class="badge ${m.role === 'owner' ? '' : 'badge-blue'}">${m.role === 'owner' ? '👑 Dono' : '🏠 Morador'}</span>
                    ${canRemove ? `<button class="btn btn-sm btn-outline-red btn-icon" onclick="doRemoveMember(${h.id}, ${m.id})" title="Remover">✕</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // Coords
    el('detailEntryCoord').innerHTML = `
        <div class="coord-cell"><div class="coord-label">X</div><div class="coord-value">${h.entryCoord?.x}</div></div>
        <div class="coord-cell"><div class="coord-label">Y</div><div class="coord-value">${h.entryCoord?.y}</div></div>
        <div class="coord-cell"><div class="coord-label">Z</div><div class="coord-value">${h.entryCoord?.z}</div></div>
        <div class="coord-cell"><div class="coord-label">Heading°</div><div class="coord-value">${h.entryCoord?.heading}</div></div>
    `;
}

function backToList() {
    state.selectedHouse = null;
    el('houseDetail').classList.add('hidden');

    if (state.playerTab === 'myhouses') {
        el('listMyHouses').classList.remove('hidden');
        renderMyHouses();
    } else {
        el('listAvailable').classList.remove('hidden');
        renderAvailableHouses();
    }
}

// ─── Ações do Jogador ────────────────────────────────────────

function doToggleLock(houseId) {
    nuiPost('toggleLock', { houseId });
}

function openTaxModal(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    state.selectedHouse = h;
    el('modalTaxValue').textContent = `R$ ${fmt(h.taxValue)}`;
    el('modalTaxDue').textContent   = `Vencimento: ${h.taxDueDate}`;
    openModal('modalTax');
}

function confirmTax() {
    if (!state.selectedHouse) return;
    nuiPost('payTax', { houseId: state.selectedHouse.id });
    closeModal('modalTax');
}

let addMemberTargetId = null;

function openAddMemberModal(houseId) {
    addMemberTargetId = houseId;
    el('addMemberName').value = '';
    el('addMemberCid').value  = '';
    openModal('modalAddMember');
}

function confirmAddMember() {
    const name = el('addMemberName').value.trim();
    const cid  = el('addMemberCid').value.trim();
    if (!name || !cid) {
        showToast('Preencha nome e Citizen ID!', 'error');
        return;
    }
    nuiPost('addMember', { houseId: addMemberTargetId, memberName: name, memberCitizenId: cid });
    closeModal('modalAddMember');
}

function doRemoveMember(houseId, memberId) {
    nuiPost('removeMember', { houseId, memberId });
}

// ─── Buy Modal ───────────────────────────────────────────────

let buyTargetId = null;

function openBuyModal(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    buyTargetId = houseId;
    el('modalBuyName').textContent  = h.name;
    el('modalBuyPrice').textContent = `R$ ${fmt(h.price)}`;
    el('modalBuyTax').textContent   = `+ R$ ${fmt(h.taxValue)}/mês de taxa`;
    openModal('modalBuy');
}

function confirmBuy() {
    if (!buyTargetId) return;
    nuiPost('buyHouse', { houseId: buyTargetId });
    closeModal('modalBuy');
    buyTargetId = null;
}

// ════════════════════════════════════════════
//  ADMIN VIEW
// ════════════════════════════════════════════

function adminTab(tab) {
    state.adminTab = tab;

    el('tabAdminHouses').classList.toggle('active', tab === 'houses');
    el('tabAdminHouses').classList.toggle('admin-active', tab === 'houses');
    el('tabAdminCreate').classList.toggle('active', tab === 'create');
    el('tabAdminCreate').classList.toggle('admin-active', tab === 'create');

    el('adminHousesPanel').classList.toggle('hidden', tab !== 'houses');
    el('adminCreatePanel').classList.toggle('hidden', tab !== 'create');

    if (tab === 'houses') renderAdminList();
    if (tab === 'create') initCreateForm();
}

function renderAdminView() {
    const tab = state.adminTab;

    el('tabAdminHouses').className = `inner-tab${tab === 'houses' ? ' active admin-active' : ''}`;
    el('tabAdminCreate').className = `inner-tab${tab === 'create' ? ' active admin-active' : ''}`;
    el('adminHousesPanel').classList.toggle('hidden', tab !== 'houses');
    el('adminCreatePanel').classList.toggle('hidden', tab !== 'create');

    updateAdminStats();
    if (tab === 'houses') renderAdminList();
}

function updateAdminStats() {
    el('statTotal').textContent = state.houses.length;
    el('statAvail').textContent = state.houses.filter(h => h.status === 'available').length;
    el('statOccup').textContent = state.houses.filter(h => h.status === 'occupied').length;
}

let currentFilter = 'all';

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAdminList();
}

function renderAdminList() {
    // Se tem detalhe aberto, não renderiza lista
    if (!el('adminDetail').classList.contains('hidden')) return;

    const search = (el('adminSearch')?.value || '').toLowerCase();

    const filtered = state.houses.filter(h => {
        const matchSearch = h.name.toLowerCase().includes(search) || h.address.toLowerCase().includes(search);
        const matchFilter = currentFilter === 'all' || h.status === currentFilter;
        return matchSearch && matchFilter;
    });

    updateAdminStats();

    if (filtered.length === 0) {
        el('adminList').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>Nenhuma casa encontrada</p>
        </div>`;
        return;
    }

    el('adminList').innerHTML = filtered.map(h => adminHouseCard(h)).join('');
}

function adminHouseCard(h) {
    const badge = h.status === 'available'
        ? '<span class="badge badge-green">Disp.</span>'
        : '<span class="badge badge-blue">Ocup.</span>';

    return `
    <div class="house-card admin-card">
        <div class="card-top">
            <div class="card-icon ${h.status === 'available' ? 'green-icon' : ''}">${h.status === 'available' ? '🏠' : '🔑'}</div>
            <div class="card-info">
                <div class="card-name">${h.name} ${h.isLocked ? '🔒' : ''}</div>
                <div class="card-addr">${h.address}</div>
                ${h.ownerName ? `<div class="card-owner">👑 ${h.ownerName}</div>` : ''}
            </div>
            <div class="card-badges">
                ${badge}
                <button class="btn btn-sm btn-outline-red btn-icon" onclick="openAdminDeleteModal(${h.id})" title="Excluir">🗑️</button>
                <button class="btn btn-sm btn-outline-blue btn-icon" onclick="openAdminEditModal(${h.id})" title="Editar">✏️</button>
                <button class="btn btn-sm btn-gray btn-icon" onclick="openAdminDetail(${h.id})" title="Ver detalhes">👁️</button>
            </div>
        </div>
        <div class="card-footer">
            <span>👥 ${h.members?.length || 0}</span>
            <span>💳 R$ ${fmt(h.taxValue)}</span>
            <span>🗺️ ${h.polyzone?.length || 0} pts</span>
        </div>
    </div>`;
}

// ─── Admin Detail ─────────────────────────────────────────────

function openAdminDetail(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    state.selectedHouse = h;
    renderAdminDetail(h);
}

function renderAdminDetail(h) {
    el('adminList').classList.add('hidden');
    el('adminDetail').classList.remove('hidden');

    el('adminDetailName').textContent = h.name;

    el('adminDetailGrid').innerHTML = `
        <div class="detail-card"><div class="detail-card-label">📍 Endereço</div><div class="detail-card-value">${h.address}</div></div>
        <div class="detail-card"><div class="detail-card-label">💰 Preço</div><div class="detail-card-value val-green">R$ ${fmt(h.price)}</div></div>
        <div class="detail-card"><div class="detail-card-label">💳 Taxa</div><div class="detail-card-value val-amber">R$ ${fmt(h.taxValue)}</div></div>
        <div class="detail-card"><div class="detail-card-label">📅 Vencimento</div><div class="detail-card-value val-red">${h.taxDueDate}</div></div>
        ${h.ownerName ? `<div class="detail-card" style="grid-column:span 2"><div class="detail-card-label">👑 Proprietário</div><div class="detail-card-value">${h.ownerName} · CID: ${h.ownerCitizenId}</div></div>` : ''}
    `;

    // Proprietário ou aviso de sem dono
    if (h.ownerName) {
        el('adminDetailOwner').innerHTML = `
        <div class="owner-box">
            <div class="detail-card-label">👑 Proprietário</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <div class="member-avatar owner">${h.ownerName.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="member-name">${h.ownerName}</div>
                    <div class="member-cid">CID: ${h.ownerCitizenId}</div>
                </div>
            </div>
        </div>`;
    } else {
        el('adminDetailOwner').innerHTML = `
        <div class="no-owner-box">
            <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:#fca5a5;margin-bottom:2px;">⚠️ Sem Proprietário</div>
                <div style="font-size:11px;color:var(--text-dim);">Esta casa não tem dono definido</div>
            </div>
            <button class="btn btn-sm btn-outline-amber" onclick="openAdminAddMemberModal(${h.id}, 'owner')">👑 Definir</button>
        </div>`;
    }

    el('adminDetailActions').innerHTML = `
        <button class="btn ${h.isLocked ? 'btn-outline-green' : 'btn-outline-red'}" onclick="doAdminToggleLock(${h.id})">
            ${h.isLocked ? '🔓 Destrancar Casa' : '🔒 Trancar Casa'}
        </button>
        <button class="btn btn-outline-blue" onclick="openAdminAddMemberModal(${h.id}, 'tenant')">👤 Adicionar Morador</button>
        <button class="btn btn-outline-amber" onclick="openAdminAddMemberModal(${h.id}, 'owner')">👑 Definir Dono</button>
    `;

    if (!h.members || h.members.length === 0) {
        el('adminDetailMembers').innerHTML = `
        <div style="text-align:center;padding:12px 0;">
            <p style="color:var(--text-dim);font-size:12px;margin-bottom:8px;">Nenhum morador cadastrado</p>
            <button class="btn btn-sm btn-outline-amber" onclick="openAdminAddMemberModal(${h.id}, 'owner')">👑 Definir Dono</button>
        </div>`;
    } else {
        el('adminDetailMembers').innerHTML = h.members.map(m => `
        <div class="member-row ${m.role === 'owner' ? 'member-owner' : ''}">
            <div class="member-left">
                <div class="member-avatar ${m.role === 'owner' ? 'owner' : ''}">${m.name.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="member-name">${m.name}</div>
                    <div class="member-cid">CID: ${m.citizenId} · ${m.addedAt}</div>
                </div>
            </div>
            <div class="member-right">
                <span class="badge ${m.role === 'owner' ? '' : 'badge-blue'}">${m.role === 'owner' ? '👑 Dono' : '🏠 Morador'}</span>
                ${m.role !== 'owner' ? `<button class="btn btn-sm btn-outline-amber btn-icon" onclick="doAdminSetOwner(${h.id}, ${m.id})" title="Promover a Dono">👑</button>` : ''}
                <button class="btn btn-sm btn-outline-red btn-icon" onclick="doAdminRemoveMember(${h.id}, ${m.id})" title="Remover">✕</button>
            </div>
        </div>`).join('');
    }

    // PolyZone
    if (!h.polyzone || h.polyzone.length === 0) {
        el('adminDetailPolyzone').innerHTML = '<p style="color:var(--text-dim);font-size:12px;">Nenhum ponto cadastrado</p>';
    } else {
        el('adminDetailPolyzone').innerHTML = h.polyzone.map((pt, i) => `
        <div class="poly-view-row">
            <span class="poly-num">${i + 1}</span>
            <div class="poly-coords">
                <span class="poly-coord">X: ${pt.x}</span>
                <span class="poly-coord">Y: ${pt.y}</span>
                <span class="poly-coord">Z: ${pt.z}</span>
            </div>
        </div>`).join('');
    }

    el('adminDetailEntry').innerHTML = `
        <div class="coord-cell"><div class="coord-label">X</div><div class="coord-value">${h.entryCoord?.x}</div></div>
        <div class="coord-cell"><div class="coord-label">Y</div><div class="coord-value">${h.entryCoord?.y}</div></div>
        <div class="coord-cell"><div class="coord-label">Z</div><div class="coord-value">${h.entryCoord?.z}</div></div>
        <div class="coord-cell"><div class="coord-label">H°</div><div class="coord-value">${h.entryCoord?.heading}</div></div>
    `;
}

function backAdminList() {
    state.selectedHouse = null;
    el('adminDetail').classList.add('hidden');
    el('adminList').classList.remove('hidden');
    renderAdminList();
}

// ─── Admin Ações ─────────────────────────────────────────────

function doAdminToggleLock(houseId) {
    nuiPost('adminToggleLock', { houseId });
}

let adminAddMemberTarget = null;
let adminAddMemberRole   = 'tenant';

function openAdminAddMemberModal(houseId, role) {
    adminAddMemberTarget = houseId;
    adminAddMemberRole   = role || 'tenant';
    el('adminAddName').value = '';
    el('adminAddCid').value  = '';
    
    // Atualiza título do modal
    el('adminAddModalTitle').textContent = adminAddMemberRole === 'owner' 
        ? '👑 Definir Dono (Admin)' 
        : '👤 Adicionar Pessoa (Admin)';
    
    // Atualiza seletor de role
    updateRoleSelector();
    
    // Atualiza aviso
    updateRoleWarning();
    
    openModal('modalAdminAddMember');
}

function selectAdminRole(role) {
    adminAddMemberRole = role;
    updateRoleSelector();
    updateRoleWarning();
}

function updateRoleSelector() {
    const btnTenant = el('adminRoleTenant');
    const btnOwner  = el('adminRoleOwner');
    
    if (btnTenant) {
        btnTenant.className = adminAddMemberRole === 'tenant' 
            ? 'role-btn role-btn-active-blue' 
            : 'role-btn';
    }
    if (btnOwner) {
        btnOwner.className = adminAddMemberRole === 'owner' 
            ? 'role-btn role-btn-active-amber' 
            : 'role-btn';
    }
}

function updateRoleWarning() {
    const box = el('adminRoleWarning');
    if (!box) return;
    
    const h = state.houses.find(x => x.id === adminAddMemberTarget);
    
    if (adminAddMemberRole === 'owner') {
        if (h && h.members && h.members.some(m => m.role === 'owner')) {
            const currentOwner = h.members.find(m => m.role === 'owner');
            box.innerHTML = `<div class="warning-amber">⚠️ Esta casa já tem um dono (<strong>${currentOwner.name}</strong>). Ao definir um novo dono, o atual será rebaixado para morador.</div>`;
        } else {
            box.innerHTML = '<div class="warning-green">✅ Esta casa não tem dono. O jogador será definido como proprietário.</div>';
        }
    } else {
        box.innerHTML = '<div class="warning-blue">ℹ️ O morador terá acesso à PolyZone mas não poderá gerenciar a casa.</div>';
    }
}

function confirmAdminAddMember() {
    const name = el('adminAddName').value.trim();
    const cid  = el('adminAddCid').value.trim();
    if (!name || !cid) {
        showToast('Preencha nome e Citizen ID!', 'error');
        return;
    }
    nuiPost('adminAddMember', { 
        houseId: adminAddMemberTarget, 
        memberName: name, 
        memberCitizenId: cid,
        memberRole: adminAddMemberRole 
    });
    closeModal('modalAdminAddMember');
}

function doAdminSetOwner(houseId, memberId) {
    nuiPost('adminSetOwner', { houseId, memberId });
}

function doAdminRemoveMember(houseId, memberId) {
    nuiPost('adminRemoveMember', { houseId, memberId });
}

// ─── Admin Edit ───────────────────────────────────────────────

let editTargetId = null;

function openEditModal() {
    if (state.selectedHouse) openAdminEditModal(state.selectedHouse.id);
}

function openAdminEditModal(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    editTargetId = houseId;
    state.editPolyPoints = JSON.parse(JSON.stringify(h.polyzone || []));

    el('eName').value    = h.name;
    el('eAddress').value = h.address;
    el('ePrice').value   = h.price;
    el('eTax').value     = h.taxValue;
    el('eDueDate').value = h.taxDueDate;
    el('eEntryCoord').value = `${h.entryCoord?.x || 0}, ${h.entryCoord?.y || 0}, ${h.entryCoord?.z || 0}`;
    el('eEntryH').value     = h.entryCoord?.heading || 0;

    renderEditPolyPoints();
    openModal('modalEdit');
}

function renderEditPolyPoints() {
    el('polyPointsEdit').innerHTML = state.editPolyPoints.map((pt, i) => `
    <div class="poly-row">
        <span class="poly-num">${i + 1}</span>
        <input type="number" step="0.01" value="${pt.x}" placeholder="X" oninput="updateEditPoly(${i},'x',this.value)" />
        <input type="number" step="0.01" value="${pt.y}" placeholder="Y" oninput="updateEditPoly(${i},'y',this.value)" />
        <input type="number" step="0.01" value="${pt.z}" placeholder="Z" oninput="updateEditPoly(${i},'z',this.value)" />
    </div>`).join('');
}

function updateEditPoly(index, axis, value) {
    if (!state.editPolyPoints[index]) return;
    state.editPolyPoints[index][axis] = parseFloat(value) || 0;
}

function confirmEdit() {
    if (!editTargetId) return;
    const coord = parseCoordString(el('eEntryCoord').value);
    const data = {
        houseId   : editTargetId,
        name      : el('eName').value.trim(),
        address   : el('eAddress').value.trim(),
        price     : parseFloat(el('ePrice').value) || 0,
        taxValue  : parseFloat(el('eTax').value) || 0,
        taxDueDate: el('eDueDate').value,
        entryCoord: {
            x       : coord.x,
            y       : coord.y,
            z       : coord.z,
            heading : parseFloat(el('eEntryH').value) || 0,
        },
        polyzone: state.editPolyPoints,
    };
    if (!data.name || !data.address) {
        showToast('Preencha nome e endereço!', 'error');
        return;
    }
    nuiPost('adminEditHouse', data);
    closeModal('modalEdit');
}

// ─── Admin Delete ─────────────────────────────────────────────

let deleteTargetId = null;

function openDeleteModal() {
    if (state.selectedHouse) openAdminDeleteModal(state.selectedHouse.id);
}

function openAdminDeleteModal(houseId) {
    const h = state.houses.find(x => x.id === houseId);
    if (!h) return;
    deleteTargetId = houseId;
    el('deleteTargetName').textContent = h.name;
    openModal('modalDelete');
}

function confirmDelete() {
    if (!deleteTargetId) return;
    nuiPost('adminDeleteHouse', { houseId: deleteTargetId });
    closeModal('modalDelete');

    // Volta para lista se estava no detalhe
    if (state.selectedHouse?.id === deleteTargetId) {
        backAdminList();
    }
    deleteTargetId = null;
}

// ─── Criar Casa (Admin) ───────────────────────────────────────

function initCreateForm() {
    state.polyPoints = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
    ];
    renderCreatePolyPoints();

    // Limpa campos
    ['fName','fAddress','fPrice','fTax','fDueDate','fEntryCoord','fEntryH']
        .forEach(id => { el(id).value = ''; });
}

function renderCreatePolyPoints() {
    el('polyPointsCreate').innerHTML = state.polyPoints.map((pt, i) => `
    <div class="poly-row">
        <span class="poly-num">${i + 1}</span>
        <input type="number" step="0.01" value="${pt.x}" placeholder="X" oninput="updateCreatePoly(${i},'x',this.value)" />
        <input type="number" step="0.01" value="${pt.y}" placeholder="Y" oninput="updateCreatePoly(${i},'y',this.value)" />
        <input type="number" step="0.01" value="${pt.z}" placeholder="Z" oninput="updateCreatePoly(${i},'z',this.value)" />
    </div>`).join('');
}

function updateCreatePoly(index, axis, value) {
    if (!state.polyPoints[index]) return;
    state.polyPoints[index][axis] = parseFloat(value) || 0;
}

function addPolyPoint() {
    state.polyPoints.push({ x: 0, y: 0, z: 0 });
    renderCreatePolyPoints();
}

function removePolyPoint() {
    if (state.polyPoints.length <= 3) {
        showToast('Mínimo 3 pontos!', 'error');
        return;
    }
    state.polyPoints.pop();
    renderCreatePolyPoints();
}

function createHouse() {
    const name     = el('fName').value.trim();
    const address  = el('fAddress').value.trim();
    const price    = parseFloat(el('fPrice').value) || 0;
    const taxValue = parseFloat(el('fTax').value) || 0;
    const dueDate  = el('fDueDate').value;
    const coord = parseCoordString(el('fEntryCoord').value);
    const entryX   = coord.x;
    const entryY   = coord.y;
    const entryZ   = coord.z;
    const entryH   = parseFloat(el('fEntryH').value) || 0;

    if (!name || !address || !price || !taxValue) {
        showToast('Preencha todos os campos obrigatórios (*)', 'error');
        return;
    }

    const data = {
        name,
        address,
        price,
        taxValue,
        taxDueDate : dueDate || '',
        entryCoord : { x: entryX, y: entryY, z: entryZ, heading: entryH },
        polyzone   : state.polyPoints,
    };

    nuiPost('adminCreateHouse', data);
    showToast('Enviando... aguarde confirmação do servidor.', 'info');

    // Volta para aba de gerenciamento
    setTimeout(() => adminTab('houses'), 800);
}

// ─── ESC fecha a UI ───────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUI();
});

// ─── Preview / Desenvolvimento ─────────────────────────────────
// Simula abertura da NUI no navegador para desenvolvimento

if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1') || !window.GetParentResourceName) {
    window.addEventListener('load', () => {
        // Dados mock para desenvolvimento
        window.dispatchEvent(new MessageEvent('message', {
            data: {
                action : 'openUI',
                isAdmin: false,
                player : { name: 'João Silva', citizenId: 'ABC123' },
                houses : [
                    {
                        id: 1, name: 'Casa Sunrise', address: 'Rua Vinewood Hills, 112',
                        price: 350000, taxValue: 5000, taxDueDate: '2025-12-31',
                        status: 'occupied', isLocked: true,
                        entryCoord: { x: 1239.5, y: -2350.6, z: 45.2, heading: 180.0 },
                        polyzone: [
                            { x: 1234.5, y: -2345.6, z: 45.2 }, { x: 1244.5, y: -2345.6, z: 45.2 },
                            { x: 1244.5, y: -2355.6, z: 45.2 }, { x: 1234.5, y: -2355.6, z: 45.2 },
                        ],
                        members: [
                            { id: 1, name: 'João Silva',   citizenId: 'ABC123', role: 'owner',  addedAt: '2024-12-01' },
                            { id: 2, name: 'Maria Santos', citizenId: 'DEF456', role: 'tenant', addedAt: '2024-12-10' },
                        ],
                        ownerId: 1, ownerName: 'João Silva', ownerCitizenId: 'ABC123', createdAt: '2024-11-20',
                    },
                    {
                        id: 2, name: 'Villa Rockford', address: 'Rockford Hills Ave, 78',
                        price: 850000, taxValue: 12000, taxDueDate: '2025-12-31',
                        status: 'available', isLocked: false,
                        entryCoord: { x: 455.1, y: -1008.3, z: 30.5, heading: 270.0 },
                        polyzone: [
                            { x: 445.1, y: -998.3, z: 30.5 }, { x: 465.1, y: -998.3, z: 30.5 },
                            { x: 465.1, y: -1018.3, z: 30.5 }, { x: 445.1, y: -1018.3, z: 30.5 },
                        ],
                        members: [], ownerId: null, ownerName: null, ownerCitizenId: null, createdAt: '2024-10-15',
                    },
                    {
                        id: 3, name: 'Chalé Del Perro', address: 'Del Perro Beach, 34',
                        price: 220000, taxValue: 3500, taxDueDate: '2025-06-01',
                        status: 'occupied', isLocked: false,
                        entryCoord: { x: -1246.4, y: -1519.8, z: 3.3, heading: 90.0 },
                        polyzone: [
                            { x: -1256.4, y: -1509.8, z: 3.3 }, { x: -1236.4, y: -1509.8, z: 3.3 },
                            { x: -1236.4, y: -1529.8, z: 3.3 }, { x: -1256.4, y: -1529.8, z: 3.3 },
                        ],
                        members: [
                            { id: 3, name: 'Carlos Oliveira', citizenId: 'GHI789', role: 'owner', addedAt: '2024-09-15' },
                        ],
                        ownerId: 3, ownerName: 'Carlos Oliveira', ownerCitizenId: 'GHI789', createdAt: '2024-09-01',
                    },
                ],
            }
        }));
    });
}
