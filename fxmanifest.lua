fx_version 'cerulean'
game 'gta5'

name        'creative_houses'
author      'Creative Houses'
description 'Sistema completo de casas - Creative Framework'
version     '1.0.0'

shared_scripts {
    'shared/config.lua',
}

server_scripts {
	"@vrp/lib/utils.lua",
    '@oxmysql/lib/MySQL.lua',
    'server/server.lua',
}

client_scripts {
	"@vrp/lib/utils.lua",
    'client/client.lua',
}

ui_page 'ui/index.html'

files {
    'ui/index.html',
    'ui/style.css',
    'ui/script.js',
}

lua54 'yes'

dependencies {
    'oxmysql',
}
