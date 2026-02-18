--[[
    ============================================================
        CREATIVE HOUSES — CONFIGURAÇÕES
        Framework: Creative (FiveCommunity/Basecreative)
    ============================================================
]]

Config = {}

-- ============================================================
-- GERAL
-- ============================================================
Config.Debug   = false
Config.Prefix  = '[CreativeHouses]'

-- ============================================================
-- PERMISSÕES ADMIN
-- Grupos que terão acesso ao painel administrativo
-- Baseado na Creative: player.group
-- ============================================================
Config.AdminGroups = {
    "Admin",
    "superadmin",
    "god",
    "moderator",
}

-- ============================================================
-- TECLA DE ATALHO PARA ABRIR
-- ============================================================
Config.OpenKey = 'F5'

-- ============================================================
-- POLYZONE — CONFIGURAÇÃO
-- Distância de verificação (usa o sistema nativo de distância
-- ao invés de PolyZone externo, para não ter dependência)
-- ============================================================
Config.UseNativeZoneCheck = true     -- true = usa GetDistanceBetweenCoords (sem PolyZone)
Config.ZoneCheckInterval  = 1500     -- ms entre cada checagem de zona
Config.ZoneRadius         = 15.0     -- raio de checagem em metros (se UseNativeZoneCheck = true)

-- ============================================================
-- BLIPS NO MAPA
-- ============================================================
Config.ShowBlips      = true
Config.BlipSprite     = 40       -- ícone da casa
Config.BlipColor      = 2        -- verde
Config.BlipColorOwned = 1        -- vermelho (ocupada)
Config.BlipScale      = 0.7
Config.BlipDisplay    = 4

-- ============================================================
-- NOTIFICAÇÃO
-- Tipo: 'native' = usa notificação nativa do GTA
--       'creative' = usa a notificação da Creative (se disponível)
-- ============================================================
Config.NotificationType = 'native'
