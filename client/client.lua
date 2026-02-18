-----------------------------------------------------------------------------------------------------------------------------------------
-- VRP
-----------------------------------------------------------------------------------------------------------------------------------------
local Tunnel = module("vrp","lib/Tunnel")
local Proxy = module("vrp","lib/Proxy")
vRP = Proxy.getInterface("vRP")
vRPS = Tunnel.getInterface("vRP")
-----------------------------------------------------------------------------------------------------------------------------------------
-- CONNECTION
-----------------------------------------------------------------------------------------------------------------------------------------
cnVRP = {}
Tunnel.bindInterface("houses",cnVRP)
vSERVER = Tunnel.getInterface("houses")
-----------------------------------------------------------------------------------------------------------------------------------------
-- VARIAVEIS
-----------------------------------------------------------------------------------------------------------------------------------------
local nuiOpen     = false
local cachedHouses = {}
local houseBlips  = {}
local cbQueue     = {}
local cbCounter   = 0

-- ============================================================
-- UTILITÁRIOS
-- ============================================================

local function Log(msg)
    if Config.Debug then
        print(Config.Prefix .. ' [CLIENT] ' .. tostring(msg))
    end
end

--- Notificação nativa do GTA
---@param msg string
---@param tipo string
local function Notify(msg, tipo)
    -- Notificação padrão GTA
    SetNotificationTextEntry('STRING')
    AddTextComponentString(msg)
    DrawNotification(false, true)
end

--- Verifica se o jogador é admin
---@return boolean
local function IsLocalAdmin()
    return vSERVER.Permission(Config.AdminGroups)
end

--- Retorna dados do jogador local para enviar à NUI
---@return table
local function GetLocalPlayerData()
    -- Exemplo: adaptando para pegar nome/passaporte via tvRP/vRPS
    local name = vSERVER.FullName()
    local passport = vSERVER.GetPlayer()
    return {
        name = name,
        citizenId = passport
    }
end

-- ============================================================
-- CALLBACK SYSTEM (sem ox_lib)
-- ============================================================

local function ServerCallback(eventName, cb, ...)
    cbCounter = cbCounter + 1
    local requestId = tostring(GetGameTimer()) .. '_' .. tostring(cbCounter) .. '_' .. tostring(math.random(100000, 999999))
    cbQueue[requestId] = cb
    TriggerServerEvent(eventName, requestId, ...)
end

RegisterNetEvent('creative_houses:cb_response')
AddEventHandler('creative_houses:cb_response', function(requestId, ...)
    local cb = cbQueue[requestId]
    if cb then
        cbQueue[requestId] = nil
        cb(...)
    end
end)

-- ============================================================
-- BLIPS NO MAPA
-- ============================================================

local function ClearAllBlips()
    for _, blip in pairs(houseBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    houseBlips = {}
end

local function CreateHouseBlips(houses)
    ClearAllBlips()
    if not Config.ShowBlips then return end

    for _, house in ipairs(houses) do
        if house.entryCoord and house.entryCoord.x then
            local blip = AddBlipForCoord(house.entryCoord.x, house.entryCoord.y, house.entryCoord.z)
            SetBlipSprite(blip, Config.BlipSprite)
            SetBlipDisplay(blip, Config.BlipDisplay)
            SetBlipScale(blip, Config.BlipScale)

            if house.status == 'occupied' then
                SetBlipColour(blip, Config.BlipColorOwned)
            else
                SetBlipColour(blip, Config.BlipColor)
            end

            SetBlipAsShortRange(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentString(house.name)
            EndTextCommandSetBlipName(blip)

            houseBlips[house.id] = blip
        end
    end

    Log('Blips criados: ' .. #houses)
end

-- ============================================================
-- NUI — ABRIR / FECHAR
-- ============================================================

local function CloseNUI()
    if not nuiOpen then return end
    nuiOpen = false
    SetNuiFocus(false, false)
    Citizen.SetTimeout(100, function()
        SetNuiFocus(false, false)
    end)
    SendNUIMessage({ action = 'closeUI' })
    Log('NUI fechada.')
end

local function OpenNUI(adminMode)
    if nuiOpen then return end

    ServerCallback('creative_houses:cb_getAllHouses', function(houses)
        nuiOpen = true
        SetNuiFocus(true, true)

        local playerData = GetLocalPlayerData()

        SendNUIMessage({
            action  = 'openUI',
            houses  = houses or {},
            isAdmin = adminMode or false,
            player  = playerData,
        })
        Log('NUI aberta. Admin: ' .. tostring(adminMode))
    end)
end

-- ============================================================
-- NUI CALLBACKS — RECEBIDOS DO HTML/JS
-- ============================================================

RegisterNUICallback('closeUI', function(_, cb)
    CloseNUI()
    SetNuiFocus(false, false) -- reforço extra para garantir remoção do foco
    cb('ok')
end)

-- ──── AÇÕES DO JOGADOR ────

RegisterNUICallback('buyHouse', function(data, cb)
    TriggerServerEvent('creative_houses:buyHouse', data.houseId)
    cb('ok')
end)

RegisterNUICallback('payTax', function(data, cb)
    TriggerServerEvent('creative_houses:payTax', data.houseId)
    cb('ok')
end)

RegisterNUICallback('toggleLock', function(data, cb)
    TriggerServerEvent('creative_houses:toggleLock', data.houseId)
    cb('ok')
end)

RegisterNUICallback('addMember', function(data, cb)
    TriggerServerEvent('creative_houses:addMember', data.houseId, data.memberName, data.memberCitizenId, 'tenant')
    cb('ok')
end)

RegisterNUICallback('removeMember', function(data, cb)
    TriggerServerEvent('creative_houses:removeMember', data.houseId, data.memberId)
    cb('ok')
end)

-- ──── AÇÕES DO ADMIN ────

RegisterNUICallback('adminCreateHouse', function(data, cb)
    TriggerServerEvent('creative_houses:adminCreateHouse', data)
    cb('ok')
end)

RegisterNUICallback('adminEditHouse', function(data, cb)
    TriggerServerEvent('creative_houses:adminEditHouse', data.houseId, data)
    cb('ok')
end)

RegisterNUICallback('adminDeleteHouse', function(data, cb)
    TriggerServerEvent('creative_houses:adminDeleteHouse', data.houseId)
    cb('ok')
end)

RegisterNUICallback('adminToggleLock', function(data, cb)
    TriggerServerEvent('creative_houses:adminToggleLock', data.houseId)
    cb('ok')
end)

RegisterNUICallback('adminAddMember', function(data, cb)
    local role = data.memberRole or 'tenant'
    TriggerServerEvent('creative_houses:addMember', data.houseId, data.memberName, data.memberCitizenId, role)
    cb('ok')
end)

RegisterNUICallback('adminRemoveMember', function(data, cb)
    TriggerServerEvent('creative_houses:removeMember', data.houseId, data.memberId)
    cb('ok')
end)

RegisterNUICallback('adminSetOwner', function(data, cb)
    TriggerServerEvent('creative_houses:adminSetOwner', data.houseId, data.memberId)
    cb('ok')
end)

-- ============================================================
-- ZONA DE ACESSO — VERIFICAÇÃO POR DISTÂNCIA (sem PolyZone)
-- Usa GetDistanceBetweenCoords para verificar se o jogador
-- está dentro do raio da casa. Se não tiver acesso, teleporta.
-- ============================================================

local lastZoneCheck = 0
local insideHouseId = nil

local function CheckZoneAccess()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    for _, house in pairs(cachedHouses) do
        if house.entryCoord and house.entryCoord.x then
            local dist = GetDistanceBetweenCoords(
                coords.x, coords.y, coords.z,
                house.entryCoord.x, house.entryCoord.y, house.entryCoord.z,
                true
            )

            -- Dentro do raio da zona
            if dist < Config.ZoneRadius then
                -- Evita checar a mesma casa repetidamente
                if insideHouseId ~= house.id then
                    insideHouseId = house.id

                    ServerCallback('creative_houses:cb_checkAccess', function(hasAccess, data)
                        if hasAccess then
                            Log('Acesso PERMITIDO na casa: ' .. tostring(house.id))
                            return
                        end

                        if data and data.x then
                            Notify('Voce nao tem acesso a esta propriedade!', 'error')
                            SetEntityCoords(ped, data.x, data.y, data.z, false, false, false, false)
                            if data.heading then
                                SetEntityHeading(ped, data.heading)
                            end
                            Log('Jogador teleportado para entrada da casa: ' .. tostring(house.id))
                        end
                    end, house.id)
                end
                return
            end
        end
    end

    -- Saiu de todas as zonas
    if insideHouseId then
        insideHouseId = nil
    end
end

-- Thread de verificação de zona
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(Config.ZoneCheckInterval)

        if Config.UseNativeZoneCheck and not nuiOpen then
            CheckZoneAccess()
        end
    end
end)

-- ============================================================
-- EVENTOS DE REDE
-- ============================================================

-- Recarregar casas (servidor envia após qualquer alteração)
RegisterNetEvent('creative_houses:reloadHouses')
AddEventHandler('creative_houses:reloadHouses', function()
    ServerCallback('creative_houses:cb_getAllHouses', function(houses)
        cachedHouses = {}
        if houses then
            for _, h in ipairs(houses) do
                cachedHouses[h.id] = h
            end
        end

        -- Recria blips
        CreateHouseBlips(houses or {})

        -- Atualiza NUI se estiver aberta
        if nuiOpen then
            SendNUIMessage({
                action = 'updateHouses',
                houses = houses or {},
            })
        end
        Log('Casas recarregadas: ' .. (houses and #houses or 0))
    end)
end)

-- Notificação vinda do servidor
RegisterNetEvent('creative_houses:notify')
AddEventHandler('creative_houses:notify', function(tipo, msg)
    Notify(msg, tipo)

    -- Também exibe toast na NUI se estiver aberta
    if nuiOpen then
        SendNUIMessage({
            action  = 'toast',
            msgType = tipo,
            message = msg,
        })
    end
end)

-- ============================================================
-- COMANDOS E KEYBIND
-- ============================================================

-- Abre a UI do jogador
RegisterCommand('houses_open', function()
    if nuiOpen then
        CloseNUI()
    else
        local admin = IsLocalAdmin()
        OpenNUI(admin)
    end
end, false)

-- Keybind mapeada
RegisterKeyMapping('houses_open', 'Abrir Sistema de Casas', 'keyboard', Config.OpenKey)

-- Comando exclusivo para admin
RegisterCommand('adminhouses', function()
    print(vSERVER.Permission(Config.AdminGroups))
    if not vSERVER.Permission(Config.AdminGroups) then
        Notify('Voce nao tem permissao de administrador!', 'error')
        return
    end
    if nuiOpen then
        CloseNUI()
    else
        OpenNUI(true)
    end
end, false)

-- ============================================================
-- THREAD — FECHAR COM ESC
-- ============================================================

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if nuiOpen and IsControlJustReleased(0, 200) then  -- 200 = ESC
            CloseNUI()
            -- Delay extra para garantir remoção do foco
            Citizen.SetTimeout(100, function()
                SetNuiFocus(false, false)
            end)
        end
    end
end)

-- ============================================================
-- INICIALIZAÇÃO
-- ============================================================

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    Citizen.Wait(3000) -- Aguarda Creative Framework carregar

    ServerCallback('creative_houses:cb_getAllHouses', function(houses)
        if houses then
            cachedHouses = {}
            for _, h in ipairs(houses) do
                cachedHouses[h.id] = h
            end
            CreateHouseBlips(houses)
            Log('Inicializado! Casas carregadas: ' .. #houses)
        end
    end)
end)

-- Recriar ao jogador spawnar
AddEventHandler('playerSpawned', function()
    Citizen.Wait(2000)
    ServerCallback('creative_houses:cb_getAllHouses', function(houses)
        if houses then
            cachedHouses = {}
            for _, h in ipairs(houses) do
                cachedHouses[h.id] = h
            end
            CreateHouseBlips(houses)
        end
    end)
end)

Log('Client carregado com sucesso!')
