-----------------------------------------------------------------------------------------------------------------------------------------
-- VRP
-----------------------------------------------------------------------------------------------------------------------------------------
local Tunnel = module("vrp","lib/Tunnel")
local Proxy = module("vrp","lib/Proxy")
vRP = Proxy.getInterface("vRP")
vRPC = Tunnel.getInterface("vRP")
-----------------------------------------------------------------------------------------------------------------------------------------
-- CONNECTION
-----------------------------------------------------------------------------------------------------------------------------------------
cnVRP = {}
Tunnel.bindInterface("houses",cnVRP)
vCLIENT = Tunnel.getInterface("houses")
-----------------------------------------------------------------------------------------------------------------------------------------

local activeHouses = {}

function cnVRP.Permission(Permission)
    local source = source
    local Passport = vRP.Passport(source)
    if Passport then
        return vRP.HasPermission(Passport, Permission)
    end
    return false
end

-- ============================================================
-- UTILITÁRIOS
-- ============================================================

local function Log(msg)
    if Config.Debug then
        print(Config.Prefix .. ' [SERVER] ' .. tostring(msg))
    end
end

function cnVRP.GetPlayer()
    local source = source
    local Passport = vRP.Passport(source)
    if not Passport then return nil end
    return Passport
end

function cnVRP.FullName()
    local source = source
    local Passport = vRP.Passport(source)
    if not Passport then return 'Desconecido' end
    local Fullname = vRP.FullName(Passport)
    return Fullname or 'Desconecido'
end

function GetBankBalance()
    local source = source
    local Passport = vRP.Passport(source)
    if Passport then
        local Bank = vRP.Identity(Passport)["bank"] or 0
        return Bank
    end
    return 0
end

--- Remove dinheiro do banco
---@param source number
---@param amount number
---@param reason string
---@return boolean
local function RemoveBankMoney(source, amount, reason)
    local Passport = vRP.Passport(source)
    if Passport then
        return vRP.RemoveBank(Passport, amount, reason)
    end
    return false
end

--- Envia notificação para o jogador
---@param source number
---@param tipo string 'success'|'error'|'info'
---@param msg string
local function NotifyPlayer(source, tipo, msg)
    TriggerClientEvent('Notify', source, "Houses", msg, tipo, 7000)
end

--- Envia atualização das casas para todos os jogadores
local function BroadcastReload()
    TriggerClientEvent('creative_houses:reloadHouses', -1)
end

-- ============================================================
-- CALLBACK SYSTEM (sem ox_lib)
-- O client envia um requestId, o server responde com o mesmo ID
-- ============================================================

RegisterNetEvent('creative_houses:cb_getAllHouses', function(requestId)
    local src  = source
    local list = {}
    for _, h in pairs(activeHouses) do
        table.insert(list, h)
    end
    TriggerClientEvent('creative_houses:cb_response', src, requestId, list)
end)

RegisterNetEvent('creative_houses:cb_checkAccess', function(requestId, houseId)
    local src       = source
    local identifier = vRP.Passport(src)
    local house     = activeHouses[houseId]

    if not house or not identifier then
        TriggerClientEvent('creative_houses:cb_response', src, requestId, false, nil)
        return
    end

    -- Verifica se o jogador está cadastrado na casa
    for _, m in ipairs(house.members) do
        if m.citizenId == identifier then
            TriggerClientEvent('creative_houses:cb_response', src, requestId, true, house)
            return
        end
    end

    -- Sem acesso: retorna entryCoord para o client teleportar
    TriggerClientEvent('creative_houses:cb_response', src, requestId, false, house.entryCoord)
end)

-- ============================================================
-- BANCO DE DADOS — INICIALIZAÇÃO
-- ============================================================

local function InitDatabase()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `creative_houses` (
            `id`               INT           NOT NULL AUTO_INCREMENT,
            `name`             VARCHAR(100)  NOT NULL,
            `address`          VARCHAR(200)  NOT NULL,
            `price`            FLOAT         NOT NULL DEFAULT 0,
            `tax_value`        FLOAT         NOT NULL DEFAULT 0,
            `tax_due_date`     VARCHAR(20)   NOT NULL DEFAULT '',
            `status`           VARCHAR(20)   NOT NULL DEFAULT 'available',
            `is_locked`        TINYINT(1)    NOT NULL DEFAULT 0,
            `entry_coord`      LONGTEXT      NOT NULL,
            `polyzone`         LONGTEXT      NOT NULL,
            `members`          LONGTEXT      NOT NULL DEFAULT '[]',
            `owner_id`         INT                    DEFAULT NULL,
            `owner_name`       VARCHAR(100)           DEFAULT NULL,
            `owner_citizen_id` VARCHAR(50)            DEFAULT NULL,
            `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    Log('Tabela verificada/criada com sucesso.')
end

-- ============================================================
-- BANCO DE DADOS — CARREGAR CASAS
-- ============================================================

local function LoadAllHouses(cb)
    MySQL.query('SELECT * FROM creative_houses', {}, function(rows)
        activeHouses = {}
        if rows then
            for _, row in ipairs(rows) do
                local house = {
                    id             = row.id,
                    name           = row.name,
                    address        = row.address,
                    price          = row.price,
                    taxValue       = row.tax_value,
                    taxDueDate     = row.tax_due_date,
                    status         = row.status,
                    isLocked       = row.is_locked == 1,
                    entryCoord     = json.decode(row.entry_coord) or {},
                    polyzone       = json.decode(row.polyzone)    or {},
                    members        = json.decode(row.members)     or {},
                    ownerId        = row.owner_id,
                    ownerName      = row.owner_name,
                    ownerCitizenId = row.owner_citizen_id,
                    createdAt      = tostring(row.created_at),
                }
                activeHouses[house.id] = house
            end
        end
        local count = 0
        for _ in pairs(activeHouses) do count = count + 1 end
        Log('Casas carregadas: ' .. count)
        if cb then cb() end
    end)
end

-- ============================================================
-- BANCO DE DADOS — SALVAR CASA
-- ============================================================

local function SaveHouse(house, cb)
    MySQL.update([[
        UPDATE creative_houses
        SET name=?, address=?, price=?, tax_value=?, tax_due_date=?,
            status=?, is_locked=?, entry_coord=?, polyzone=?,
            members=?, owner_id=?, owner_name=?, owner_citizen_id=?
        WHERE id=?
    ]], {
        house.name,
        house.address,
        house.price,
        house.taxValue,
        house.taxDueDate,
        house.status,
        house.isLocked and 1 or 0,
        json.encode(house.entryCoord),
        json.encode(house.polyzone),
        json.encode(house.members),
        house.ownerId,
        house.ownerName,
        house.ownerCitizenId,
        house.id,
    }, function(affected)
        activeHouses[house.id] = house
        Log('Casa salva: ID ' .. house.id .. ' (affected: ' .. tostring(affected) .. ')')
        if cb then cb() end
    end)
end

-- ============================================================
-- BANCO DE DADOS — INSERIR NOVA CASA
-- ============================================================

local function InsertHouse(data, cb)
    MySQL.insert([[
        INSERT INTO creative_houses
            (name, address, price, tax_value, tax_due_date,
             status, is_locked, entry_coord, polyzone, members,
             owner_id, owner_name, owner_citizen_id)
        VALUES (?, ?, ?, ?, ?, 'available', 0, ?, ?, '[]', NULL, NULL, NULL)
    ]], {
        data.name,
        data.address,
        data.price,
        data.taxValue,
        data.taxDueDate or '',
        json.encode(data.entryCoord),
        json.encode(data.polyzone),
    }, function(insertId)
        if not insertId then
            Log('ERRO ao inserir casa!')
            if cb then cb(nil) end
            return
        end
        local house = {
            id             = insertId,
            name           = data.name,
            address        = data.address,
            price          = data.price,
            taxValue       = data.taxValue,
            taxDueDate     = data.taxDueDate or '',
            status         = 'available',
            isLocked       = false,
            entryCoord     = data.entryCoord,
            polyzone       = data.polyzone,
            members        = {},
            ownerId        = nil,
            ownerName      = nil,
            ownerCitizenId = nil,
            createdAt      = os.date('%Y-%m-%d'),
        }
        activeHouses[insertId] = house
        Log('Casa criada com ID: ' .. insertId)
        if cb then cb(house) end
    end)
end

-- ============================================================
-- BANCO DE DADOS — DELETAR CASA
-- ============================================================

local function DeleteHouse(houseId, cb)
    MySQL.query('DELETE FROM creative_houses WHERE id = ?', { houseId }, function()
        activeHouses[houseId] = nil
        Log('Casa deletada: ' .. tostring(houseId))
        if cb then cb() end
    end)
end

-- ============================================================
-- RESOURCE START
-- ============================================================

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    InitDatabase()
    Wait(1000)
    LoadAllHouses(function()
        Log('Resource iniciado com sucesso!')
    end)
end)

-- ============================================================
-- EVENTOS — ADMIN
-- ============================================================

-- Criar casa
RegisterNetEvent('creative_houses:adminCreateHouse')
AddEventHandler('creative_houses:adminCreateHouse', function(data)
    local src = source
    if not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão de administrador.')
        return
    end
    if not data or not data.name or not data.entryCoord or not data.polyzone then
        NotifyPlayer(src, 'error', 'Dados inválidos para criação da casa.')
        return
    end
    InsertHouse(data, function(newHouse)
        if not newHouse then
            NotifyPlayer(src, 'error', 'Erro ao criar casa no banco de dados.')
            return
        end
        NotifyPlayer(src, 'success', 'Casa "' .. newHouse.name .. '" criada com sucesso!')
        BroadcastReload()
    end)
end)

-- Editar casa
RegisterNetEvent('creative_houses:adminEditHouse')
AddEventHandler('creative_houses:adminEditHouse', function(houseId, data)
    local src = source
    if not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão de administrador.')
        return
    end
    local house = activeHouses[houseId]
    if not house then
        NotifyPlayer(src, 'error', 'Casa não encontrada.')
        return
    end

    if data.name       then house.name       = data.name       end
    if data.address    then house.address    = data.address    end
    if data.price      then house.price      = data.price      end
    if data.taxValue   then house.taxValue   = data.taxValue   end
    if data.taxDueDate then house.taxDueDate = data.taxDueDate end
    if data.entryCoord then house.entryCoord = data.entryCoord end
    if data.polyzone   then house.polyzone   = data.polyzone   end

    SaveHouse(house, function()
        NotifyPlayer(src, 'success', 'Casa "' .. house.name .. '" editada!')
        BroadcastReload()
    end)
end)

-- Deletar casa
RegisterNetEvent('creative_houses:adminDeleteHouse')
AddEventHandler('creative_houses:adminDeleteHouse', function(houseId)
    local src = source
    if not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão de administrador.')
        return
    end
    local house = activeHouses[houseId]
    if not house then
        NotifyPlayer(src, 'error', 'Casa não encontrada.')
        return
    end
    local houseName = house.name
    DeleteHouse(houseId, function()
        NotifyPlayer(src, 'success', 'Casa "' .. houseName .. '" excluída!')
        BroadcastReload()
    end)
end)

-- Admin: trancar/destrancar
RegisterNetEvent('creative_houses:adminToggleLock')
AddEventHandler('creative_houses:adminToggleLock', function(houseId)
    local src = source
    if not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão.')
        return
    end
    local house = activeHouses[houseId]
    if not house then return end

    house.isLocked = not house.isLocked
    SaveHouse(house, function()
        local msg = house.isLocked and 'Casa trancada pelo admin!' or 'Casa destrancada pelo admin!'
        NotifyPlayer(src, 'success', msg)
        BroadcastReload()
    end)
end)

-- Admin: definir dono (promover morador existente)
RegisterNetEvent('creative_houses:adminSetOwner')
AddEventHandler('creative_houses:adminSetOwner', function(houseId, memberId)
    local src = source
    if not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão de administrador.')
        return
    end
    local house = activeHouses[houseId]
    if not house then
        NotifyPlayer(src, 'error', 'Casa não encontrada.')
        return
    end

    local targetMember = nil
    for i, m in ipairs(house.members) do
        if m.id == memberId then
            targetMember = m
            house.members[i].role = 'owner'
        else
            house.members[i].role = 'tenant'
        end
    end

    if not targetMember then
        NotifyPlayer(src, 'error', 'Membro não encontrado.')
        return
    end

    house.status         = 'occupied'
    house.ownerId        = targetMember.id
    house.ownerName      = targetMember.name
    house.ownerCitizenId = targetMember.citizenId

    SaveHouse(house, function()
        NotifyPlayer(src, 'success', targetMember.name .. ' agora é o dono da casa!')
        BroadcastReload()
    end)
end)

-- ============================================================
-- EVENTOS — JOGADOR
-- ============================================================

-- Comprar casa
RegisterNetEvent('creative_houses:buyHouse')
AddEventHandler('creative_houses:buyHouse', function(houseId)
    local src        = source
    local house      = activeHouses[houseId]
    local identifier = vRP.Passport(src)
    local charName   = vRP.FullName(identifier)

    if not house then
        NotifyPlayer(src, 'error', 'Casa não encontrada.')
        return
    end
    if house.status ~= 'available' then
        NotifyPlayer(src, 'error', 'Esta casa já está ocupada.')
        return
    end
    if GetBankBalance(src) < house.price then
        NotifyPlayer(src, 'error', 'Saldo bancário insuficiente.')
        return
    end

    RemoveBankMoney(src, house.price, 'compra_casa_' .. houseId)

    local newMember = {
        id        = GetGameTimer() + math.random(1, 99999),
        name      = charName,
        citizenId = identifier,
        role      = 'owner',
        addedAt   = os.date('%Y-%m-%d'),
    }

    house.status         = 'occupied'
    house.ownerId        = newMember.id
    house.ownerName      = charName
    house.ownerCitizenId = identifier
    house.members        = { newMember }

    SaveHouse(house, function()
        NotifyPlayer(src, 'success', 'Você comprou a casa "' .. house.name .. '"!')
        BroadcastReload()
    end)
end)

-- Trancar / Destrancar
RegisterNetEvent('creative_houses:toggleLock')
AddEventHandler('creative_houses:toggleLock', function(houseId)
    local src        = source
    local house      = activeHouses[houseId]
    local identifier = vRP.Passport(src)

    if not house then return end

    -- Verificar se é membro
    local isMember = false
    for _, m in ipairs(house.members) do
        if m.citizenId == identifier then
            isMember = true
            break
        end
    end

    if not isMember and not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Você não é morador desta casa.')
        return
    end

    house.isLocked = not house.isLocked
    SaveHouse(house, function()
        local msg = house.isLocked and 'Casa trancada com sucesso!' or 'Casa destrancada com sucesso!'
        NotifyPlayer(src, 'success', msg)
        BroadcastReload()
    end)
end)

-- Pagar taxa
RegisterNetEvent('creative_houses:payTax')
AddEventHandler('creative_houses:payTax', function(houseId)
    local src        = source
    local house      = activeHouses[houseId]
    local identifier = vRP.Passport(src)

    if not house then return end

    local isMember = false
    for _, m in ipairs(house.members) do
        if m.citizenId == identifier then
            isMember = true
            break
        end
    end

    if not isMember and not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Você não é morador desta casa.')
        return
    end

    if GetBankBalance(src) < house.taxValue then
        NotifyPlayer(src, 'error', 'Saldo insuficiente para pagar a taxa.')
        return
    end

    RemoveBankMoney(src, house.taxValue, 'taxa_casa_' .. houseId)

    -- Renova por +30 dias
    local nextDate = os.date('%Y-%m-%d', os.time() + 30 * 24 * 60 * 60)
    house.taxDueDate = nextDate

    SaveHouse(house, function()
        NotifyPlayer(src, 'success', 'Taxa paga! Próximo vencimento: ' .. nextDate)
        BroadcastReload()
    end)
end)

-- Adicionar morador (com suporte a role: 'owner' ou 'tenant')
RegisterNetEvent('creative_houses:addMember')
AddEventHandler('creative_houses:addMember', function(houseId, memberName, memberCitizenId, memberRole)
    local src        = source
    local house      = activeHouses[houseId]
    local identifier = vRP.Passport(src)

    if not house then return end

    local role = memberRole or 'tenant'

    -- Se está definindo como dono, precisa ser admin
    if role == 'owner' and not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Apenas admins podem definir o dono.')
        return
    end

    -- Verificar permissão: é dono ou admin?
    local isOwner = house.ownerCitizenId == identifier
    if not isOwner and not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Apenas o dono pode adicionar moradores.')
        return
    end

    -- Verificar se já existe na casa
    for _, m in ipairs(house.members) do
        if m.citizenId == memberCitizenId then
            NotifyPlayer(src, 'error', 'Jogador já está cadastrado nessa casa.')
            return
        end
    end

    -- Se definindo como dono, rebaixar o dono atual (se houver)
    if role == 'owner' then
        for i, m in ipairs(house.members) do
            if m.role == 'owner' then
                house.members[i].role = 'tenant'
                Log('Dono anterior rebaixado: ' .. m.name)
            end
        end
    end

    local newMember = {
        id        = GetGameTimer() + math.random(1, 99999),
        name      = memberName,
        citizenId = memberCitizenId,
        role      = role,
        addedAt   = os.date('%Y-%m-%d'),
    }
    table.insert(house.members, newMember)

    -- Se é dono, atualizar dados de proprietário
    if role == 'owner' then
        house.status         = 'occupied'
        house.ownerId        = newMember.id
        house.ownerName      = memberName
        house.ownerCitizenId = memberCitizenId
    end

    SaveHouse(house, function()
        if role == 'owner' then
            NotifyPlayer(src, 'success', memberName .. ' definido(a) como dono da casa!')
        else
            NotifyPlayer(src, 'success', memberName .. ' adicionado(a) à casa!')
        end
        BroadcastReload()
    end)
end)

-- Remover morador
RegisterNetEvent('creative_houses:removeMember')
AddEventHandler('creative_houses:removeMember', function(houseId, memberId)
    local src        = source
    local house      = activeHouses[houseId]
    local identifier = vRP.Passport(src)

    if not house then return end

    local isOwner = house.ownerCitizenId == identifier
    if not isOwner and not cnVRP.Permission(Config.AdminGroups) then
        NotifyPlayer(src, 'error', 'Sem permissão para remover moradores.')
        return
    end

    local newMembers   = {}
    local found        = false
    local removedOwner = false

    for _, m in ipairs(house.members) do
        if m.id == memberId then
            found = true
            if m.role == 'owner' then
                if not cnVRP.Permission(Config.AdminGroups) then
                    NotifyPlayer(src, 'error', 'Não é possível remover o dono. Peça a um admin.')
                    return
                end
                removedOwner = true
            end
        else
            table.insert(newMembers, m)
        end
    end

    if not found then
        NotifyPlayer(src, 'error', 'Membro não encontrado.')
        return
    end

    house.members = newMembers

    -- Se removeu o dono ou ficou sem membros
    if #house.members == 0 then
        house.status         = 'available'
        house.ownerId        = nil
        house.ownerName      = nil
        house.ownerCitizenId = nil
    elseif removedOwner then
        house.ownerId        = nil
        house.ownerName      = nil
        house.ownerCitizenId = nil
    end

    SaveHouse(house, function()
        if removedOwner then
            NotifyPlayer(src, 'info', 'Dono removido! Defina um novo proprietário.')
        else
            NotifyPlayer(src, 'success', 'Morador removido com sucesso!')
        end
        BroadcastReload()
    end)
end)

Log('Server carregado com sucesso!')
